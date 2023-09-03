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
    const formattedDate = `${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}_${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    const fileName = `${formattedDate}_${file.originalname}`;
    cb(null, fileName);
  }
});
const upload = multer({ storage: storage });
const serveIndex = require('serve-index');

// app.use('/generated', express.static(path.join(__dirname, 'generated')), serveIndex(path.join(__dirname, 'generated'), {'icons': true}));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')), serveIndex(path.join(__dirname, 'uploads'), {'icons': true}));

app.post('/api/upload', upload.single('file'), (req, res) => {
  const {bookName, fontSize, papersCount} = req.query;

  const date = new Date();
  const id = `${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}_${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}_${bookName}_${fontSize}`;

  function writeToInProgress(text) {
    console.log(`${text}`);
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);
    fs.writeFileSync(inProgressPath, text);
  }

  setImmediate(async () => {
    try {
      await run(req, id, bookName, fontSize);
    } catch (error) {
      console.error(error);
      writeToInProgress('ERROR: ' + error.toString());
    }
  });

  async function run(req, id, bookName, fontSize) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}.txt`);

    page.on('console', pageIndex => {
      writeToInProgress(`Creating sheet ${pageIndex.text() / 2} of ${papersCount}-ish.`);
    });

    // await page.setViewport({ width: 816, height: 1056 });

    let text = fs.readFileSync(req.file.path, 'utf8');
    
    await page.goto(`file://${__dirname}/page.html`);
    
    await page.addStyleTag({content: `body { font-size: ${fontSize}px; }`});

    writeToInProgress(`Creating: ${bookName}`);

    await page.evaluate((text, bookName) => {
      let pageIndex = 0;
      const words = text.split(' ');
      let blocks = [];
      let currentBlockIndex = 0;
      let currentBlock;
      let isCurrentPageFront = true; // tracks whether the next page to be rendered is on the front of the double sided sheet. the side with the big header

      function createNewPage(wordsLeft) {
        console.log(pageIndex+1);
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

          if (i === 0 && isCurrentPageFront) { 
            gridItem.id = 'header' + pageIndex;
          } else if (i % 4 === 0) { // if it's the first cell in a row
            const miniSheetNum = document.createElement('span');
            miniSheetNum.classList.add('miniSheetNum' + pageIndex);
            miniSheetNum.classList.add('miniSheetNum');
            miniSheetNum.textContent = '00/00';
            gridItem.appendChild(miniSheetNum);
          }
          grid.appendChild(gridItem);
        }

        page.appendChild(grid);
        document.body.appendChild(page);

        if (isCurrentPageFront) {
          isCurrentPageFront = false;
          const header = document.createElement('div');
          const sheetNum = document.createElement('h3');
          const title = document.createElement('h3');
          
          header.className = 'header';
          sheetNum.textContent = '00/00';
          sheetNum.id = 'sheetNum' + pageIndex;
          if (bookName) title.textContent = ' - ' + bookName;

          header.appendChild(sheetNum);
          header.appendChild(title);

          const wordCountEl = document.createElement('h4');
          wordCountEl.textContent = ' [ ' + Intl.NumberFormat().format(wordsLeft) + ' words ]';
          header.appendChild(wordCountEl);

          document.querySelector('#header' + pageIndex).appendChild(header);
        } else {
          isCurrentPageFront = true;
        }
        
        blocks = Array.from(document.querySelectorAll('.grid-item'));

        pageIndex++;
      }
      createNewPage(words.length);

      // Populate grid items
      currentBlock = blocks[currentBlockIndex];
      for (let i = 0; i < words.length; i++) {
        currentBlock.innerHTML += ' ' + words[i];

        // If the word made the block overflow, remove it from the block
        if (currentBlock.scrollHeight > currentBlock.clientHeight) {
          currentBlock.innerHTML = currentBlock.innerHTML.slice(0, currentBlock.innerHTML.length - words[i].length);

          // Move to the next block
          currentBlockIndex++;
          if (currentBlockIndex >= blocks.length) {
            createNewPage(words.length - i); // Create a new page if all blocks are filled
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

        if (isCurrentPageFront) {
          isCurrentPageFront = false;
          document.querySelector('#sheetNum' + i).textContent = SHEET_NUM;
        } else {
          isCurrentPageFront = true;
        }
      }

      // remove empty grid items on final page
      const allGridItems = document.querySelectorAll('.grid-item');
      const last16GridItems = Array.from(allGridItems).slice(-15);
      last16GridItems.forEach((block, index) => {
        const cloneBlock = block.cloneNode(true);
        const spanElement = cloneBlock.querySelector('.miniSheetNum');
        if (spanElement) {
          spanElement.remove();
        }
        if (cloneBlock.textContent.trim() === '') {
          block.remove();
        }
      });
    }, text, bookName);

    writeToInProgress('Finished creating pages. Writing to file...');

    let htmlContent = await page.content();
    const pageHtml = path.join(__dirname, `pageHtml.html`);
    fs.writeFileSync(pageHtml, htmlContent);

    const pdf = await page.pdf({ format: 'Letter' });
    const pdfOutput = path.join(__dirname, 'generated', `${id}.pdf`);
    fs.writeFileSync(pdfOutput, pdf);

    await browser.close();

    // Delete the IN_PROGRESS file after PDF is created
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
    res.redirect(`/generated/${id}.pdf`);
  } else if (fs.existsSync(inProgressPath)) {
    res.send(fs.readFileSync(inProgressPath, 'utf8'));
  } else {
    return res.send('Not started. It\'s either in the queue, or failed entirely.');
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
