  // const express = require('express');
  const fs = require('fs');
  const multer = require('multer');
  const puppeteer = require('puppeteer');
  const express = require('express');
  const app = express();
  const port = 3001;
  // const upload = multer({ dest: 'uploads/' });
  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
      async function run() {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // await page.setViewport({ width: 816, height: 1056 });

        // let text = fs.readFileSync(req.file.path, 'utf8');
        let text = req.file.buffer.toString('utf8');

        await page.goto(`file://${__dirname}/page.html`);
        await page.addStyleTag({content: `body { font-size: ${req.query.fontSize}px; }`});

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
        }, text, req.query.bookName, req.query.fontSize);

        let htmlContent = await page.content();
        fs.writeFileSync('output.html', htmlContent);
        const pdf = await page.pdf({ format: 'Letter' });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=download.pdf');
        res.send(pdf);
      }

      run();

      // res.send('PDF created!');
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred while creating the PDF.');
    }
  });

  app.get('/api/sample', (req, res) => {
    const file = path.join(__dirname, 'sample.pdf');
    res.sendFile(file);
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
