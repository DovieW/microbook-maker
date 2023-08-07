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

app.use('/generated', express.static(path.join(__dirname, 'generated')), serveIndex(path.join(__dirname, 'generated'), {'icons': true}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')), serveIndex(path.join(__dirname, 'uploads'), {'icons': true}));

app.post('/api/upload', upload.single('file'), (req, res) => {
  const date = new Date();
  const id = `${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}_${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;

  const {bookName, wordCount, fontSize} = req.query;
  let estimatedNumberOfPages = 0;
  estimatedNumberOfPages = Math.ceil(wordCount / 9700);

  function writeToInProgress(text) {
    console.log(`${text}`);
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}_${bookName}.txt`);
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
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}_${bookName}.txt`);

    page.on('console', pageIndex => {
      writeToInProgress(`Creating page ${pageIndex.text()} of ${estimatedNumberOfPages}-ish. It should take around ${Number.parseFloat(((estimatedNumberOfPages - Number(pageIndex.text())) * 5) / 60).toFixed(1)}-ish minutes.`);
    });

    // await page.setViewport({ width: 816, height: 1056 });

    let text = fs.readFileSync(req.file.path, 'utf8');
    // let text = req.file.buffer.toString('utf8');
    
    await page.goto(`file://${__dirname}/page.html`);
    
    await page.addStyleTag({content: `body { font-size: ${fontSize}px; }`});

    writeToInProgress(`Creating: ${bookName}`);

    await page.evaluate((text, bookName) => {
      let pageIndex = 0;
      const words = text.split(' ');
      let blocks = [];
      let currentBlockIndex = 0;
      let currentBlock;

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
          if (i === 0) gridItem.id = 'header' + pageIndex;
          grid.appendChild(gridItem);
        }

        page.appendChild(grid);
        document.body.appendChild(page);

        if ((pageIndex+1) % 2 === 1) {
          const header = document.createElement('div');
          const pageNumber = document.createElement('h3');
          const title = document.createElement('h3');
          
          header.className = 'header';
          pageNumber.textContent = '00/00';
          pageNumber.id = 'pageNumber' + pageIndex;
          if (bookName) title.textContent = ' - ' + bookName;

          header.appendChild(pageNumber);
          header.appendChild(title);

          const wordCountEl = document.createElement('h4');
          wordCountEl.textContent = ' [ ' + Intl.NumberFormat().format(wordsLeft) + ' words ]';
          header.appendChild(wordCountEl);

          document.querySelector('#header' + pageIndex).appendChild(header);
        }
        
        blocks = Array.from(document.querySelectorAll('.grid-item'));

        pageIndex++;
      }
      createNewPage(words.length);

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

      const SHEETS_AMOUNT = Math.ceil(pageIndex / 2);
      for (let i = 0; i < pageIndex; i++) {
        if (i % 2 === 1) continue;
        document.querySelector('#pageNumber' + i).textContent = `${Math.ceil((i+1) / 2)}/${SHEETS_AMOUNT}`;
      }
    }, text, bookName);

    writeToInProgress('Finished creating pages. Writing to file...');

    let htmlContent = await page.content();
    const pageHtml = path.join(__dirname, `pageHtml.html`);
    fs.writeFileSync(pageHtml, htmlContent);

    const pdf = await page.pdf({ format: 'Letter' });
    const pdfOutput = path.join(__dirname, 'generated', `${id}_${bookName}.pdf`);
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
  const { id, bookName } = req.query;
  const pdfOutput = path.join(__dirname, 'generated', `${id}_${bookName}.pdf`);
  const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}_${bookName}.txt`);

  if (fs.existsSync(pdfOutput)) {
    res.redirect(`/generated/${id}_${bookName}.pdf`);
  } else if (fs.existsSync(inProgressPath)) {
    res.send(fs.readFileSync(inProgressPath, 'utf8'));
  } else {
    return res.send('Not started. It\'s either in the queue, or failed entirely.');
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
