const fs = require('fs');
const multer = require('multer');
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const port = 3001;
const path = require('path');
const progressService = require('./services/progressService');

// Job tracking system for cancellation
const runningJobs = new Map(); // jobId -> { browser, cancelled: boolean }
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function(req, file, cb) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const formattedDate = `${year}${month}${day}${hour}${minute}${second}`;
    const fileName = `${formattedDate}_${file.originalname}`;
    cb(null, fileName);
  }
});
const upload = multer({ storage: storage });

// Debug endpoint to see running jobs
app.get('/api/debug/running-jobs', (req, res) => {
  const jobs = Array.from(runningJobs.entries()).map(([id, job]) => ({
    id,
    cancelled: job.cancelled,
    hasBrowser: !!job.browser
  }));
  res.json({ runningJobs: jobs, count: jobs.length });
});

app.post('/api/upload', upload.fields([{name: 'file'}]), (req, res) => {
  const json = JSON.parse(req.body.params);
  const {bookName, borderStyle} = json;
  const {fontSize, sheetsCount, author, year, series} = json.headerInfo;

  const date = new Date();
  const year_date = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const id = `${year_date}${month}${day}${hour}${minute}${second}_${bookName}_${fontSize}`;

  // Store job metadata
  const jobMetadata = {
    id,
    bookName,
    borderStyle,
    fontSize,
    author: author || null,
    year: year || null,
    series: series || null,
    createdAt: new Date().toISOString(),
    originalFileName: req.files.file && req.files.file[0] ? req.files.file[0].originalname : null
  };

  const metadataPath = path.join(__dirname, 'generated', `METADATA_${id}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(jobMetadata, null, 2));

  function writeToInProgress(text) {
    console.log(`${text}`);
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);
    fs.writeFileSync(inProgressPath, text);

    // Also write structured progress
    const structuredProgress = progressService.parseLegacyProgress(text);
    progressService.writeProgress(id, structuredProgress);
  }

  // Write initial progress
  const estimatedSheets = Math.ceil(json.headerInfo.wordCount / 250); // Rough estimate
  const initialProgress = progressService.createInitialProgress(bookName, estimatedSheets);
  progressService.writeProgress(id, initialProgress);

  setImmediate(async () => {
    try {
      await run(json, id, bookName, fontSize, borderStyle);
    } catch (error) {
      console.error(error);
      const errorProgress = progressService.createErrorProgress(error.toString(), 'generation');
      progressService.writeProgress(id, errorProgress);
      writeToInProgress('ERROR: ' + error.toString());
    } finally {
      // Clean up job tracking
      runningJobs.delete(id);
    }
  });

  async function run(json, id, bookName, fontSize, borderStyle) {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions', '--mute-audio'],
      protocolTimeout: 1000000,
      headless: true,
      devtools: false
    });

    // Track this job for potential cancellation
    runningJobs.set(id, { browser, cancelled: false });

    // Check if job was cancelled before we started
    if (runningJobs.get(id)?.cancelled) {
      console.log(`Job ${id} was cancelled before processing started`);
      await browser.close();
      return;
    }

    // Update progress for browser launch
    console.log('Browser launched, updating progress to 15%');
    const browserProgress = {
      step: 'Setting up document processing',
      percentage: 15,
      isComplete: false,
      isError: false,
      phase: 'setup'
    };
    progressService.writeProgress(id, browserProgress);
    const page = await browser.newPage();
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);

    page.on('console', pageIndex => {
      const n = Number(pageIndex.text());
      if (isNaN(n)) {
        console.log(pageIndex.text());
        return;
      }
      const currentSheet = Math.ceil(n / 2);
      const progressInfo = progressService.createPageProgress(currentSheet, sheetsCount);
      progressService.writeProgress(id, progressInfo);
      writeToInProgress(`Creating sheet ${n / 2} of ${sheetsCount}-ish.`);
    });

    // await page.setViewport({ width: 816, height: 1056 });

    let text = fs.readFileSync(req.files.file[0].path, 'utf8');
    
    await page.goto(`file://${__dirname}/page.html`);
    
    await page.addStyleTag({content: `body { font-size: ${fontSize}px; }`});
    
    // Add dynamic border style
    await page.addStyleTag({content: `
      .grid-item:nth-child(4n-2), 
      .grid-item:nth-child(4n-1), 
      .grid-item:nth-child(4n-3) {
          border-right: 1px ${borderStyle || 'dashed'} black;
      }
      .grid-item:nth-child(n+5) {
          border-top: 1px ${borderStyle || 'dashed'} black;
      }
    `});

    // Check for cancellation before starting page creation
    if (runningJobs.get(id)?.cancelled) {
      console.log(`Job ${id} was cancelled during setup`);
      await browser.close();
      return;
    }

    writeToInProgress(`Creating: ${bookName}`);

    // Update progress for starting page creation
    const startPageProgress = {
      step: 'Creating document pages',
      percentage: 25,
      isComplete: false,
      isError: false,
      phase: 'page_creation'
    };
    progressService.writeProgress(id, startPageProgress);

    // Update progress for text processing start
    console.log('Starting text processing, updating progress to 35%');
    const textProcessingProgress = {
      step: 'Processing document text',
      percentage: 35,
      isComplete: false,
      isError: false,
      phase: 'text_processing'
    };
    progressService.writeProgress(id, textProcessingProgress);

    await page.evaluate((json, text, bookName) => {
      let pageIndex = 0;
      let isCurrentPageFront = true; // tracks whether the next page to be rendered is on the front of the double sided sheet. the side with the big header

      function createNewPage(readTime, initialWordCount, wordsLeft, headerInfo) {
        // Remove console.log that was causing floating "0" in UI
        // console.log(pageIndex+1);
        const percentageCompleted = Math.round((initialWordCount - wordsLeft) / initialWordCount * 100);
        const page = document.createElement('div');
        page.className = 'page';

        // create grid cells
        const grid = document.createElement('div');
        grid.className = 'grid-container';
        for (let i = 0; i < 16; i++) {
          const gridItem = document.createElement('div');
          gridItem.className = 'grid-item';

          // Determine padding classes for Improved Padding
          let paddingClass = '';
          // Rows
          if (i < 4) { // Row 1 (bottom padding)
            paddingClass += 'pad-bottom ';
          } else if (i >= 4 && i < 12) { // Rows 2 and 3 (top and bottom padding)
            paddingClass += 'pad-top pad-bottom ';
          } else { // Row 4 (top padding)
            paddingClass += 'pad-top ';
          }
          // Columns
          if (i % 4 === 1) { // Second cell from the left in each row, right padding for crease
            paddingClass += 'pad-right';
          } else if (i % 4 === 2) { // Third cell from the left in each row, left padding for crease
            paddingClass += 'pad-left';
          }
          gridItem.className += ` ${paddingClass}`;

          if (i === 0 && isCurrentPageFront) { // First cell on front page
            gridItem.id = 'header' + pageIndex;
            if (pageIndex === 0) { // Add main header on first page
              let mainHeader = document.createElement('div');
              mainHeader.classList.add('main-header');
              let table = document.createElement('table');
              mainHeader.appendChild(table);
              const mainHeaderTitleTr = document.createElement('tr');
              const mainHeaderTitleTd = document.createElement('td');
              mainHeaderTitleTd.setAttribute('colspan', '2');
              mainHeaderTitleTr.appendChild(mainHeaderTitleTd);
              mainHeaderTitleTd.classList.add('main-header-title');
              mainHeaderTitleTd.innerText = `${bookName}`;
              table.appendChild(mainHeaderTitleTd);

              let cellCount = 0;
              let currentRow;
              for (let property in headerInfo) {
                if (!headerInfo[property]) continue;
                if (cellCount === 0 || cellCount >= 2) {
                  currentRow = document.createElement('tr');
                  table.appendChild(currentRow);
                  cellCount = 0;
                }
                let cell = document.createElement('td');
                
                let value = headerInfo[property];
                if (property === 'wordCount') {
                  value = `${Intl.NumberFormat().format(wordsLeft)}`;
                }
                cell.innerHTML = `<b>${property.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</b> ${value}`;
                currentRow.appendChild(cell);
                cellCount++;
              }
              gridItem.appendChild(mainHeader);
            } else {
              let mainHeader = document.createElement('div');
              gridItem.appendChild(mainHeader);
              mainHeader.classList.add('main-header');
              let table = document.createElement('table');
              mainHeader.appendChild(table);
              const mainHeaderTitleTr = document.createElement('tr');
              const mainHeaderTitleTd = document.createElement('td');
              mainHeaderTitleTd.setAttribute('colspan', '2');
              mainHeaderTitleTr.appendChild(mainHeaderTitleTd);
              mainHeaderTitleTd.classList.add('main-header-title');
              let sheetNumSpan = document.createElement('span');
              sheetNumSpan.id = 'sheetNum' + pageIndex;
              sheetNumSpan.innerText = '00/00';
              mainHeaderTitleTd.appendChild(sheetNumSpan);
              if (bookName) mainHeaderTitleTd.innerHTML += ` - ${bookName}`;
              table.appendChild(mainHeaderTitleTd);

              let currentRow = document.createElement('tr');
              table.appendChild(currentRow);
              let cell = document.createElement('td');
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
          } else if (i % 4 === 0) { // if it's the first cell in a row, add mini header
            const miniSheetNumContainer = document.createElement('span');
            const miniSheetNum = document.createElement('span');
            const miniSheetNumPrecentage = document.createElement('span');
            miniSheetNumContainer.appendChild(miniSheetNum);
            miniSheetNumContainer.appendChild(miniSheetNumPrecentage);
            miniSheetNumPrecentage.classList.add('miniSheetNumPrecentage');
            miniSheetNum.classList.add('miniSheetNum' + pageIndex);
            miniSheetNumContainer.classList.add('miniSheetNum');
            miniSheetNum.textContent = '00/00';
            miniSheetNumPrecentage.textContent = ` 00%`;
            gridItem.appendChild(miniSheetNumContainer);
          }
          grid.appendChild(gridItem);
        }

        page.appendChild(grid);
        document.body.appendChild(page);
        isCurrentPageFront = !isCurrentPageFront;
        blocks = Array.from(document.querySelectorAll('.grid-item'));
        pageIndex++;
      }

      // Populate grid items with text
      const words = text.split(' ');
      const initialWordCount = words.length;
      let blocks = []; // Grid items
      createNewPage(json.headerInfo.readTime, initialWordCount, words.length, json.headerInfo); // Create first page
      let currentBlockIndex = 0;
      let currentBlock;
      currentBlock = blocks[currentBlockIndex];
      for (let i = 0; i < words.length; i++) {
        currentBlock.innerHTML += ' ' + words[i];
        const miniSheetNumPrecentage = currentBlock.querySelector(`.miniSheetNumPrecentage`);
        if (miniSheetNumPrecentage) {
          miniSheetNumPrecentage.textContent = ` ${Math.round((i + 1) / words.length * 100)}%`;
        }



        if (currentBlock.scrollHeight > currentBlock.clientHeight) { // If the word made the block overflow, remove it from the block
          currentBlock.innerHTML = currentBlock.innerHTML.slice(0, currentBlock.innerHTML.length - words[i].length);

          // Move to the next block
          currentBlockIndex++;
          if (currentBlockIndex >= blocks.length) { // Create a new page if all blocks are filled
            createNewPage(json.headerInfo.readTime, initialWordCount, words.length - i, json.headerInfo);
            currentBlockIndex = blocks.length - 16; // Reset the block index to the first block of the new page
          }
          currentBlock = blocks[currentBlockIndex];
          currentBlock.innerHTML += ' ' + words[i]; // Add the word to the new block
        }
      }
      if (currentBlock) { // Ensure currentBlock is defined
        const endMarker = document.createElement('div');
        endMarker.innerHTML = 'THE END';
        endMarker.style.textAlign = 'center';
        endMarker.style.fontWeight = 'bold';
        endMarker.style.fontSize = '1.75em';
        endMarker.style.marginTop = '10px';
        currentBlock.appendChild(endMarker);
      }

      // Populate headers
      const SHEETS_AMOUNT = Math.ceil(pageIndex / 2);
      isCurrentPageFront = true;
      for (let i = 0; i < pageIndex; i++) {
        const sideIndicator = isCurrentPageFront ? '' : 'b';
        const SHEET_NUM = `${Math.ceil((i+1) / 2)}/${SHEETS_AMOUNT}`;
        const MINI_SHEET_NUM = `${Math.ceil((i+1) / 2)}${sideIndicator}/${SHEETS_AMOUNT}`;
        let miniSheetNums = document.querySelectorAll('.miniSheetNum' + i);

        for(let i = 0; i < miniSheetNums.length; i++) {
          miniSheetNums[i].textContent = MINI_SHEET_NUM;
        }

        if (isCurrentPageFront && i !== 0) {
          document.querySelector('#sheetNum' + i).textContent = SHEET_NUM;
        }
        isCurrentPageFront = !isCurrentPageFront;
      }

      // remove empty grid items on final page
      const allGridItems = document.querySelectorAll('.grid-item');
      Array.from(allGridItems).slice(-15).forEach((block, index) => {
        const cloneBlock = block.cloneNode(true);
        const spanElement = cloneBlock.querySelector('.miniSheetNum');
        if (spanElement) {
          spanElement.remove();
        }
        if (cloneBlock.textContent.trim() === '') {
          block.remove();
        }
      });
    }, json, text, bookName);

    // Check for cancellation after page evaluation
    if (runningJobs.get(id)?.cancelled) {
      console.log(`Job ${id} was cancelled after page evaluation`);
      await browser.close();
      return;
    }

    console.log('Page evaluation completed, updating progress to 70%');
    // Update progress for page layout completion
    const layoutProgress = {
      step: 'Finalizing page layout',
      percentage: 70,
      isComplete: false,
      isError: false,
      phase: 'layout'
    };
    progressService.writeProgress(id, layoutProgress);

    // Get the final page count and update progress
    const pageCount = await page.evaluate(() => document.querySelectorAll('.page').length);
    const estimatedSheets = Math.ceil(pageCount / 2);

    // Update progress for page creation completion (85%)
    const pageCompletionProgress = {
      step: `Created ${estimatedSheets} sheets`,
      percentage: 85,
      currentSheet: estimatedSheets,
      totalSheets: estimatedSheets,
      isComplete: false,
      isError: false,
      phase: 'page_creation'
    };
    progressService.writeProgress(id, pageCompletionProgress);

    writeToInProgress('Finished creating pages. Writing to file...');

    // Update progress for PDF generation
    const pdfProgress = progressService.createPdfProgress();
    progressService.writeProgress(id, pdfProgress);

    let htmlContent = await page.content();
    fs.writeFileSync(path.join(__dirname, `output.html`), htmlContent);

    // Check for cancellation before PDF rendering
    if (runningJobs.get(id)?.cancelled) {
      console.log(`Job ${id} was cancelled before PDF rendering`);
      await browser.close();
      return;
    }

    // Update progress for PDF rendering
    const renderingProgress = {
      step: 'Rendering PDF document',
      percentage: 98,
      isComplete: false,
      isError: false,
      phase: 'rendering'
    };
    progressService.writeProgress(id, renderingProgress);

    const pdf = await page.pdf({ format: 'Letter' });

    // Final check for cancellation before writing PDF file
    if (runningJobs.get(id)?.cancelled) {
      console.log(`Job ${id} was cancelled before writing PDF file`);
      await browser.close();
      return;
    }

    const pdfOutput = path.join(__dirname, 'generated', `${id}.pdf`);
    fs.writeFileSync(pdfOutput, pdf);

    await browser.close();

    // Mark as complete
    const completionProgress = progressService.createCompletionProgress();
    progressService.writeProgress(id, completionProgress);

    // Clean up progress files after a delay to allow frontend to read completion
    setTimeout(() => {
      progressService.cleanupProgress(id);
      if (fs.existsSync(inProgressPath)) {
        fs.unlinkSync(inProgressPath);
      }
    }, 5000); // 5 second delay
  }
  
  res.json({ message: 'PDF creation started.', id });
});

// Dedicated progress endpoint
app.get('/api/progress/:id', (req, res) => {
  const { id } = req.params;

  const pdfOutput = path.join(__dirname, 'generated', `${id}.pdf`);
  const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);

  try {
    // Check if PDF is complete
    if (fs.existsSync(pdfOutput)) {
      res.json({
        status: 'completed',
        progress: {
          step: 'Complete',
          percentage: 100,
          isComplete: true,
          isError: false,
          phase: 'complete'
        }
      });
      return;
    }

    // Check for structured progress first
    const structuredProgress = progressService.readProgress(id);
    if (structuredProgress) {
      res.json({
        status: structuredProgress.isError ? 'error' :
                structuredProgress.isComplete ? 'completed' : 'in_progress',
        progress: structuredProgress,
        message: structuredProgress.isError ? structuredProgress.errorMessage : undefined
      });
      return;
    }

    // Fall back to legacy progress
    if (fs.existsSync(inProgressPath)) {
      const legacyText = fs.readFileSync(inProgressPath, 'utf8');

      // If it's an error message, return structured error
      if (legacyText.startsWith('ERROR:')) {
        res.json({
          status: 'error',
          message: legacyText.replace('ERROR: ', '')
        });
      } else {
        // Parse legacy progress and return structured format
        const parsedProgress = progressService.parseLegacyProgress(legacyText);
        res.json({
          status: 'in_progress',
          progress: parsedProgress
        });
      }
    } else {
      res.json({
        status: 'not_found',
        message: 'Generation not found or has not started yet.'
      });
    }
  } catch (error) {
    console.error(`Error checking progress for ID: ${id}`, error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error while checking progress'
    });
  }
});

// Get list of all jobs
app.get('/api/jobs', (req, res) => {
  try {
    const generatedDir = path.join(__dirname, 'generated');
    const uploadsDir = path.join(__dirname, 'uploads');

    // Ensure directories exist
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const jobs = [];
    const files = fs.readdirSync(generatedDir);
    const uploadFiles = fs.readdirSync(uploadsDir);

    // Create a map of upload files for quick lookup
    const uploadFileMap = {};
    uploadFiles.forEach(file => {
      // Extract timestamp from upload filename (YYYYMMDDHHMMSS_originalname)
      const match = file.match(/^(\d{14})_(.+)$/);
      if (match) {
        const timestamp = match[1];
        uploadFileMap[timestamp] = {
          originalName: match[2],
          uploadPath: file
        };
      }
    });

    // Track processed job IDs to avoid duplicates
    const processedJobs = new Set();

    // Process all files in generated directory
    files.forEach(file => {
      let jobId = null;
      let fileType = null;

      // Identify file type and extract job ID
      if (file.endsWith('.pdf')) {
        jobId = file.replace('.pdf', '');
        fileType = 'pdf';
      } else if (file.startsWith('IN_PROGRESS_') && file.endsWith('.txt')) {
        jobId = file.replace('IN_PROGRESS_', '').replace('.txt', '');
        fileType = 'progress';
      } else if (file.startsWith('PROGRESS_') && file.endsWith('.json')) {
        jobId = file.replace('PROGRESS_', '').replace('.json', '');
        fileType = 'structured_progress';
      }

      if (jobId && !processedJobs.has(jobId)) {
        processedJobs.add(jobId);

        // Parse job ID to extract metadata
        const jobParts = jobId.split('_');
        let timestamp = '';
        let bookName = '';
        let fontSize = '';

        if (jobParts.length >= 3) {
          timestamp = jobParts[0]; // YYYYMMDDHHMMSS
          fontSize = jobParts[jobParts.length - 1];
          bookName = jobParts.slice(1, -1).join('_');
        }

        // Get file stats
        const pdfPath = path.join(generatedDir, `${jobId}.pdf`);
        const progressPath = path.join(generatedDir, `IN_PROGRESS_${jobId}.txt`);
        const structuredProgressPath = path.join(generatedDir, `PROGRESS_${jobId}.json`);

        let status = 'unknown';
        let progress = null;
        let createdAt = null;
        let completedAt = null;

        // Determine status and get progress info
        if (fs.existsSync(pdfPath)) {
          status = 'completed';
          const pdfStats = fs.statSync(pdfPath);
          completedAt = pdfStats.mtime.toISOString();
          progress = {
            step: 'Complete',
            percentage: 100,
            isComplete: true,
            isError: false
          };
        } else {
          // Check for structured progress first
          const structuredProgress = progressService.readProgress(jobId);
          if (structuredProgress) {
            status = structuredProgress.isError ? 'error' :
                    structuredProgress.isComplete ? 'completed' : 'in_progress';
            progress = structuredProgress;
          } else if (fs.existsSync(progressPath)) {
            status = 'in_progress';
            const progressText = fs.readFileSync(progressPath, 'utf8');
            if (progressText.startsWith('ERROR:')) {
              status = 'error';
              progress = {
                step: 'Error',
                percentage: 0,
                isComplete: false,
                isError: true,
                errorMessage: progressText.replace('ERROR: ', '')
              };
            } else {
              progress = progressService.parseLegacyProgress(progressText);
            }
          } else {
            status = 'queued';
            progress = {
              step: 'Queued',
              percentage: 0,
              isComplete: false,
              isError: false
            };
          }
        }

        // Parse timestamp for creation date
        if (timestamp) {
          try {
            if (timestamp.length === 14) {
              // New format: YYYYMMDDHHMMSS
              const year = parseInt(timestamp.substring(0, 4));
              const month = parseInt(timestamp.substring(4, 6)) - 1; // JavaScript months are 0-indexed
              const day = parseInt(timestamp.substring(6, 8));
              const hour = parseInt(timestamp.substring(8, 10));
              const minute = parseInt(timestamp.substring(10, 12));
              const second = parseInt(timestamp.substring(12, 14));
              createdAt = new Date(year, month, day, hour, minute, second).toISOString();
            } else {
              // Old format: variable length, parse dynamically
              // Format was: YYYY + M + D + H + M + S (no zero padding)
              // Try to parse by extracting year first, then parse the rest
              const year = parseInt(timestamp.substring(0, 4));
              const remaining = timestamp.substring(4);

              // For old format, use file modification time as fallback
              if (fs.existsSync(pdfPath)) {
                const pdfStats = fs.statSync(pdfPath);
                createdAt = pdfStats.mtime.toISOString();
              } else if (fs.existsSync(progressPath)) {
                const progressStats = fs.statSync(progressPath);
                createdAt = progressStats.mtime.toISOString();
              } else if (fs.existsSync(structuredProgressPath)) {
                const structuredStats = fs.statSync(structuredProgressPath);
                createdAt = structuredStats.mtime.toISOString();
              }
            }
          } catch (error) {
            console.warn(`Failed to parse timestamp ${timestamp}:`, error);
            // Fallback to file modification time
            if (fs.existsSync(pdfPath)) {
              const pdfStats = fs.statSync(pdfPath);
              createdAt = pdfStats.mtime.toISOString();
            }
          }
        }

        // Get original file info if available
        const uploadInfo = uploadFileMap[timestamp] || {};

        // Try to read metadata file
        const metadataPath = path.join(generatedDir, `METADATA_${jobId}.json`);
        let metadata = {};
        if (fs.existsSync(metadataPath)) {
          try {
            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (error) {
            console.warn(`Failed to parse metadata for job ${jobId}:`, error);
          }
        }

        const job = {
          id: jobId,
          bookName: metadata.bookName || bookName || 'Unknown',
          fontSize: metadata.fontSize || fontSize || 'Unknown',
          borderStyle: metadata.borderStyle || null,
          author: metadata.author || null,
          year: metadata.year || null,
          series: metadata.series || null,
          status,
          progress,
          createdAt: metadata.createdAt || createdAt,
          completedAt,
          originalFileName: metadata.originalFileName || uploadInfo.originalName || null,
          uploadPath: uploadInfo.uploadPath || null
        };

        jobs.push(job);
      }
    });

    // Sort jobs by creation date (newest first)
    jobs.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: error.message
    });
  }
});

app.get('/api/download/', (req, res) => {
  const { id } = req.query;
  const pdfOutput = path.join(__dirname, 'generated', `${id}.pdf`);
  const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);

  if (fs.existsSync(pdfOutput)) {
    res.redirect(`/history/${id}.pdf`);
  } else if (fs.existsSync(inProgressPath)) {
    res.send(fs.readFileSync(inProgressPath, 'utf8'));
  } else {
    return res.send('Not started. It\'s either in the queue, or failed entirely.');
  }
});

// Delete job endpoint
app.delete('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // First, cancel the running job if it exists
    const runningJob = runningJobs.get(id);
    if (runningJob) {
      console.log(`Cancelling running job: ${id}`);
      runningJob.cancelled = true;

      // Close the browser if it's still running
      try {
        if (runningJob.browser) {
          await runningJob.browser.close();
          console.log(`Browser closed for cancelled job: ${id}`);
        }
      } catch (browserError) {
        console.error(`Error closing browser for job ${id}:`, browserError);
      }

      // Remove from running jobs
      runningJobs.delete(id);
    }

    const generatedDir = path.join(__dirname, 'generated');
    const uploadsDir = path.join(__dirname, 'uploads');

    // Files to delete
    const pdfPath = path.join(generatedDir, `${id}.pdf`);
    const inProgressPath = path.join(generatedDir, `IN_PROGRESS_${id}.txt`);
    const structuredProgressPath = path.join(generatedDir, `PROGRESS_${id}.json`);
    const metadataPath = path.join(generatedDir, `METADATA_${id}.json`);

    // Extract timestamp from job ID to find the original upload file
    const jobParts = id.split('_');
    let timestamp = '';
    if (jobParts.length >= 3) {
      timestamp = jobParts[0]; // YYYYMMDDHHMMSS
    }

    let deletedFiles = [];
    let errors = [];

    // Delete PDF file
    if (fs.existsSync(pdfPath)) {
      try {
        fs.unlinkSync(pdfPath);
        deletedFiles.push('PDF');
      } catch (error) {
        errors.push(`Failed to delete PDF: ${error.message}`);
      }
    }

    // Delete progress files
    if (fs.existsSync(inProgressPath)) {
      try {
        fs.unlinkSync(inProgressPath);
        deletedFiles.push('progress file');
      } catch (error) {
        errors.push(`Failed to delete progress file: ${error.message}`);
      }
    }

    if (fs.existsSync(structuredProgressPath)) {
      try {
        fs.unlinkSync(structuredProgressPath);
        deletedFiles.push('structured progress file');
      } catch (error) {
        errors.push(`Failed to delete structured progress file: ${error.message}`);
      }
    }

    // Delete metadata file
    if (fs.existsSync(metadataPath)) {
      try {
        fs.unlinkSync(metadataPath);
        deletedFiles.push('metadata file');
      } catch (error) {
        errors.push(`Failed to delete metadata file: ${error.message}`);
      }
    }

    // Find and delete original upload file
    if (timestamp && fs.existsSync(uploadsDir)) {
      try {
        const uploadFiles = fs.readdirSync(uploadsDir);
        const matchingUpload = uploadFiles.find(file => file.startsWith(timestamp + '_'));

        if (matchingUpload) {
          const uploadPath = path.join(uploadsDir, matchingUpload);
          fs.unlinkSync(uploadPath);
          deletedFiles.push('original upload');
        }
      } catch (error) {
        errors.push(`Failed to delete upload file: ${error.message}`);
      }
    }

    if (deletedFiles.length === 0 && errors.length === 0) {
      if (runningJob) {
        // Job was running but had no files yet
        return res.json({
          message: 'Running job cancelled successfully',
          deletedFiles: [],
          cancelled: true
        });
      } else {
        return res.status(404).json({
          error: 'Job not found',
          message: `No files found for job ID: ${id}`
        });
      }
    }

    if (errors.length > 0) {
      return res.status(207).json({
        message: `Job partially deleted. ${runningJob ? 'Running job cancelled. ' : ''}Deleted: ${deletedFiles.join(', ')}`,
        deletedFiles,
        errors,
        cancelled: !!runningJob
      });
    }

    res.json({
      message: `Job deleted successfully. ${runningJob ? 'Running job cancelled. ' : ''}Deleted: ${deletedFiles.join(', ')}`,
      deletedFiles,
      cancelled: !!runningJob
    });

  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({
      error: 'Failed to delete job',
      message: error.message
    });
  }
});

// Serve static files
app.use('/history', express.static(path.join(__dirname, 'generated')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
  console.log(`Listening on port ${port} with static file serving`);
});