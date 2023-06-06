// const express = require('express');
const fs = require('fs');
const multer = require('multer');
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const port = 3001;
const path = require('path');
const upload = multer({ dest: 'uploads/' });
app.use('/generated', express.static(path.join(__dirname, 'generated')));
// const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('file'), (req, res) => {
  const id = Date.now().toString();
  const {bookName, wordCount, fontSize} = req.query;
  let estimatedNumberOfPages = 0;
  if (wordCount) {
    estimatedNumberOfPages = Math.ceil(wordCount / 9700);
  }

  setImmediate(async () => {
    try {
      await run(req, id, bookName, fontSize);
    } catch (error) {
      console.error(error);
      const txt = error.toString();
      const failedPath = path.join(__dirname, 'generated', `FAILED_${id}_${bookName}.txt`);
      fs.writeFileSync(failedPath, txt);
    }
  });

  function writeToInProgress(text) {
    console.log(`${text}`);
    const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}_${bookName}.txt`);
    fs.writeFileSync(inProgressPath, text);
  }

  async function run(req, id, bookName, fontSize) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', pageIndex => {
      writeToInProgress(`Creating page ${pageIndex.text()} out of ${estimatedNumberOfPages} (approximately). It should take around ${Number.parseFloat(((estimatedNumberOfPages - Number(pageIndex.text())) * 5) / 60).toFixed(1)} minutes.`);
    });

    // await page.setViewport({ width: 816, height: 1056 });

    let text = fs.readFileSync(req.file.path, 'utf8');
    // let text = req.file.buffer.toString('utf8');
    

    await page.goto(`file://${__dirname}/page.html`);
    
    await page.addStyleTag({content: `body { font-size: ${fontSize}px; }`});

    writeToInProgress(`Creating ${bookName} (ID: ${id})`);
    await page.evaluate((text, bookName, fontSize) => {
      pageIndex = 1;
      frontOrBackText = ':';
      // document.querySelector('body').style.fontSize = Number(fontSize);
      document.querySelector('#title').innerHTML = bookName;
      if (bookName !== '') document.querySelector('#dash').innerHTML = ' - ';

      const words = text.split(' ');
      let blocks = Array.from(document.querySelectorAll('.grid-item'));

      let currentBlockIndex = 0;
      let currentBlock = blocks[currentBlockIndex];

      function createNewPage() {
        console.log(pageIndex+1);
        pageIndex++;
        const page = document.createElement('div');
        const header = document.createElement('div');
        const pageNumber = document.createElement('h3');
        const frontOrBack = document.createElement('h3');
        const title = document.createElement('h3');
        const dash = document.createElement('h3');

        page.className = 'page';
        header.className = 'header';
        pageNumber.id = 'pageNumber' + pageIndex;
        frontOrBack.innerHTML = frontOrBackText;
        frontOrBackText = frontOrBackText === '.' ? ':' : '.';
        title.innerHTML = bookName;
        dash.innerHTML = ' - ';

        header.appendChild(pageNumber);
        header.appendChild(frontOrBack);
        if (bookName !== '') header.appendChild(dash);
        header.appendChild(title);
        page.appendChild(header);
        const newGrid = document.createElement('div');
        newGrid.className = 'grid-container';
        for (let i = 0; i < 16; i++) {
          const newGridItem = document.createElement('div');
          newGridItem.className = 'grid-item';
          newGrid.appendChild(newGridItem);
        }
        page.appendChild(newGrid);
        document.body.appendChild(page);
        blocks = Array.from(document.querySelectorAll('.grid-item'));
      }

      for (let i = 0; i < words.length; i++) {
        currentBlock.textContent += ' ' + words[i];

        if (currentBlock.scrollHeight > currentBlock.clientHeight) {
          // If the word made the block to overflow, remove it from the block
          currentBlock.textContent = currentBlock.textContent.slice(
            0,
            currentBlock.textContent.length - words[i].length
          );

          // Move to the next block
          currentBlockIndex += 1;
          if (currentBlockIndex >= blocks.length) {
            createNewPage(); // Create a new page if all blocks are filled
            currentBlockIndex = blocks.length - 16; // Reset the block index to the first block of the new page
          }
          currentBlock = blocks[currentBlockIndex];
          currentBlock.textContent += ' ' + words[i]; // Add the word to the new block
        }
      }
      for (let i = 0; i < pageIndex; i++) {
        document.querySelector('#pageNumber' + (i+1)).innerHTML = `${i+1}/${pageIndex}`;
      }
    }, text, bookName, fontSize);
    writeToInProgress('Finished creating pages. Writing to file...');
    // let htmlContent = await page.content();
    // fs.writeFileSync('output.html', htmlContent);
    const pdf = await page.pdf({ format: 'Letter' });
    const pdfOutput = path.join(__dirname, 'generated', `${id}_${bookName}.pdf`);
    fs.writeFileSync(pdfOutput, pdf);

    await browser.close();
  }
  
  res.json({ message: 'PDF creation started.', id });
});

app.get('/api/status/', (req, res) => {
  const { id, bookName } = req.query;
  const pdfOutput = path.join(__dirname, 'generated', `${id}_${bookName}.pdf`);
  const failedPdfOutput = path.join(__dirname, 'generated', `FAILED_${id}_${bookName}.pdf`);
  const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}_${bookName}.txt`);
  if (fs.existsSync(pdfOutput)) {
    return res.send('PDF is ready');
  } else if (fs.existsSync(inProgressPath)) {
    res.send(fs.readFileSync(inProgressPath, 'utf8'));
  } else if (fs.existsSync(failedPdfOutput)) {
    return res.send('PDF generation faild');
  } else {
    return res.send('PDF is NOT ready');
  }
});

app.get('/api/download/', (req, res) => {
  const { id, bookName } = req.query;
  const pdfOutput = path.join(__dirname, 'generated', `${id}_${bookName}.pdf`);
  const faildPdfOutput = path.join(__dirname, 'generated', `FAILED_${id}_${bookName}.pdf`);
  const inProgressPath = path.join(__dirname, 'generated', `IN_PROGRESS_${id}_${bookName}.txt`);
  if (fs.existsSync(pdfOutput)) {
    // res.setHeader('Content-Disposition', `inline; filename="${bookName}.pdf"`);
    // return res.sendFile(pdfOutput);
    res.redirect(`/generated/${id}_${bookName}.pdf`);
  } else if (fs.existsSync(inProgressPath)) {
    res.send(fs.readFileSync(inProgressPath, 'utf8'));
  } else if (fs.existsSync(faildPdfOutput)) {
    return res.send('PDF generation failed for some reason 😭');
  } else {
    return res.send('Not started. It\'s either in the queue or about to start.');
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
