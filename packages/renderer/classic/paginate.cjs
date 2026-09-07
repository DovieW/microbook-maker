// Browser paginator from 43f3a28. Optional word batching must match the original PDF fixtures.
module.exports = async (payload) => {
      const {
        tokens,
        bookName,
        headerInfo,
        totalWords,
        foldGaps,
        optimizationLimits,
        batchWords = false,
        justifyAllCells = false,
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

      function collapseWhitespace(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
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

      function getMergeableTextContainer(block, token) {
        if (token?.type !== 'word') {
          return null;
        }

        const lastElementChild = block.lastElementChild;
        if (!lastElementChild || lastElementChild.tagName !== 'SPAN') {
          return null;
        }

        if (lastElementChild.childElementCount > 0) {
          return null;
        }

        if (lastElementChild.className !== buildTokenClass(token)) {
          return null;
        }

        return lastElementChild;
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
        const maxBlocks = Number.isFinite(Number(optimizationLimits?.maxBlocks))
          ? Number(optimizationLimits.maxBlocks)
          : 320;
        const maxDurationMs = Number.isFinite(Number(optimizationLimits?.maxDurationMs))
          ? Number(optimizationLimits.maxDurationMs)
          : 4000;
        let stopReason = null;

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
          if (stopReason) {
            return;
          }

          if (analyzedBlocks >= maxBlocks) {
            stopReason = `Reached optimization block budget (${maxBlocks}).`;
            return;
          }

          if ((performance.now() - startedAt) >= maxDurationMs) {
            stopReason = `Reached optimization time budget (${maxDurationMs}ms).`;
            return;
          }

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

        // Horizontal alignment is a print invariant, not an optional Pretext optimization.
        // Run after pagination so this cannot change word allocation or folding order. Do not
        // add the legacy class here: it also changes link wrapping and hyphenation.
        if (justifyAllCells) {
          for (const block of populatedBlocks) {
            block.style.setProperty('--microbook-text-align', 'justify');
            block.querySelectorAll('.main-header').forEach((header) => {
              header.style.textAlign = 'left';
              header.style.textAlignLast = 'left';
            });
            if (block.dataset.microbookContinuation === 'true') {
              // Only the trailing inline flow continues in the next cell. Isolate it
              // so text-align-last does not stretch earlier headings or forced breaks.
              let start = block.firstChild;
              for (const child of block.children) {
                if (child.matches('br, .main-header, .token-separator')) start = child.nextSibling;
              }
              if (start) {
                const continuation = document.createElement('div');
                continuation.className = 'microbook-continuation';
                continuation.style.textAlignLast = 'justify';
                block.appendChild(continuation);
                while (start && start !== continuation) {
                  const next = start.nextSibling;
                  continuation.appendChild(start);
                  start = next;
                }
              }
            }
          }
          horizontallyJustifiedBlocks = populatedBlocks.length;
        }

        const report = {
          engine: 'pretext',
          pretextVersion: api.version || 'unknown',
          analyzedBlocks,
          populatedBlocks: populatedBlocks.length,
          skippedBlocks: Math.max(0, populatedBlocks.length - analyzedBlocks),
          truncated: Boolean(stopReason),
          stopReason,
          verticallyJustifiedBlocks,
          horizontallyJustifiedBlocks,
          horizontalJustification: justifyAllCells ? 'all-cells' : 'legacy-heuristic',
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
      const tokenYieldInterval = 400;
      let lastBatchYield = performance.now();

      const isHeadingVariant = (variant) => typeof variant === 'string' && variant.startsWith('heading-');

      for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
        if (tokenIndex > 0 && tokenIndex % tokenYieldInterval === 0) {
          // Large novels can spend minutes in this loop. Yield periodically so Chromium can
          // service its event loop and garbage collect instead of treating the renderer like
          // a hostage situation.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const token = tokens[tokenIndex];
        // Batch only words the original loop would merge into the same span. At a cell
        // boundary, find the final fitting prefix, then let the original loop place the
        // next token. Breaks, links, style changes, headers, and cell order keep their
        // original path. Omitting batchWords retains the reference implementation.
        const batchTarget = batchWords ? getMergeableTextContainer(currentBlock, token) : null;
        if (batchTarget) {
          const before = batchTarget.textContent;
          const miniPercent = currentBlock.querySelector('.miniSheetNumPrecentage');
          const beforePercent = miniPercent?.textContent;
          const prefixes = [];
          let text = '';
          let previous = lastPlacedToken;
          for (let nextIndex = tokenIndex; nextIndex < Math.min(tokens.length, tokenIndex + 256); nextIndex += 1) {
            const next = tokens[nextIndex];
            if (getMergeableTextContainer(currentBlock, next) !== batchTarget) break;
            text += `${shouldInsertLeadingSpace(previous, next) ? ' ' : ''}${collapseWhitespace(next.text)}`;
            prefixes.push(text);
            previous = next;
          }
          const fits = (count) => {
            batchTarget.textContent = before + prefixes[count - 1];
            // The original loop measures before updating the current word's percentage.
            if (miniPercent && initialWordCount > 0)
              miniPercent.textContent = ` ${Math.round(((wordsPlaced + count - 1) / initialWordCount) * 100)}%`;
            return currentBlock.scrollHeight <= currentBlock.clientHeight;
          };
          if (prefixes.length > 1) {
            let low = 0;
            let high = prefixes.length;
            if (fits(high)) low = high;
            else {
              while (low + 1 < high) {
                const middle = Math.floor((low + high) / 2);
                if (fits(middle)) low = middle;
                else high = middle;
              }
            }
            if (low > 0) {
              batchTarget.textContent = before + prefixes[low - 1];
              wordsPlaced += low;
              tokenIndex += low - 1;
              lastPlacedToken = tokens[tokenIndex];
              if (miniPercent && initialWordCount > 0)
                miniPercent.textContent = ` ${Math.round((wordsPlaced / initialWordCount) * 100)}%`;
              if (performance.now() - lastBatchYield > 40) {
                await new Promise((resolve) => setTimeout(resolve, 0));
                lastBatchYield = performance.now();
              }
              continue;
            }
          }
          batchTarget.textContent = before;
          if (miniPercent) miniPercent.textContent = beforePercent;
        }
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

          // Most novels are overwhelmingly plain body text. Merging adjacent word tokens into
          // the same span keeps the DOM orders of magnitude smaller than one-span-per-word,
          // which directly reduces Chromium renderer memory pressure on the NAS.
          const mergeTarget = !isHeadingBoundaryBreak
            ? getMergeableTextContainer(currentBlock, token)
            : null;

          let spacerNode = null;
          let node = null;
          let rollbackPlacement = null;

          if (mergeTarget) {
            const previousTextContent = mergeTarget.textContent;
            mergeTarget.textContent = `${previousTextContent}${shouldAddLeadingSpace ? ' ' : ''}${collapseWhitespace(token.text)}`;
            rollbackPlacement = () => {
              mergeTarget.textContent = previousTextContent;
            };
          } else {
            if (shouldAddLeadingSpace) {
              spacerNode = document.createTextNode(' ');
              currentBlock.appendChild(spacerNode);
            }

            node = isHeadingBoundaryBreak
              ? (() => {
                  const br = document.createElement('br');
                  br.className = 'token-break token-break-paragraph';
                  return br;
                })()
              : buildNode(token);
            currentBlock.appendChild(node);
            rollbackPlacement = () => {
              if (spacerNode) {
                spacerNode.remove();
              }
              if (node) {
                node.remove();
              }
            };
          }

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

          rollbackPlacement();
          if (justifyAllCells) {
            // A word spilling over is a continuation; a structural break is an ending.
            currentBlock.dataset.microbookContinuation = String(isTextLikeToken(token));
          }
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

      await new Promise((resolve) => setTimeout(resolve, 0));
      runPretextLayoutOptimization();
    };
