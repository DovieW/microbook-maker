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
const { buildTokenStyles } = require('./pipeline/render/tokenStyles');
const {
  generateJobId,
  getSafeUploadFilename,
  sanitizeFileComponent,
} = require('./utils/fileUtils');
const { getPuppeteerLaunchOptions } = require('./utils/browserUtils');

const app = express();
const port = 3001;
const queueConcurrency = Number(process.env.JOB_QUEUE_CONCURRENCY || 1);
const jobQueue = new JobQueueService({ concurrency: queueConcurrency });
const capabilities = getCapabilities();
const supportedFormatSet = new Set(capabilities.acceptedFormats);
const supportedFontValues = new Set(capabilities.fontOptions.map((option) => option.value));
const defaultFontFamily = capabilities.defaults.fontFamily;

const generatedDir = path.join(__dirname, 'generated');
const uploadsDir = path.join(__dirname, 'uploads');

fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

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
  const { bookName, borderStyle, fontFamily } = params;
  const { fontSize, author, year, series } = params.headerInfo;
  const resolvedFontFamily = resolveFontFamily(fontFamily, {
    allowedValues: supportedFontValues,
  });
  const selectedFontStack = getFontStack(resolvedFontFamily, {
    allowedValues: supportedFontValues,
  });

  let browser = null;
  let page = null;
  const { inProgressPath, pdfPath } = getProgressPaths(id);

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

      writeLegacyProgress(id, `Creating sheet ${index / 2} of ${params.headerInfo.sheetsCount}-ish.`);
    });

    const fontSizeNumber = Number(fontSize) || 6;

    await page.goto(`file://${path.join(__dirname, 'page.html')}`);
    await page.addStyleTag({ content: `body { font-size: ${fontSizeNumber}px; }` });
    await page.addStyleTag({
      content: buildTokenStyles({
        selectedFontStack,
        borderStyle,
      }),
    });

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
      } = payload;

      let pageIndex = 0;
      let isCurrentPageFront = true;

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
                titleCell.innerHTML += ` - ${bookName}`;
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

                cell.innerHTML = `<b>${property.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</b> ${value}`;
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

              cell.innerHTML = `${Intl.NumberFormat().format(wordsLeft)} Words - ${percentageCompleted}% Complete - ${timeText}`;
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
          breakSpan.textContent = '    ';
          return breakSpan;
        }

        if (token.type === 'link') {
          if (token.isImage) {
            const imageLink = document.createElement('span');
            imageLink.className = `${buildTokenClass(token)} token-link-image`;
            imageLink.textContent = token.text || 'Image';
            return imageLink;
          }

          if (token.isBareUrl) {
            const plain = document.createElement('span');
            plain.className = `${buildTokenClass(token)} token-link-bare`;
            plain.textContent = `${token.url}`;
            return plain;
          }

          const container = document.createElement('span');
          container.className = buildTokenClass(token);

          const label = document.createElement('span');
          label.className = 'token-link-label';
          label.textContent = token.text || token.url;

          const url = document.createElement('span');
          url.className = 'token-link-url';
          url.textContent = token.url ? ` (${token.url})` : '';

          container.appendChild(label);
          container.appendChild(url);
          return container;
        }

        const span = document.createElement('span');
        span.className = buildTokenClass(token);
        span.textContent = `${token.text}`;
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
        endMarker.innerHTML = 'THE END';
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
    }, {
      tokens,
      bookName,
      headerInfo: {
        wordCount: normalizedDocument.wordCount,
        readTime: metadata.readTime,
        author,
        year,
        series,
        fontSize,
      },
      totalWords: normalizedDocument.wordCount,
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

    const pageCount = await page.evaluate(() => document.querySelectorAll('.page').length);
    const estimatedSheets = Math.ceil(pageCount / 2);

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

    const id = generateJobId();
    const bookName = sanitizeFileComponent(params.bookName || path.basename(uploadedFile.originalname, path.extname(uploadedFile.originalname)), 'Untitled');

    const jobMetadata = {
      id,
      bookName,
      borderStyle: params.borderStyle || 'dashed',
      fontSize: String(params?.headerInfo?.fontSize || '6'),
      fontFamily,
      author: params?.headerInfo?.author || null,
      year: params?.headerInfo?.year || null,
      series: params?.headerInfo?.series || null,
      wordCount: Number(params?.headerInfo?.wordCount || 0),
      readTime: params?.headerInfo?.readTime || '--',
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
        borderStyle: params.borderStyle || 'dashed',
        fontFamily,
        headerInfo: {
          ...params.headerInfo,
          fontSize: String(params?.headerInfo?.fontSize || '6'),
          author: params?.headerInfo?.author || null,
          year: params?.headerInfo?.year || null,
          series: params?.headerInfo?.series || null,
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
        status,
        progress,
        createdAt,
        completedAt,
        originalFileName: metadata.originalFileName || null,
        uploadPath: metadata.uploadPath || null,
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
