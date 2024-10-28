const fs = require('fs');
const multer = require('multer');
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const port = 3001;
const path = require('path');
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function(req, file, cb) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${date.getMonth() + 1}${date.getDate()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
    const fileName = `${formattedDate}_${file.originalname}`;
    cb(null, fileName);
  }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.fields([{name: 'file'}]), (req, res) => {
  const json = JSON.parse(req.body.params);
  const {bookName} = json;
  const {fontSize, sheetsCount} = json.headerInfo;

  const date = new Date();
  const id = `${date.getFullYear()}${date.getMonth() + 1}${date.getDate()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}_${bookName}_${fontSize}`;

  function writeToInProgress(text) {
    console.log(`${text}`);
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);
    fs.writeFileSync(inProgressPath, text);
  }

  setImmediate(async () => {
    try {
      await run(json, id, bookName, fontSize);
    } catch (error) {
      console.error(error);
      writeToInProgress('ERROR: ' + error.toString());
    }
  });

  async function run(json, id, bookName, fontSize) {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions', '--mute-audio'],
      protocolTimeout: 1000000,
      headless: true,
      devtools: false
    });
    const page = await browser.newPage();
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);

    page.on('console', pageIndex => {
      const n = Number(pageIndex.text());
      if (isNaN(n)) {
        console.log(pageIndex.text());
        return;
      }
      writeToInProgress(`Creating sheet ${n / 2} of ${sheetsCount}-ish.`);
    });

    // await page.setViewport({ width: 816, height: 1056 });

    let text = fs.readFileSync(req.files.file[0].path, 'utf8');
    
    await page.goto(`file://${__dirname}/page.html`);
    
    await page.addStyleTag({content: `body { font-size: ${fontSize}px; }`});

    writeToInProgress(`Creating: ${bookName}`);

    await page.evaluate((json, text, bookName) => {
      let pageIndex = 0;
      let isCurrentPageFront = true; // tracks whether the next page to be rendered is on the front of the double sided sheet. the side with the big header

      function createNewPage(initialWordCount, wordsLeft, headerInfo) {
        console.log(pageIndex+1);
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
              cell.innerHTML = `${Intl.NumberFormat().format(wordsLeft)} Words - ${percentageCompleted}% Complete`;
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
      createNewPage(initialWordCount, words.length, json.headerInfo); // Create first page
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
            createNewPage(initialWordCount, words.length - i, json.headerInfo);
            currentBlockIndex = blocks.length - 16; // Reset the block index to the first block of the new page
          }
          currentBlock = blocks[currentBlockIndex];
          currentBlock.innerHTML += ' ' + words[i]; // Add the word to the new block
        }
      }

      // Populate headers
      const SHEETS_AMOUNT = Math.ceil(pageIndex / 2);
      isCurrentPageFront = true;
      for (let i = 0; i < pageIndex; i++) {
        const SHEET_NUM = `${Math.ceil((i+1) / 2)}/${SHEETS_AMOUNT}`;
        let miniSheetNums = document.querySelectorAll('.miniSheetNum' + i);

        for(let i = 0; i < miniSheetNums.length; i++) {
          miniSheetNums[i].textContent = SHEET_NUM;
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

    writeToInProgress('Finished creating pages. Writing to file...');

    let htmlContent = await page.content();
    fs.writeFileSync(path.join(__dirname, `output.html`), htmlContent);

    const pdf = await page.pdf({ format: 'Letter' });
    const pdfOutput = path.join(__dirname, 'generated', `${id}.pdf`);
    fs.writeFileSync(pdfOutput, pdf);

    await browser.close();

    if (fs.existsSync(inProgressPath)) {
      fs.unlinkSync(inProgressPath);
    }
  }
  
  res.json({ message: 'PDF creation started.', id });
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

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
