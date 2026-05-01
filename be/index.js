const fs = require('fs');
const path = require('path');
const multer = require('multer');
const express = require('express');
const puppeteer = require('puppeteer');

const progressService = require('./services/progressService');
const { JobQueueService } = require('./services/jobQueueService');
const { getCapabilities } = require('./services/capabilitiesService');
const {
  parseUploadedDocument,
  normalizeDocument,
  serializeDocumentToTokens,
} = require('./pipeline/documentPipeline');
const {
  resolveFontFamily,
  getFontStack,
} = require('./pipeline/render/fontCatalog');
const { buildTokenStyles, normalizeBorderStyle } = require('./pipeline/render/tokenStyles');
const { PRETEXT_DIST_ROUTE, getPretextModuleUrls } = require('./pipeline/render/pretextAssets');
const {
  captureFirstPageScreenshot,
  getScreenshotArtifactPaths,
} = require('./pipeline/render/screenshotArtifacts');
const {
  generateJobId,
  getSafeUploadFilename,
} = require('./utils/fileUtils');
const {
  calculateReadingTime,
  calculateSheetsCount,
  normalizeDisplayBookName,
} = require('./utils/outputStats');
const { getPuppeteerLaunchOptions } = require('./utils/browserUtils');

const app = express();
const port = 3001;
const rendererBaseUrl = process.env.MICROBOOK_RENDERER_BASE_URL || `http://127.0.0.1:${port}`;
const queueConcurrency = Number(process.env.JOB_QUEUE_CONCURRENCY || 1);
const jobQueue = new JobQueueService({ concurrency: queueConcurrency });
const capabilities = getCapabilities();
const supportedFormatSet = new Set(capabilities.acceptedFormats);
const supportedFontValues = new Set(capabilities.fontOptions.map((option) => option.value));
const defaultFontFamily = capabilities.defaults.fontFamily;

const generatedDir = path.join(__dirname, 'generated');
const uploadsDir = path.join(__dirname, 'uploads');
const pretextDistDir = path.join(__dirname, 'node_modules', '@chenglou', 'pretext', 'dist');

fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(PRETEXT_DIST_ROUTE, express.static(pretextDistDir));
app.get('/__microbook-renderer/page.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'page.html'));
});

const runningJobs = new Map(); // jobId -> { browser, cancelled, status }

const storage = multer.diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function filename(req, file, cb) {
    cb(null, getSafeUploadFilename(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!supportedFormatSet.has(extension)) {
      cb(new Error(`Unsupported file format: ${extension || 'unknown'}`));
      return;
    }
    cb(null, true);
  },
});

function getProgressPaths(id) {
  return {
    inProgressPath: path.join(generatedDir, `IN_PROGRESS_${id}.txt`),
    structuredProgressPath: path.join(generatedDir, `PROGRESS_${id}.json`),
    metadataPath: path.join(generatedDir, `METADATA_${id}.json`),
    pdfPath: path.join(generatedDir, `${id}.pdf`),
  };
}

function writeLegacyProgress(id, text) {
  const { inProgressPath } = getProgressPaths(id);
  fs.writeFileSync(inProgressPath, text);
  const structuredProgress = progressService.parseLegacyProgress(text);
  progressService.writeProgress(id, structuredProgress);
}

function readMetadata(id) {
  const { metadataPath } = getProgressPaths(id);
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    console.warn(`Failed to parse metadata ${metadataPath}:`, error);
    return null;
  }
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return fallback;
}

function setQueuedProgress(id, bookName) {
  progressService.writeProgress(id, {
    step: `Queued: ${bookName}`,
    percentage: 0,
    isComplete: false,
    isError: false,
    phase: 'queued',
  });
}

async function executePdfJob({
  id,
  params,
  uploadFile,
  metadata,
}) {
  const { bookName, fontFamily } = params;
  const borderStyle = normalizeBorderStyle(params.borderStyle);
  const foldGaps = normalizeBoolean(params.foldGaps, false);
  const { fontSize, author, year, series } = params.headerInfo;
  const resolvedFontFamily = resolveFontFamily(fontFamily, {
    allowedValues: supportedFontValues,
  });
  const selectedFontStack = getFontStack(resolvedFontFamily, {
    allowedValues: supportedFontValues,
  });

  let browser = null;
  let page = null;
  const { inProgressPath, metadataPath, pdfPath } = getProgressPaths(id);

  const jobState = runningJobs.get(id);
  if (jobState?.cancelled) {
    return;
  }

  progressService.writeProgress(id, {
    step: `Initializing: ${bookName}`,
    percentage: 1,
    isComplete: false,
    isError: false,
    phase: 'initialization',
  });

  try {
    const inputBuffer = fs.readFileSync(uploadFile.path);
    const parsedDocument = parseUploadedDocument({
      originalName: uploadFile.originalname,
      mimeType: uploadFile.mimetype,
      input: inputBuffer,
    });

    const normalizedDocument = normalizeDocument(parsedDocument);
    const tokens = serializeDocumentToTokens(normalizedDocument);
    const normalizedWordCount = normalizedDocument.wordCount;
    const resolvedSheetsCount = Number(params?.headerInfo?.sheetsCount || 0)
      || calculateSheetsCount(normalizedWordCount, fontSize);
    const resolvedReadTime = params?.headerInfo?.readTime && params.headerInfo.readTime !== '--'
      ? params.headerInfo.readTime
      : calculateReadingTime(normalizedWordCount);
    const resolvedHeaderInfo = {
      sheetsCount: resolvedSheetsCount,
      wordCount: normalizedWordCount,
      readTime: resolvedReadTime,
      author,
      year,
      ...(series ? { series } : {}),
      fontSize,
    };

    progressService.writeProgress(id, {
      step: 'Setting up document processing',
      percentage: 3,
      isComplete: false,
      isError: false,
      phase: 'setup',
    });

    const launchOptions = getPuppeteerLaunchOptions();
    if (process.env.PUPPETEER_EXECUTABLE_PATH && !launchOptions.executablePath) {
      console.warn(`PUPPETEER_EXECUTABLE_PATH is set but missing: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    }

    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (error) {
      const message = String(error?.message || error);
      if (/Browser was not found|Could not find Chrome|Could not find chromium/i.test(message)) {
        throw new Error(
          `${message}. Install Chromium in WSL (e.g. 'sudo apt install chromium-browser') `
          + `or set PUPPETEER_EXECUTABLE_PATH to a valid browser binary.`
        );
      }
      throw error;
    }

    const existingState = runningJobs.get(id);
    if (existingState) {
      runningJobs.set(id, {
        ...existingState,
        browser,
        status: 'running',
      });
    }

    if (runningJobs.get(id)?.cancelled) {
      return;
    }

    page = await browser.newPage();
    await page.setDefaultTimeout(60000);
    await page.setDefaultNavigationTimeout(60000);

    page.on('error', (error) => {
      console.error(`Page error for job ${id}:`, error);
      progressService.writeProgress(id, {
        step: 'Page error occurred',
        percentage: 0,
        isComplete: false,
        isError: true,
        errorMessage: error.message,
        phase: 'error',
      });
    });

    page.on('pageerror', (error) => {
      console.error(`Page script error for job ${id}:`, error);
    });

    page.on('console', (event) => {
      const index = Number(event.text());
      if (Number.isNaN(index)) {
        return;
      }

      const currentSheet = Math.ceil(index / 2);
      const progressPercentage = Math.min(95, 5 + Math.round(Math.log(index + 1) * 18));

      progressService.writeProgress(id, {
        step: `Creating sheet ${currentSheet}`,
        percentage: progressPercentage,
        currentSheet,
        totalSheets: null,
        isComplete: false,
        isError: false,
        phase: 'page_creation',
      });

      writeLegacyProgress(id, `Creating sheet ${index / 2} of ${resolvedSheetsCount}-ish.`);
    });

    const fontSizeNumber = Number(fontSize) || 6;
    const pretextModuleUrls = getPretextModuleUrls(__dirname, { baseUrl: rendererBaseUrl });

    await page.goto(`${rendererBaseUrl}/__microbook-renderer/page.html`);
    await page.addStyleTag({ content: `body { font-size: ${fontSizeNumber}px; }` });
    await page.addStyleTag({
      content: buildTokenStyles({
        selectedFontStack,
        borderStyle,
      }),
    });

    const pretextLoadResult = await page.evaluate(async ({ layoutUrl, richInlineUrl, version }) => {
      try {
        const [layoutModule, richInlineModule] = await Promise.all([
          import(layoutUrl),
          import(richInlineUrl),
        ]);

        window.__microbookPretext = {
          ...layoutModule,
          richInline: richInlineModule,
          version,
          available: true,
        };

        return { available: true, version };
      } catch (error) {
        window.__microbookPretext = {
          available: false,
          error: error?.message || String(error),
        };

        return window.__microbookPretext;
      }
    }, pretextModuleUrls);

    if (!pretextLoadResult.available) {
      throw new Error(`Failed to load Pretext in the PDF renderer: ${pretextLoadResult.error}`);
    }

    progressService.writeProgress(id, {
      step: 'Creating document pages',
      percentage: 5,
      isComplete: false,
      isError: false,
      phase: 'page_creation',
    });

    writeLegacyProgress(id, `Creating: ${bookName}`);

    await page.evaluate((payload) => {
      const {
        tokens,
        bookName,
        headerInfo,
        totalWords,
        foldGaps,
      } = payload;

      let pageIndex = 0;
      let isCurrentPageFront = true;

      const foldGapPx = 4;

      function applyFoldGapPadding(gridItem, cellIndex) {
        if (!foldGaps) {
          return;
        }

        if (cellIndex < 4) {
          gridItem.style.paddingBottom = `${foldGapPx}px`;
        } else if (cellIndex >= 4 && cellIndex < 12) {
          gridItem.style.paddingTop = `${foldGapPx}px`;
          gridItem.style.paddingBottom = `${foldGapPx}px`;
        } else {
          gridItem.style.paddingTop = `${foldGapPx}px`;
        }

        if (cellIndex % 4 === 1) {
          gridItem.style.paddingRight = `${foldGapPx}px`;
        } else if (cellIndex % 4 === 2) {
          gridItem.style.paddingLeft = `${foldGapPx}px`;
        }
      }

      function createNewPage(initialWordCount, wordsLeft) {
        console.log(pageIndex + 1);
        const percentageCompleted = initialWordCount > 0
          ? Math.round((initialWordCount - wordsLeft) / initialWordCount * 100)
          : 0;

        const pageElement = document.createElement('div');
        pageElement.className = 'page';

        const grid = document.createElement('div');
        grid.className = 'grid-container';

        for (let i = 0; i < 16; i += 1) {
          const gridItem = document.createElement('div');
          gridItem.className = 'grid-item';

          let paddingClass = '';
          if (i < 4) {
            paddingClass += 'pad-bottom ';
          } else if (i >= 4 && i < 12) {
            paddingClass += 'pad-top pad-bottom ';
          } else {
            paddingClass += 'pad-top ';
          }

          if (i % 4 === 1) {
            paddingClass += 'pad-right';
          } else if (i % 4 === 2) {
            paddingClass += 'pad-left';
          }

          gridItem.className += ` ${paddingClass}`;
          applyFoldGapPadding(gridItem, i);

          if (i === 0 && isCurrentPageFront) {
            gridItem.id = `header${pageIndex}`;
            const mainHeader = document.createElement('div');
            mainHeader.classList.add('main-header');
            const table = document.createElement('table');
            mainHeader.appendChild(table);

            const titleRow = document.createElement('tr');
            const titleCell = document.createElement('td');
            titleCell.setAttribute('colspan', '2');
            titleCell.classList.add('main-header-title');

            if (pageIndex === 0) {
              titleCell.innerText = `${bookName}`;
            } else {
              const sheetNumSpan = document.createElement('span');
              sheetNumSpan.id = `sheetNum${pageIndex}`;
              sheetNumSpan.innerText = '00/00';
              titleCell.appendChild(sheetNumSpan);
              if (bookName) {
                titleCell.appendChild(document.createTextNode(` - ${bookName}`));
              }
            }

            titleRow.appendChild(titleCell);
            table.appendChild(titleRow);

            if (pageIndex === 0) {
              let cellCount = 0;
              let currentRow = null;
              for (const property in headerInfo) {
                if (!headerInfo[property]) {
                  continue;
                }

                if (cellCount === 0 || cellCount >= 2) {
                  currentRow = document.createElement('tr');
                  table.appendChild(currentRow);
                  cellCount = 0;
                }

                const cell = document.createElement('td');
                let value = headerInfo[property];
                if (property === 'wordCount') {
                  value = `${Intl.NumberFormat().format(wordsLeft)}`;
                }

                const label = document.createElement('b');
                label.textContent = `${property.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:`;
                cell.appendChild(label);
                cell.appendChild(document.createTextNode(` ${value}`));
                currentRow.appendChild(cell);
                cellCount += 1;
              }
            } else {
              const currentRow = document.createElement('tr');
              table.appendChild(currentRow);

              const cell = document.createElement('td');
              cell.setAttribute('colspan', '2');
              const wordsPerMinute = 215;
              const timeLeftMinutes = wordsLeft / wordsPerMinute;
              const hoursLeft = Math.floor(timeLeftMinutes / 60);
              const minsLeft = Math.round(timeLeftMinutes % 60);
              let timeText = '';
              if (hoursLeft > 0) {
                timeText += `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
              }
              if (minsLeft > 0) {
                timeText += ` ${minsLeft} minute${minsLeft > 1 ? 's' : ''}`;
              }

              cell.textContent = `${Intl.NumberFormat().format(wordsLeft)} Words - ${percentageCompleted}% Complete - ${timeText}`;
              currentRow.appendChild(cell);
            }

            gridItem.appendChild(mainHeader);
          } else if (i % 4 === 0) {
            const miniSheetNumContainer = document.createElement('span');
            const miniSheetNum = document.createElement('span');
            const miniSheetNumPercentage = document.createElement('span');

            miniSheetNumContainer.appendChild(miniSheetNum);
            miniSheetNumContainer.appendChild(miniSheetNumPercentage);
            miniSheetNumPercentage.classList.add('miniSheetNumPrecentage');
            miniSheetNum.classList.add(`miniSheetNum${pageIndex}`);
            miniSheetNumContainer.classList.add('miniSheetNum');
            miniSheetNum.textContent = '00/00';
            miniSheetNumPercentage.textContent = ' 00%';

            gridItem.appendChild(miniSheetNumContainer);
          }

          grid.appendChild(gridItem);
        }

        pageElement.appendChild(grid);
        document.body.appendChild(pageElement);

        isCurrentPageFront = !isCurrentPageFront;
        pageIndex += 1;

        return Array.from(document.querySelectorAll('.grid-item'));
      }

      function buildTokenClass(token) {
        const classes = [
          'token',
          `token-${token.variant || 'body'}`,
        ];

        if (token.inlineStyle) {
          classes.push(`token-inline-${token.inlineStyle}`);
        }

        if (token.type === 'link') {
          classes.push('token-link');
        }

        return classes.join(' ');
      }

      function buildNode(token) {
        if (token.type === 'break') {
          if (token.variant === 'separator') {
            const hr = document.createElement('hr');
            hr.className = 'token-separator';
            return hr;
          }

          const breakSpan = document.createElement('span');
          breakSpan.className = 'token-break token-break-paragraph-space';
          breakSpan.textContent = ' ';
          return breakSpan;
        }

        const collapseWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

        if (token.type === 'link') {
          if (token.isImage) {
            const imageLink = document.createElement('span');
            imageLink.className = `${buildTokenClass(token)} token-link-image`;
            imageLink.textContent = collapseWhitespace(token.text) || 'Image';
            return imageLink;
          }

          if (token.isBareUrl) {
            const plain = document.createElement('span');
            plain.className = `${buildTokenClass(token)} token-link-bare`;
            plain.textContent = collapseWhitespace(token.url);
            return plain;
          }

          const container = document.createElement('span');
          container.className = buildTokenClass(token);

          const label = document.createElement('span');
          label.className = 'token-link-label';
          label.textContent = collapseWhitespace(token.text || token.url);

          const url = document.createElement('span');
          url.className = 'token-link-url';
          url.textContent = token.url ? ` (${collapseWhitespace(token.url)})` : '';

          container.appendChild(label);
          container.appendChild(url);
          return container;
        }

        const span = document.createElement('span');
        span.className = buildTokenClass(token);
        span.textContent = collapseWhitespace(token.text);
        return span;
      }

      function isTextLikeToken(token) {
        return token?.type === 'word' || token?.type === 'link';
      }

      function isStandalonePunctuationWord(token) {
        return token?.type === 'word' && /^[,.;:!?%)\]}]+$/.test(String(token.text || ''));
      }

      function shouldInsertLeadingSpace(previousToken, currentToken) {
        if (!isTextLikeToken(previousToken) || !isTextLikeToken(currentToken)) {
          return false;
        }

        if (isStandalonePunctuationWord(currentToken)) {
          return false;
        }

        return true;
      }

      function toFiniteNumber(value, fallback = 0) {
        const number = Number.parseFloat(String(value || ''));
        return Number.isFinite(number) ? number : fallback;
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function getPretextApi() {
        const api = window.__microbookPretext;
        if (!api || !api.available) {
          throw new Error(`Pretext is unavailable in the renderer: ${api?.error || 'unknown error'}`);
        }

        return api;
      }

      function getComputedFontString(element) {
        const style = window.getComputedStyle(element);
        if (style.font) {
          return style.font;
        }

        return [
          style.fontStyle,
          style.fontVariant,
          style.fontWeight,
          style.fontSize,
          style.fontFamily,
        ].filter(Boolean).join(' ');
      }

      function getPrimaryTextElement(block) {
        return block.querySelector('.token-body, .token-quote, .token-heading-1, .token-heading-2, .token-heading-3, .token') || block;
      }

      function getLineHeightPx(element) {
        const style = window.getComputedStyle(element);
        const fontSizePx = toFiniteNumber(style.fontSize, 6);
        const lineHeightPx = style.lineHeight === 'normal'
          ? fontSizePx * 1.2
          : toFiniteNumber(style.lineHeight, fontSizePx * 1.05);

        return {
          fontSizePx,
          lineHeightPx,
          ratio: fontSizePx > 0 ? lineHeightPx / fontSizePx : 1.05,
        };
      }

      function getInlineLetterSpacing(element) {
        const style = window.getComputedStyle(element);
        return style.letterSpacing === 'normal' ? 0 : toFiniteNumber(style.letterSpacing, 0);
      }

      function getUsableTextWidth(block) {
        const style = window.getComputedStyle(block);
        const paddingX = toFiniteNumber(style.paddingLeft) + toFiniteNumber(style.paddingRight);
        return Math.max(1, block.clientWidth - paddingX);
      }

      function getFirstLineReservedWidth(block) {
        const miniSheetNum = block.querySelector(':scope > .miniSheetNum');
        if (!miniSheetNum) {
          return 0;
        }

        const style = window.getComputedStyle(miniSheetNum);
        return miniSheetNum.getBoundingClientRect().width
          + toFiniteNumber(style.marginLeft)
          + toFiniteNumber(style.marginRight);
      }

      function cloneBodyText(block) {
        const clone = block.cloneNode(true);
        clone.querySelectorAll('.miniSheetNum, .main-header, .token-separator').forEach((node) => node.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
      }

      function collectRichInlineItems(block) {
        const items = [];

        function visit(node) {
          if (items.length >= 400) {
            return;
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.matches('.miniSheetNum, .main-header, .token-separator')) {
              return;
            }

            if (element.tagName === 'BR') {
              items.push({
                text: ' ',
                font: getComputedFontString(getPrimaryTextElement(block)),
              });
              return;
            }
          }

          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim() !== '') {
              const parent = node.parentElement || block;
              items.push({
                text,
                font: getComputedFontString(parent),
                letterSpacing: getInlineLetterSpacing(parent),
                break: parent.classList?.contains('miniSheetNum') ? 'never' : 'normal',
              });
            }
            return;
          }

          node.childNodes.forEach(visit);
        }

        block.childNodes.forEach(visit);
        return items;
      }

      function measureVariableWidthLines(api, prepared, maxWidth, lineHeightPx, firstLineReservedWidth) {
        let cursor = { segmentIndex: 0, graphemeIndex: 0 };
        let lineCount = 0;
        let maxLineWidth = 0;

        while (lineCount < 512) {
          const availableWidth = lineCount === 0
            ? Math.max(1, maxWidth - firstLineReservedWidth)
            : maxWidth;
          const range = api.layoutNextLineRange(prepared, cursor, availableWidth);
          if (range === null) {
            break;
          }

          lineCount += 1;
          maxLineWidth = Math.max(maxLineWidth, range.width);
          cursor = range.end;
        }

        return {
          lineCount,
          maxLineWidth,
          height: lineCount * lineHeightPx,
        };
      }

      function analyzeBlockWithPretext(block) {
        const api = getPretextApi();
        const text = cloneBodyText(block);
        if (!text) {
          return null;
        }

        const primaryTextElement = getPrimaryTextElement(block);
        const font = getComputedFontString(primaryTextElement);
        const lineMetrics = getLineHeightPx(primaryTextElement);
        const width = getUsableTextWidth(block);
        const letterSpacing = getInlineLetterSpacing(primaryTextElement);
        const prepared = api.prepareWithSegments(text, font, {
          whiteSpace: 'normal',
          letterSpacing,
        });
        const fixedLayout = api.layoutWithLines(prepared, width, lineMetrics.lineHeightPx);
        const variableLayout = measureVariableWidthLines(
          api,
          prepared,
          width,
          lineMetrics.lineHeightPx,
          getFirstLineReservedWidth(block)
        );

        let richInlineStats = null;
        const richInlineItems = collectRichInlineItems(block);
        if (richInlineItems.length > 0 && api.richInline?.prepareRichInline) {
          try {
            const preparedRichInline = api.richInline.prepareRichInline(richInlineItems);
            richInlineStats = api.richInline.measureRichInlineStats(preparedRichInline, width);
          } catch (error) {
            richInlineStats = {
              error: error?.message || String(error),
            };
          }
        }

        const wordCount = text.split(/\s+/).filter(Boolean).length;

        return {
          textLength: text.length,
          wordCount,
          width,
          font,
          fontSizePx: lineMetrics.fontSizePx,
          baseLineHeightPx: lineMetrics.lineHeightPx,
          baseLineHeightRatio: lineMetrics.ratio,
          fixedLineCount: fixedLayout.lineCount,
          fixedHeight: fixedLayout.height,
          fixedMaxLineWidth: fixedLayout.lines.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0),
          variableLineCount: variableLayout.lineCount,
          variableHeight: variableLayout.height,
          variableMaxLineWidth: variableLayout.maxLineWidth,
          richInlineLineCount: richInlineStats && !richInlineStats.error ? richInlineStats.lineCount : null,
          richInlineMaxLineWidth: richInlineStats && !richInlineStats.error ? richInlineStats.maxLineWidth : null,
          richInlineError: richInlineStats?.error || null,
        };
      }

      function shouldOptimizeBlock(block) {
        if (!block.isConnected) {
          return false;
        }

        if (block.textContent.includes('THE END')) {
          return false;
        }

        return block.querySelectorAll('.token').length >= 6;
      }

      function applyHorizontalJustification(block, analysis) {
        const renderedLineMetrics = getRenderedLineMetrics(block);
        const lineCount = renderedLineMetrics.lineCount
          || analysis.richInlineLineCount
          || analysis.variableLineCount
          || analysis.fixedLineCount;
        const fillRatio = renderedLineMetrics.averageCoreFillRatio;
        const denseLineShare = renderedLineMetrics.denseCoreLineShare;
        const shortestCoreLineRatio = renderedLineMetrics.shortestCoreLineRatio;
        const averageWordsPerLine = analysis.wordCount / Math.max(lineCount, 1);
        const averageCharactersPerLine = analysis.textLength / Math.max(lineCount, 1);
        const hasBlockingStructuredContent = Boolean(block.querySelector(
          '.token-separator, .token-heading-1, .token-heading-2, .token-heading-3, .token-heading-4, .token-heading-5, .token-heading-6, .token-quote, .token-link, .token-inline-code'
        ));
        const candidate = lineCount >= 10;
        const shouldApply = candidate
          && !hasBlockingStructuredContent
          && analysis.textLength >= 450
          && averageCharactersPerLine >= 24
          && averageWordsPerLine >= 4.5
          && fillRatio >= 0.72
          && denseLineShare >= 0.55
          && shortestCoreLineRatio >= 0.38;

        block.classList.toggle('microbook-horizontal-justified', shouldApply);

        return {
          candidate,
          applied: shouldApply,
          fillRatio,
          denseLineShare,
          shortestCoreLineRatio,
          averageWordsPerLine,
          averageCharactersPerLine,
        };
      }

      function getBlockContentBox(block) {
        const rect = block.getBoundingClientRect();
        const style = window.getComputedStyle(block);

        return {
          top: rect.top + toFiniteNumber(style.paddingTop),
          bottom: rect.bottom - toFiniteNumber(style.paddingBottom),
        };
      }

      function getTextVisualBounds(block) {
        const rects = [];
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (!node.textContent || node.textContent.trim() === '') {
              return NodeFilter.FILTER_REJECT;
            }

            const parent = node.parentElement;
            if (!parent || parent.closest('.main-header')) {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
          },
        });

        while (walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          Array.from(range.getClientRects()).forEach((rect) => {
            if (rect.width > 0 && rect.height > 0) {
              rects.push(rect);
            }
          });
          range.detach();
        }

        if (rects.length === 0) {
          return null;
        }

        const rows = [];
        rects.forEach((rect) => {
          const existingRow = rows.find((row) => Math.abs(row.top - rect.top) <= 1.25);
          if (existingRow) {
            existingRow.top = Math.min(existingRow.top, rect.top);
            existingRow.bottom = Math.max(existingRow.bottom, rect.bottom);
            return;
          }

          rows.push({
            top: rect.top,
            bottom: rect.bottom,
          });
        });

        rows.sort((a, b) => a.top - b.top);

        const lineGaps = [];
        for (let i = 1; i < rows.length; i += 1) {
          const gap = rows[i].top - rows[i - 1].bottom;
          if (Number.isFinite(gap) && gap >= 0) {
            lineGaps.push(gap);
          }
        }

        const averageLineGap = lineGaps.length > 0
          ? lineGaps.reduce((sum, gap) => sum + gap, 0) / lineGaps.length
          : 0;

        return {
          top: Math.min(...rects.map((rect) => rect.top)),
          bottom: Math.max(...rects.map((rect) => rect.bottom)),
          lineBoxCount: rows.length,
          averageLineGap,
        };
      }

      function getRenderedLineMetrics(block) {
        const style = window.getComputedStyle(block);
        const blockRect = block.getBoundingClientRect();
        const contentLeft = blockRect.left + toFiniteNumber(style.paddingLeft);
        const contentRight = blockRect.right - toFiniteNumber(style.paddingRight);
        const usableWidth = Math.max(1, contentRight - contentLeft);
        const rows = [];

        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (!node.textContent || node.textContent.trim() === '') {
              return NodeFilter.FILTER_REJECT;
            }

            const parent = node.parentElement;
            if (!parent || parent.closest('.main-header')) {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
          },
        });

        while (walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          Array.from(range.getClientRects()).forEach((rect) => {
            if (rect.width <= 0 || rect.height <= 0) {
              return;
            }

            const existingRow = rows.find((row) => Math.abs(row.top - rect.top) <= 1.25);
            if (existingRow) {
              existingRow.top = Math.min(existingRow.top, rect.top);
              existingRow.bottom = Math.max(existingRow.bottom, rect.bottom);
              existingRow.left = Math.min(existingRow.left, rect.left);
              existingRow.right = Math.max(existingRow.right, rect.right);
              return;
            }

            rows.push({
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            });
          });
          range.detach();
        }

        rows.sort((a, b) => a.top - b.top);

        const lines = rows.map((row) => {
          const width = Math.max(0, row.right - row.left);
          return {
            width,
            fillRatio: clamp(width / usableWidth, 0, 1.5),
          };
        });

        const coreLines = lines.length > 2 ? lines.slice(1, -1) : lines;
        const averageCoreFillRatio = coreLines.length > 0
          ? coreLines.reduce((sum, line) => sum + line.fillRatio, 0) / coreLines.length
          : 0;
        const denseCoreLineCount = coreLines.filter((line) => line.fillRatio >= 0.74).length;
        const denseCoreLineShare = coreLines.length > 0 ? denseCoreLineCount / coreLines.length : 0;
        const shortestCoreLineRatio = coreLines.length > 0
          ? Math.min(...coreLines.map((line) => line.fillRatio))
          : 0;

        return {
          lineCount: lines.length,
          averageCoreFillRatio,
          denseCoreLineShare,
          shortestCoreLineRatio,
        };
      }

      function measureVerticalFit(block) {
        const contentBox = getBlockContentBox(block);
        const visualBounds = getTextVisualBounds(block);
        const scrollSlack = block.clientHeight - block.scrollHeight;

        if (!visualBounds) {
          return {
            hasTextBounds: false,
            scrollSlack,
            visualSlack: scrollSlack,
            visualTopSlack: null,
            averageLineGap: null,
            targetEdgeSlack: 1,
          };
        }

        const targetEdgeSlack = clamp(visualBounds.averageLineGap || 1, 0.5, 2);

        return {
          hasTextBounds: true,
          scrollSlack,
          visualSlack: contentBox.bottom - visualBounds.bottom,
          visualTopSlack: visualBounds.top - contentBox.top,
          averageLineGap: visualBounds.averageLineGap,
          targetEdgeSlack,
        };
      }

      function applyVerticalJustification(block, analysis) {
        const baseRatio = clamp(analysis.baseLineHeightRatio || 1, 0.92, 1.2);
        const lineCount = Math.max(
          analysis.richInlineLineCount || analysis.variableLineCount || analysis.fixedLineCount || 1,
          1
        );

        block.style.setProperty('--microbook-line-height', baseRatio.toFixed(4));
        const fitBefore = measureVerticalFit(block);
        const targetVisualSlack = fitBefore.targetEdgeSlack ?? 1;
        if (!fitBefore.hasTextBounds || fitBefore.visualSlack <= targetVisualSlack) {
          return {
            applied: false,
            baselineOnly: false,
            lineHeightRatio: baseRatio,
            slackBefore: fitBefore.scrollSlack,
            slackAfter: fitBefore.scrollSlack,
            visualTopSlackBefore: fitBefore.visualTopSlack,
            visualTopSlackAfter: fitBefore.visualTopSlack,
            visualSlackBefore: fitBefore.visualSlack,
            visualSlackAfter: fitBefore.visualSlack,
            averageLineGap: fitBefore.averageLineGap,
            targetEdgeSlack: targetVisualSlack,
          };
        }

        const estimatedExtraRatio = fitBefore.visualSlack / Math.max(analysis.fontSizePx * Math.max(lineCount - 1, 1), 1);
        const pretextTarget = baseRatio + estimatedExtraRatio;
        let upperBound = clamp(Math.max(pretextTarget, baseRatio + 0.03), baseRatio, 1.35);

        block.style.setProperty('--microbook-line-height', upperBound.toFixed(4));
        let fitAtUpperBound = measureVerticalFit(block);
        while (fitAtUpperBound.visualSlack > targetVisualSlack && upperBound < 1.35) {
          upperBound = clamp(upperBound + 0.05, baseRatio, 1.35);
          block.style.setProperty('--microbook-line-height', upperBound.toFixed(4));
          fitAtUpperBound = measureVerticalFit(block);
        }

        let low = baseRatio;
        let high = upperBound;
        for (let i = 0; i < 12; i += 1) {
          const midpoint = (low + high) / 2;
          block.style.setProperty('--microbook-line-height', midpoint.toFixed(4));
          const fit = measureVerticalFit(block);
          if (fit.visualSlack >= targetVisualSlack) {
            low = midpoint;
          } else {
            high = midpoint;
          }
        }

        block.style.setProperty('--microbook-line-height', low.toFixed(4));
        const fitAfter = measureVerticalFit(block);

        return {
          applied: low > baseRatio + 0.005,
          baselineOnly: false,
          lineHeightRatio: low,
          slackBefore: fitBefore.scrollSlack,
          slackAfter: fitAfter.scrollSlack,
          visualTopSlackBefore: fitBefore.visualTopSlack,
          visualTopSlackAfter: fitAfter.visualTopSlack,
          visualSlackBefore: fitBefore.visualSlack,
          visualSlackAfter: fitAfter.visualSlack,
          averageLineGap: fitAfter.averageLineGap,
          targetEdgeSlack: targetVisualSlack,
          pretextTarget,
        };
      }

      function runPretextLayoutOptimization() {
        const startedAt = performance.now();
        const api = getPretextApi();
        const blocks = Array.from(document.querySelectorAll('.grid-item')).filter((block) => block.isConnected);
        const populatedBlocks = blocks.filter((block) => block.textContent.trim() !== '');
        const blockReports = [];

        const formatNumber = (value, digits = 2) => Number.isFinite(value)
          ? value.toFixed(digits)
          : '';
        const roundNumber = (value, digits = 2) => Number.isFinite(value)
          ? Number(value.toFixed(digits))
          : null;

        let analyzedBlocks = 0;
        let verticallyJustifiedBlocks = 0;
        let horizontallyJustifiedBlocks = 0;
        let horizontalJustificationCandidateBlocks = 0;
        let estimatedLines = 0;

        populatedBlocks.forEach((block, index) => {
          if (!shouldOptimizeBlock(block)) {
            return;
          }

          const analysis = analyzeBlockWithPretext(block);
          if (!analysis) {
            return;
          }

          analyzedBlocks += 1;
          estimatedLines += analysis.richInlineLineCount || analysis.variableLineCount || analysis.fixedLineCount || 0;

          const horizontalResult = applyHorizontalJustification(block, analysis);
          const verticalResult = applyVerticalJustification(block, analysis);

          if (horizontalResult.candidate) {
            horizontalJustificationCandidateBlocks += 1;
          }
          if (horizontalResult.applied) {
            horizontallyJustifiedBlocks += 1;
          }
          if (verticalResult.applied) {
            verticallyJustifiedBlocks += 1;
          }

          block.dataset.pretextLineCount = String(analysis.richInlineLineCount || analysis.variableLineCount || analysis.fixedLineCount || 0);
          block.dataset.pretextVariableLineCount = String(analysis.variableLineCount || 0);
          block.dataset.pretextRichLineCount = String(analysis.richInlineLineCount || 0);
          block.dataset.pretextLineHeight = verticalResult.lineHeightRatio.toFixed(4);
          block.dataset.pretextSlackBefore = formatNumber(verticalResult.slackBefore);
          block.dataset.pretextSlackAfter = formatNumber(verticalResult.slackAfter);
          block.dataset.pretextVisualTopSlackBefore = formatNumber(verticalResult.visualTopSlackBefore);
          block.dataset.pretextVisualTopSlackAfter = formatNumber(verticalResult.visualTopSlackAfter);
          block.dataset.pretextVisualSlackBefore = formatNumber(verticalResult.visualSlackBefore);
          block.dataset.pretextVisualSlackAfter = formatNumber(verticalResult.visualSlackAfter);
          block.dataset.pretextTargetEdgeSlack = formatNumber(verticalResult.targetEdgeSlack);
          block.dataset.pretextHorizontalFillRatio = horizontalResult.fillRatio.toFixed(3);
          block.dataset.pretextHorizontalDenseLineShare = horizontalResult.denseLineShare.toFixed(3);
          block.dataset.pretextHorizontalShortestCoreLineRatio = horizontalResult.shortestCoreLineRatio.toFixed(3);
          block.dataset.pretextHorizontalWordsPerLine = horizontalResult.averageWordsPerLine.toFixed(2);

          blockReports.push({
            index,
            textLength: analysis.textLength,
            wordCount: analysis.wordCount,
            width: Number(analysis.width.toFixed(2)),
            fixedLineCount: analysis.fixedLineCount,
            variableLineCount: analysis.variableLineCount,
            richInlineLineCount: analysis.richInlineLineCount,
            lineHeightRatio: Number(verticalResult.lineHeightRatio.toFixed(4)),
            slackBefore: roundNumber(verticalResult.slackBefore),
            slackAfter: roundNumber(verticalResult.slackAfter),
            visualTopSlackBefore: roundNumber(verticalResult.visualTopSlackBefore),
            visualTopSlackAfter: roundNumber(verticalResult.visualTopSlackAfter),
            visualSlackBefore: roundNumber(verticalResult.visualSlackBefore),
            visualSlackAfter: roundNumber(verticalResult.visualSlackAfter),
            verticalTargetEdgeSlack: roundNumber(verticalResult.targetEdgeSlack),
            verticalAverageLineGap: roundNumber(verticalResult.averageLineGap),
            horizontalJustified: horizontalResult.applied,
            horizontalJustificationCandidate: horizontalResult.candidate,
            horizontalFillRatio: Number(horizontalResult.fillRatio.toFixed(3)),
            horizontalDenseLineShare: Number(horizontalResult.denseLineShare.toFixed(3)),
            horizontalShortestCoreLineRatio: Number(horizontalResult.shortestCoreLineRatio.toFixed(3)),
            horizontalAverageWordsPerLine: Number(horizontalResult.averageWordsPerLine.toFixed(2)),
            horizontalAverageCharactersPerLine: Number(horizontalResult.averageCharactersPerLine.toFixed(2)),
            verticalJustified: verticalResult.applied,
            verticalBaselineOnly: Boolean(verticalResult.baselineOnly),
          });
        });

        const report = {
          engine: 'pretext',
          pretextVersion: api.version || 'unknown',
          analyzedBlocks,
          populatedBlocks: populatedBlocks.length,
          verticallyJustifiedBlocks,
          horizontallyJustifiedBlocks,
          horizontalJustificationCandidateBlocks,
          estimatedLines,
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
          blocks: blockReports,
        };

        const reportNode = document.createElement('script');
        reportNode.type = 'application/json';
        reportNode.id = 'microbook-layout-report';
        reportNode.textContent = JSON.stringify(report);
        document.body.appendChild(reportNode);

        window.__microbookLayoutReport = report;
        return report;
      }

      const initialWordCount = totalWords;
      let wordsPlaced = 0;
      let blocks = createNewPage(initialWordCount, initialWordCount);
      let currentBlockIndex = 0;
      let currentBlock = blocks[currentBlockIndex];
      let lastPlacedToken = null;

      const isHeadingVariant = (variant) => typeof variant === 'string' && variant.startsWith('heading-');

      for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
        const token = tokens[tokenIndex];
        let placed = false;
        let retries = 0;

        while (!placed && retries < 32) {
          const prevToken = tokenIndex > 0 ? tokens[tokenIndex - 1] : null;
          const nextToken = tokenIndex < tokens.length - 1 ? tokens[tokenIndex + 1] : null;
          const isHeadingBoundaryBreak = token.type === 'break'
            && token.variant === 'paragraph'
            && (isHeadingVariant(prevToken?.variant) || isHeadingVariant(nextToken?.variant));

          const shouldAddLeadingSpace = !isHeadingBoundaryBreak
            && shouldInsertLeadingSpace(lastPlacedToken, token);
          let spacerNode = null;
          if (shouldAddLeadingSpace) {
            spacerNode = document.createTextNode(' ');
            currentBlock.appendChild(spacerNode);
          }

          const node = isHeadingBoundaryBreak
            ? (() => {
                const br = document.createElement('br');
                br.className = 'token-break token-break-paragraph';
                return br;
              })()
            : buildNode(token);
          currentBlock.appendChild(node);

          if (currentBlock.scrollHeight <= currentBlock.clientHeight) {
            placed = true;
            lastPlacedToken = token;
            if (token.type === 'word') {
              wordsPlaced += 1;
              const miniPercent = currentBlock.querySelector('.miniSheetNumPrecentage');
              if (miniPercent && initialWordCount > 0) {
                miniPercent.textContent = ` ${Math.round((wordsPlaced / initialWordCount) * 100)}%`;
              }
            }
            continue;
          }

          if (spacerNode) {
            spacerNode.remove();
          }
          node.remove();
          currentBlockIndex += 1;

          if (currentBlockIndex >= blocks.length) {
            blocks = createNewPage(initialWordCount, Math.max(initialWordCount - wordsPlaced, 0));
            currentBlockIndex = blocks.length - 16;
          }

          currentBlock = blocks[currentBlockIndex];
          lastPlacedToken = null;
          retries += 1;

          if (token.type === 'break' && token.variant === 'paragraph') {
            placed = true;
          }
        }
      }

      if (currentBlock) {
        const endMarker = document.createElement('div');
        endMarker.textContent = 'THE END';
        endMarker.style.textAlign = 'center';
        endMarker.style.fontWeight = 'bold';
        endMarker.style.fontSize = '1.6em';
        endMarker.style.marginTop = '10px';
        currentBlock.appendChild(endMarker);
      }

      const sheetsAmount = Math.ceil(pageIndex / 2);
      isCurrentPageFront = true;
      for (let i = 0; i < pageIndex; i += 1) {
        const sideIndicator = isCurrentPageFront ? '' : 'b';
        const sheetNum = `${Math.ceil((i + 1) / 2)}/${sheetsAmount}`;
        const miniSheetNum = `${Math.ceil((i + 1) / 2)}${sideIndicator}/${sheetsAmount}`;

        const miniSheetNums = document.querySelectorAll(`.miniSheetNum${i}`);
        miniSheetNums.forEach((el) => {
          el.textContent = miniSheetNum;
        });

        if (isCurrentPageFront && i !== 0) {
          const sheetNode = document.querySelector(`#sheetNum${i}`);
          if (sheetNode) {
            sheetNode.textContent = sheetNum;
          }
        }

        isCurrentPageFront = !isCurrentPageFront;
      }

      const allGridItems = document.querySelectorAll('.grid-item');
      Array.from(allGridItems).slice(-15).forEach((block) => {
        const cloneBlock = block.cloneNode(true);
        const spanElement = cloneBlock.querySelector('.miniSheetNum');
        if (spanElement) {
          spanElement.remove();
        }

        if (cloneBlock.textContent.trim() === '') {
          block.remove();
        }
      });

      runPretextLayoutOptimization();
    }, {
      tokens,
      bookName,
      headerInfo: resolvedHeaderInfo,
      totalWords: normalizedWordCount,
      foldGaps,
    });

    if (runningJobs.get(id)?.cancelled) {
      return;
    }

    progressService.writeProgress(id, {
      step: 'Finalizing page layout',
      percentage: 95,
      isComplete: false,
      isError: false,
      phase: 'layout',
    });

    const layoutReport = await page.evaluate(() => window.__microbookLayoutReport || null);
    const pageCount = await page.evaluate(() => document.querySelectorAll('.page').length);
    const estimatedSheets = Math.ceil(pageCount / 2);
    let finalMetadata = {
      ...metadata,
      bookName,
      foldGaps,
      wordCount: normalizedWordCount,
      sheetsCount: resolvedSheetsCount,
      readTime: resolvedReadTime,
    };

    if (layoutReport) {
      layoutReport.pageCount = pageCount;
      layoutReport.sheetCount = estimatedSheets;
      layoutReport.estimatedCellsPerSheet = 32;
      layoutReport.estimatedLinesPerSheet = estimatedSheets > 0
        ? Number((layoutReport.estimatedLines / estimatedSheets).toFixed(2))
        : 0;

      finalMetadata = {
        ...finalMetadata,
        layout: layoutReport,
      };

      progressService.writeProgress(id, {
        step: `Pretext optimized ${layoutReport.verticallyJustifiedBlocks}/${layoutReport.analyzedBlocks} cells`,
        percentage: 95,
        isComplete: false,
        isError: false,
        phase: 'layout',
      });
    }

    progressService.writeProgress(id, {
      step: `Created ${estimatedSheets} sheets`,
      percentage: 96,
      currentSheet: estimatedSheets,
      totalSheets: estimatedSheets,
      isComplete: false,
      isError: false,
      phase: 'page_creation',
    });

    writeLegacyProgress(id, 'Finished creating pages. Writing to file...');
    progressService.writeProgress(id, progressService.createPdfProgress());

    const htmlContent = await page.content();
    fs.writeFileSync(path.join(generatedDir, `output_${id}.html`), htmlContent);

    progressService.writeProgress(id, {
      step: 'Capturing preview screenshot',
      percentage: 97,
      isComplete: false,
      isError: false,
      phase: 'preview',
    });

    try {
      finalMetadata = {
        ...finalMetadata,
        screenshots: await captureFirstPageScreenshot(page, {
          id,
          generatedDir,
        }),
      };
    } catch (screenshotError) {
      console.warn(`Failed to capture screenshot for job ${id}:`, screenshotError);
      finalMetadata = {
        ...finalMetadata,
        screenshotError: screenshotError?.message || String(screenshotError),
      };
    }

    fs.writeFileSync(metadataPath, JSON.stringify(finalMetadata, null, 2));

    if (runningJobs.get(id)?.cancelled) {
      return;
    }

    progressService.writeProgress(id, {
      step: 'Rendering PDF document',
      percentage: 98,
      isComplete: false,
      isError: false,
      phase: 'rendering',
    });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      timeout: 120000,
      omitBackground: false,
    });

    if (runningJobs.get(id)?.cancelled) {
      return;
    }

    fs.writeFileSync(pdfPath, pdf);

    progressService.writeProgress(id, progressService.createCompletionProgress());

    setTimeout(() => {
      progressService.cleanupProgress(id);
      if (fs.existsSync(inProgressPath)) {
        fs.unlinkSync(inProgressPath);
      }
    }, 5000);
  } catch (error) {
    console.error(error);
    progressService.writeProgress(id, progressService.createErrorProgress(error.toString(), 'generation'));
    writeLegacyProgress(id, `ERROR: ${error.toString()}`);
  } finally {
    try {
      if (page) {
        await page.close();
      }
    } catch (pageCloseError) {
      console.error(`Error closing page for job ${id}:`, pageCloseError);
    }

    try {
      if (browser) {
        await browser.close();
      }
    } catch (browserCloseError) {
      console.error(`Error closing browser for job ${id}:`, browserCloseError);
    }

    runningJobs.delete(id);
  }
}

app.get('/api/capabilities', (req, res) => {
  res.json(capabilities);
});

app.get('/api/debug/running-jobs', (req, res) => {
  const jobs = Array.from(runningJobs.entries()).map(([id, job]) => ({
    id,
    cancelled: job.cancelled,
    status: job.status,
    hasBrowser: !!job.browser,
  }));

  res.json({
    runningJobs: jobs,
    count: jobs.length,
    queue: jobQueue.getSnapshot(),
  });
});

app.post('/api/upload', upload.fields([{ name: 'file' }]), (req, res) => {
  try {
    if (!req.files || !req.files.file || !req.files.file[0]) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const uploadedFile = req.files.file[0];
    const params = JSON.parse(req.body.params || '{}');
    const fontFamily = resolveFontFamily(params.fontFamily || params?.headerInfo?.fontFamily || defaultFontFamily, {
      allowedValues: supportedFontValues,
    });
    const borderStyle = normalizeBorderStyle(params.borderStyle);

    const id = generateJobId();
    const bookName = normalizeDisplayBookName(
      params.bookName || path.basename(uploadedFile.originalname, path.extname(uploadedFile.originalname)),
      'Untitled'
    );
    const fontSize = String(params?.headerInfo?.fontSize || '6');
    const requestedWordCount = Number(params?.headerInfo?.wordCount || 0);
    const requestedSheetsCount = Number(params?.headerInfo?.sheetsCount || 0);
    const requestedReadTime = params?.headerInfo?.readTime || '--';
    const foldGaps = normalizeBoolean(params.foldGaps, false);

    const jobMetadata = {
      id,
      bookName,
      borderStyle,
      fontSize,
      fontFamily,
      foldGaps,
      author: params?.headerInfo?.author || null,
      year: params?.headerInfo?.year || null,
      series: params?.headerInfo?.series || null,
      wordCount: requestedWordCount,
      sheetsCount: requestedSheetsCount || calculateSheetsCount(requestedWordCount, fontSize),
      readTime: requestedReadTime !== '--' ? requestedReadTime : calculateReadingTime(requestedWordCount),
      createdAt: new Date().toISOString(),
      originalFileName: uploadedFile.originalname,
      uploadPath: path.basename(uploadedFile.path),
      mimeType: uploadedFile.mimetype,
    };

    const { metadataPath } = getProgressPaths(id);
    fs.writeFileSync(metadataPath, JSON.stringify(jobMetadata, null, 2));

    setQueuedProgress(id, bookName);

    runningJobs.set(id, {
      browser: null,
      cancelled: false,
      status: 'queued',
    });

    const executionPayload = {
      id,
      params: {
        ...params,
        bookName,
        borderStyle,
        fontFamily,
        foldGaps,
        headerInfo: {
          ...params.headerInfo,
          fontSize,
          author: params?.headerInfo?.author || null,
          year: params?.headerInfo?.year || null,
          series: params?.headerInfo?.series || null,
          sheetsCount: String(requestedSheetsCount || calculateSheetsCount(requestedWordCount, fontSize)),
          readTime: requestedReadTime !== '--' ? requestedReadTime : calculateReadingTime(requestedWordCount),
        },
      },
      uploadFile: uploadedFile,
      metadata: jobMetadata,
    };

    jobQueue.enqueue(id, async () => {
      const state = runningJobs.get(id);
      if (!state || state.cancelled) {
        runningJobs.delete(id);
        return;
      }

      runningJobs.set(id, {
        ...state,
        status: 'running',
      });

      await executePdfJob(executionPayload);
    });

    res.json({ message: 'PDF creation started.', id });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(400).json({
      error: 'Failed to start generation',
      message: error.message,
    });
  }
});

app.get('/api/progress/:id', (req, res) => {
  const { id } = req.params;
  const { pdfPath, inProgressPath } = getProgressPaths(id);

  try {
    if (fs.existsSync(pdfPath)) {
      res.json({
        status: 'completed',
        progress: {
          step: 'Complete',
          percentage: 100,
          isComplete: true,
          isError: false,
          phase: 'complete',
        },
      });
      return;
    }

    const structuredProgress = progressService.readProgress(id);
    if (structuredProgress) {
      res.json({
        status: structuredProgress.isError
          ? 'error'
          : structuredProgress.isComplete
            ? 'completed'
            : 'in_progress',
        progress: structuredProgress,
        message: structuredProgress.isError ? structuredProgress.errorMessage : undefined,
      });
      return;
    }

    if (fs.existsSync(inProgressPath)) {
      const legacyText = fs.readFileSync(inProgressPath, 'utf8');
      if (legacyText.startsWith('ERROR:')) {
        res.json({
          status: 'error',
          message: legacyText.replace('ERROR: ', ''),
        });
        return;
      }

      res.json({
        status: 'in_progress',
        progress: progressService.parseLegacyProgress(legacyText),
      });
      return;
    }

    if (runningJobs.get(id)?.status === 'queued' || jobQueue.isQueued(id)) {
      res.json({
        status: 'in_progress',
        progress: {
          step: 'Queued',
          percentage: 0,
          isComplete: false,
          isError: false,
          phase: 'queued',
        },
      });
      return;
    }

    res.json({
      status: 'not_found',
      message: 'Generation not found or has not started yet.',
    });
  } catch (error) {
    console.error(`Error checking progress for ID: ${id}`, error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error while checking progress',
    });
  }
});

app.get('/api/jobs', (req, res) => {
  try {
    fs.mkdirSync(generatedDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });

    const files = fs.readdirSync(generatedDir);
    const ids = new Set();

    files.forEach((file) => {
      if (file.endsWith('.pdf')) {
        ids.add(file.replace('.pdf', ''));
      }
      if (file.startsWith('IN_PROGRESS_') && file.endsWith('.txt')) {
        ids.add(file.replace('IN_PROGRESS_', '').replace('.txt', ''));
      }
      if (file.startsWith('PROGRESS_') && file.endsWith('.json')) {
        ids.add(file.replace('PROGRESS_', '').replace('.json', ''));
      }
      if (file.startsWith('METADATA_') && file.endsWith('.json')) {
        ids.add(file.replace('METADATA_', '').replace('.json', ''));
      }
    });

    runningJobs.forEach((_, id) => ids.add(id));

    const jobs = Array.from(ids).map((id) => {
      const { pdfPath, inProgressPath, structuredProgressPath } = getProgressPaths(id);
      const metadata = readMetadata(id) || {};

      let status = 'queued';
      let progress = {
        step: 'Queued',
        percentage: 0,
        isComplete: false,
        isError: false,
      };

      let completedAt = null;

      if (fs.existsSync(pdfPath)) {
        status = 'completed';
        const stats = fs.statSync(pdfPath);
        completedAt = stats.mtime.toISOString();
        progress = {
          step: 'Complete',
          percentage: 100,
          isComplete: true,
          isError: false,
        };
      } else {
        const structuredProgress = progressService.readProgress(id);
        if (structuredProgress) {
          status = structuredProgress.isError ? 'error' : (structuredProgress.isComplete ? 'completed' : 'in_progress');
          progress = structuredProgress;
        } else if (fs.existsSync(inProgressPath)) {
          const progressText = fs.readFileSync(inProgressPath, 'utf8');
          if (progressText.startsWith('ERROR:')) {
            status = 'error';
            progress = {
              step: 'Error',
              percentage: 0,
              isComplete: false,
              isError: true,
              errorMessage: progressText.replace('ERROR: ', ''),
            };
          } else {
            status = 'in_progress';
            progress = progressService.parseLegacyProgress(progressText);
          }
        } else if (runningJobs.get(id)?.status === 'running') {
          status = 'in_progress';
          progress = {
            step: 'Processing',
            percentage: 1,
            isComplete: false,
            isError: false,
          };
        } else if (runningJobs.get(id)?.status === 'queued' || jobQueue.isQueued(id)) {
          status = 'queued';
        }
      }

      const createdAt = metadata.createdAt || (() => {
        if (fs.existsSync(structuredProgressPath)) {
          return fs.statSync(structuredProgressPath).mtime.toISOString();
        }
        if (fs.existsSync(inProgressPath)) {
          return fs.statSync(inProgressPath).mtime.toISOString();
        }
        if (fs.existsSync(pdfPath)) {
          return fs.statSync(pdfPath).mtime.toISOString();
        }
        return new Date().toISOString();
      })();

      return {
        id,
        bookName: metadata.bookName || 'Unknown',
        fontSize: metadata.fontSize || '6',
        fontFamily: resolveFontFamily(metadata.fontFamily || defaultFontFamily, {
          allowedValues: supportedFontValues,
        }),
        borderStyle: metadata.borderStyle || 'dashed',
        author: metadata.author || null,
        year: metadata.year || null,
        series: metadata.series || null,
        foldGaps: Boolean(metadata.foldGaps),
        status,
        progress,
        createdAt,
        completedAt,
        originalFileName: metadata.originalFileName || null,
        uploadPath: metadata.uploadPath || null,
        screenshots: metadata.screenshots || null,
      };
    });

    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: error.message,
    });
  }
});

app.get('/api/jobs/:id/screenshot', (req, res) => {
  const { id } = req.params;
  const artifacts = getScreenshotArtifactPaths({ id, generatedDir });

  if (!fs.existsSync(artifacts.firstPage.path)) {
    res.status(404).json({
      error: 'Screenshot not found',
      message: `No first-page screenshot found for job ID: ${id}`,
    });
    return;
  }

  res.redirect(artifacts.firstPage.url);
});

app.get('/api/download', (req, res) => {
  const { id } = req.query;
  const { pdfPath, inProgressPath } = getProgressPaths(String(id));

  if (fs.existsSync(pdfPath)) {
    res.redirect(`/history/${id}.pdf`);
    return;
  }

  if (fs.existsSync(inProgressPath)) {
    res.send(fs.readFileSync(inProgressPath, 'utf8'));
    return;
  }

  res.send('Not started. It\'s either in the queue, or failed entirely.');
});

app.delete('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const runningJob = runningJobs.get(id);
    let cancelled = false;

    if (runningJob) {
      runningJob.cancelled = true;
      cancelled = true;

      if (runningJob.status === 'queued') {
        jobQueue.remove(id);
      }

      if (runningJob.browser) {
        try {
          await runningJob.browser.close();
        } catch (browserError) {
          console.error(`Error closing browser for job ${id}:`, browserError);
        }
      }

      runningJobs.delete(id);
    } else if (jobQueue.remove(id)) {
      cancelled = true;
    }

    const { pdfPath, inProgressPath, structuredProgressPath, metadataPath } = getProgressPaths(id);
    const screenshotArtifacts = getScreenshotArtifactPaths({ id, generatedDir });

    const metadata = readMetadata(id);
    const uploadPath = metadata?.uploadPath ? path.join(uploadsDir, metadata.uploadPath) : null;

    const deletedFiles = [];
    const errors = [];

    const deleteFileIfExists = (filePath, label) => {
      if (!filePath || !fs.existsSync(filePath)) {
        return;
      }

      try {
        fs.unlinkSync(filePath);
        deletedFiles.push(label);
      } catch (error) {
        errors.push(`Failed to delete ${label}: ${error.message}`);
      }
    };

    deleteFileIfExists(pdfPath, 'PDF');
    deleteFileIfExists(inProgressPath, 'progress file');
    deleteFileIfExists(structuredProgressPath, 'structured progress file');
    deleteFileIfExists(metadataPath, 'metadata file');
    deleteFileIfExists(uploadPath, 'original upload');
    deleteFileIfExists(screenshotArtifacts.firstPage.path, 'preview screenshot');

    if (deletedFiles.length === 0 && errors.length === 0 && !cancelled) {
      res.status(404).json({
        error: 'Job not found',
        message: `No files found for job ID: ${id}`,
      });
      return;
    }

    if (errors.length > 0) {
      res.status(207).json({
        message: `Job partially deleted.${cancelled ? ' Job cancelled.' : ''} Deleted: ${deletedFiles.join(', ')}`,
        deletedFiles,
        errors,
        cancelled,
      });
      return;
    }

    res.json({
      message: `Job deleted successfully.${cancelled ? ' Job cancelled.' : ''} Deleted: ${deletedFiles.join(', ')}`,
      deletedFiles,
      cancelled,
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({
      error: 'Failed to delete job',
      message: error.message,
    });
  }
});

app.use('/history', express.static(generatedDir));
app.use('/uploads', express.static(uploadsDir));

app.use((error, req, res, next) => {
  if (!error) {
    next();
    return;
  }

  if (error.message && error.message.startsWith('Unsupported file format')) {
    res.status(400).json({
      error: 'Invalid file format',
      message: error.message,
    });
    return;
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      error: 'File too large',
      message: 'File size must be less than 10MB',
    });
    return;
  }

  res.status(500).json({
    error: 'Unexpected server error',
    message: error.message || 'Unknown error',
  });
});

app.listen(port, () => {
  console.log(`Listening on port ${port} with queue concurrency ${queueConcurrency}`);
});
