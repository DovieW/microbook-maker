const fs = require('fs');
const multer = require('multer');
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const port = 3001;
const path = require('path');
const EpubParser = require('./epubParser');

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

// Helper function to detect file type
function getFileType(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.epub') return 'epub';
  if (extension === '.txt') return 'txt';
  return 'unknown';
}

// Helper function to parse text files into structured content
function parseTextFile(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const elements = [];
  let totalWordCount = 0;

  for (let line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) continue;

    const words = trimmedLine.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    totalWordCount += wordCount;

    // Try to detect if this might be a chapter heading (simple heuristic)
    const isLikelyChapter = /^(chapter|ch\.?\s*\d+|part\s+\d+|\d+\.?\s*$)/i.test(trimmedLine) && wordCount <= 10;

    elements.push({
      type: isLikelyChapter ? 'heading' : 'paragraph',
      text: trimmedLine,
      wordCount,
      formatting: isLikelyChapter ? { level: 1 } : {}
    });
  }

  return {
    content: [{
      chapterTitle: '',
      elements,
      wordCount: totalWordCount
    }],
    totalWordCount,
    metadata: {}
  };
}

app.post('/api/upload', upload.fields([{name: 'file'}]), async (req, res) => {
  const json = JSON.parse(req.body.params);
  const {bookName, borderStyle} = json;
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
      await run(json, id, bookName, fontSize, borderStyle, req.files.file[0]);
    } catch (error) {
      console.error(error);
      writeToInProgress('ERROR: ' + error.toString());
    }
  });

  async function run(json, id, bookName, fontSize, borderStyle, uploadedFile) {
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

    let structuredContent;
    const fileType = getFileType(uploadedFile.originalname);
    
    writeToInProgress(`Parsing ${fileType.toUpperCase()} file: ${bookName}`);

    try {
      if (fileType === 'epub') {
        const epubParser = new EpubParser(uploadedFile.path);
        structuredContent = await epubParser.parse();
        
        // Update metadata if available from EPUB
        if (structuredContent.metadata) {
          if (structuredContent.metadata.title && !json.headerInfo.title) {
            json.headerInfo.title = structuredContent.metadata.title;
          }
          if (structuredContent.metadata.creator && !json.headerInfo.author) {
            json.headerInfo.author = structuredContent.metadata.creator;
          }
        }
      } else if (fileType === 'txt') {
        const text = fs.readFileSync(uploadedFile.path, 'utf8');
        structuredContent = parseTextFile(text);
      } else {
        throw new Error('Unsupported file type. Please use .txt or .epub files.');
      }
    } catch (parseError) {
      writeToInProgress('Error parsing file: ' + parseError.message);
      throw parseError;
    }

    await page.goto(`file://${__dirname}/page.html`);
    
    await page.addStyleTag({content: `body { font-size: ${fontSize}px; }`});
    
    // Add enhanced styles for better formatting
    await page.addStyleTag({content: `
      .grid-item:nth-child(4n-2), 
      .grid-item:nth-child(4n-1), 
      .grid-item:nth-child(4n-3) {
          border-right: 1px ${borderStyle || 'dashed'} black;
      }
      .grid-item:nth-child(n+5) {
          border-top: 1px ${borderStyle || 'dashed'} black;
      }
      
      .chapter-heading {
        font-weight: bold;
        font-size: 1.3em;
        text-align: center;
        margin: 0.8em 0;
        text-decoration: underline;
      }
      
      .heading-1 { font-size: 1.3em; font-weight: bold; text-align: center; margin: 0.8em 0; }
      .heading-2 { font-size: 1.2em; font-weight: bold; margin: 0.6em 0; }
      .heading-3 { font-size: 1.1em; font-weight: bold; margin: 0.5em 0; }
      .heading-4, .heading-5, .heading-6 { font-weight: bold; margin: 0.4em 0; }
      
      .paragraph-break { margin: 0.5em 0; }
      .blockquote { 
        margin: 0.5em 1em; 
        padding: 0.3em;
        border-left: 2px solid #666;
        font-style: italic;
      }
      
      .bold { font-weight: bold; }
      .italic { font-style: italic; }
      .underline { text-decoration: underline; }
      .center { text-align: center; }
    `});

    writeToInProgress(`Creating enhanced PDF: ${bookName}`);

    await page.evaluate((json, structuredContent, bookName) => {
      let pageIndex = 0;
      let isCurrentPageFront = true;

      function createNewPage(readTime, initialWordCount, wordsLeft, headerInfo) {
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
            gridItem.id = 'header' + pageIndex;
            if (pageIndex === 0) {
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
          } else if (i % 4 === 0) {
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

      // Convert structured content to enhanced text with formatting
      function convertToFormattedText(structuredContent) {
        let formattedText = '';
        let elementIndex = 0;
        const elementMap = new Map();

        for (let chapter of structuredContent.content) {
          // Add chapter title if it exists
          if (chapter.chapterTitle && chapter.chapterTitle.trim()) {
            formattedText += `\n\n<CHAPTER_HEADING>${chapter.chapterTitle}</CHAPTER_HEADING>\n\n`;
            elementMap.set(elementIndex++, { type: 'chapter_heading', text: chapter.chapterTitle });
          }

          for (let element of chapter.elements) {
            const elementMarker = `<ELEMENT_${elementIndex}>`;
            const elementCloser = `</ELEMENT_${elementIndex}>`;

            switch (element.type) {
              case 'heading':
                formattedText += `\n\n${elementMarker}${element.text}${elementCloser}\n\n`;
                break;
              case 'paragraph':
                formattedText += `\n${elementMarker}${element.text}${elementCloser}\n`;
                break;
              case 'blockquote':
                formattedText += `\n${elementMarker}${element.text}${elementCloser}\n`;
                break;
              default:
                formattedText += `${elementMarker}${element.text}${elementCloser} `;
            }

            elementMap.set(elementIndex, element);
            elementIndex++;
          }
        }

        return { text: formattedText, elementMap };
      }

      const { text: formattedText, elementMap } = convertToFormattedText(structuredContent);
      const words = formattedText.split(/\s+/).filter(word => word.trim().length > 0);
      const initialWordCount = structuredContent.totalWordCount;
      let blocks = [];
      createNewPage(json.headerInfo.readTime, initialWordCount, initialWordCount, json.headerInfo);
      let currentBlockIndex = 0;
      let currentBlock = blocks[currentBlockIndex];
      let processedWords = 0;

      for (let i = 0; i < words.length; i++) {
        let word = words[i];
        
        // Handle special formatting markers
        if (word.includes('<CHAPTER_HEADING>')) {
          const chapterText = word.replace('<CHAPTER_HEADING>', '').replace('</CHAPTER_HEADING>', '');
          if (chapterText.trim()) {
            // Add chapter break
            currentBlock.innerHTML += '<br><div class="chapter-heading">' + chapterText + '</div><br>';
          }
          continue;
        }

        if (word.includes('<ELEMENT_')) {
          const elementMatch = word.match(/<ELEMENT_(\d+)>(.*?)<\/ELEMENT_\d+>/);
          if (elementMatch) {
            const elementIndex = parseInt(elementMatch[1]);
            const elementText = elementMatch[2];
            const element = elementMap.get(elementIndex);
            
            if (element) {
              let formattedWord = elementText;
              let cssClasses = [];

              // Apply formatting
              if (element.type === 'heading') {
                cssClasses.push(`heading-${element.formatting.level || 1}`);
                formattedWord = `<br><div class="${cssClasses.join(' ')}">${elementText}</div><br>`;
              } else if (element.type === 'paragraph') {
                cssClasses.push('paragraph-break');
                formattedWord = `<br><span class="${cssClasses.join(' ')}">${elementText}</span><br>`;
              } else if (element.type === 'blockquote') {
                formattedWord = `<br><div class="blockquote">${elementText}</div><br>`;
              } else {
                if (element.formatting.bold) cssClasses.push('bold');
                if (element.formatting.italic) cssClasses.push('italic');
                if (element.formatting.underline) cssClasses.push('underline');
                if (element.formatting.align === 'center') cssClasses.push('center');
                
                if (cssClasses.length > 0) {
                  formattedWord = `<span class="${cssClasses.join(' ')}">${elementText}</span>`;
                }
              }
              
              currentBlock.innerHTML += ' ' + formattedWord;
              processedWords += elementText.split(/\s+/).length;
            } else {
              currentBlock.innerHTML += ' ' + elementText;
              processedWords++;
            }
          } else {
            currentBlock.innerHTML += ' ' + word;
            processedWords++;
          }
        } else {
          currentBlock.innerHTML += ' ' + word;
          processedWords++;
        }

        const miniSheetNumPrecentage = currentBlock.querySelector(`.miniSheetNumPrecentage`);
        if (miniSheetNumPrecentage) {
          miniSheetNumPrecentage.textContent = ` ${Math.round(processedWords / initialWordCount * 100)}%`;
        }

        if (currentBlock.scrollHeight > currentBlock.clientHeight) {
          // Remove the last addition that caused overflow
          let lastAddition = word;
          if (word.includes('<') && word.includes('<ELEMENT_')) {
            const overflowElementMatch = word.match(/<ELEMENT_(\d+)>(.*?)<\/ELEMENT_\d+>/);
            lastAddition = overflowElementMatch?.[0] || word;
          }
          const lastIndex = currentBlock.innerHTML.lastIndexOf(lastAddition);
          if (lastIndex !== -1) {
            currentBlock.innerHTML = currentBlock.innerHTML.substring(0, lastIndex);
          }

          // Move to the next block
          currentBlockIndex++;
          if (currentBlockIndex >= blocks.length) {
            createNewPage(json.headerInfo.readTime, initialWordCount, initialWordCount - processedWords, json.headerInfo);
            currentBlockIndex = blocks.length - 16;
          }
          currentBlock = blocks[currentBlockIndex];
          
          // Add the word to the new block
          if (word.includes('<ELEMENT_')) {
            const elementMatch = word.match(/<ELEMENT_(\d+)>(.*?)<\/ELEMENT_\d+>/);
            if (elementMatch) {
              const elementIndex = parseInt(elementMatch[1]);
              const elementText = elementMatch[2];
              const element = elementMap.get(elementIndex);
              
              if (element) {
                let formattedWord = elementText;
                let cssClasses = [];

                if (element.type === 'heading') {
                  cssClasses.push(`heading-${element.formatting.level || 1}`);
                  formattedWord = `<div class="${cssClasses.join(' ')}">${elementText}</div><br>`;
                } else if (element.type === 'paragraph') {
                  cssClasses.push('paragraph-break');
                  formattedWord = `<span class="${cssClasses.join(' ')}">${elementText}</span><br>`;
                } else {
                  if (element.formatting.bold) cssClasses.push('bold');
                  if (element.formatting.italic) cssClasses.push('italic');
                  if (element.formatting.underline) cssClasses.push('underline');
                  if (element.formatting.align === 'center') cssClasses.push('center');
                  
                  if (cssClasses.length > 0) {
                    formattedWord = `<span class="${cssClasses.join(' ')}">${elementText}</span>`;
                  }
                }
                
                currentBlock.innerHTML += formattedWord;
              } else {
                currentBlock.innerHTML += elementText;
              }
            } else {
              currentBlock.innerHTML += word;
            }
          } else {
            currentBlock.innerHTML += word;
          }
        }
      }

      if (currentBlock) {
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
    }, json, structuredContent, bookName);

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