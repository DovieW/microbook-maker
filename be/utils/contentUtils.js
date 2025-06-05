/**
 * Content generation utilities
 */

/**
 * Generate the page content evaluation script
 * This function handles the complex logic of creating pages and populating them with text
 * @param {Object} json - Configuration object
 * @param {string} text - Text content to be processed
 * @param {string} bookName - Name of the book
 * @returns {Function} Function to be evaluated in the browser context
 */
function createPageContentScript(_json, _text, _bookName) {
  return function (json, text, bookName) {
    let pageIndex = 0;
    let isCurrentPageFront = true;

    function createNewPage(readTime, initialWordCount, wordsLeft, headerInfo) {
      console.log(pageIndex + 1);
      const percentageCompleted = Math.round(
        ((initialWordCount - wordsLeft) / initialWordCount) * 100,
      );
      const page = document.createElement('div');
      page.className = 'page';

      const grid = document.createElement('div');
      grid.className = 'grid-container';

      for (let i = 0; i < 16; i++) {
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
          gridItem.id = 'header' + pageIndex;
          if (pageIndex === 0) {
            createMainHeader(gridItem, bookName, headerInfo, wordsLeft);
          } else {
            createSubsequentHeader(
              gridItem,
              bookName,
              wordsLeft,
              percentageCompleted,
            );
          }
        } else if (i % 4 === 0) {
          createMiniHeader(gridItem, pageIndex);
        }
        grid.appendChild(gridItem);
      }

      page.appendChild(grid);
      document.body.appendChild(page);
      isCurrentPageFront = !isCurrentPageFront;
      blocks = Array.from(document.querySelectorAll('.grid-item'));
      pageIndex++;
    }

    function createMainHeader(gridItem, bookName, headerInfo, wordsLeft) {
      const mainHeader = document.createElement('div');
      mainHeader.classList.add('main-header');
      const table = document.createElement('table');
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
        cell.innerHTML = `<b>${property.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</b> ${value}`;
        currentRow.appendChild(cell);
        cellCount++;
      }
      gridItem.appendChild(mainHeader);
    }

    function createSubsequentHeader(
      gridItem,
      bookName,
      wordsLeft,
      percentageCompleted,
    ) {
      const mainHeader = document.createElement('div');
      gridItem.appendChild(mainHeader);
      mainHeader.classList.add('main-header');
      const table = document.createElement('table');
      mainHeader.appendChild(table);

      const mainHeaderTitleTr = document.createElement('tr');
      const mainHeaderTitleTd = document.createElement('td');
      mainHeaderTitleTd.setAttribute('colspan', '2');
      mainHeaderTitleTr.appendChild(mainHeaderTitleTd);
      mainHeaderTitleTd.classList.add('main-header-title');

      const sheetNumSpan = document.createElement('span');
      sheetNumSpan.id = 'sheetNum' + pageIndex;
      sheetNumSpan.innerText = '00/00';
      mainHeaderTitleTd.appendChild(sheetNumSpan);
      if (bookName) {
        mainHeaderTitleTd.innerHTML += ` - ${bookName}`;
      }
      table.appendChild(mainHeaderTitleTd);

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

    function createMiniHeader(gridItem, pageIndex) {
      const miniSheetNumContainer = document.createElement('span');
      const miniSheetNum = document.createElement('span');
      const miniSheetNumPrecentage = document.createElement('span');
      miniSheetNumContainer.appendChild(miniSheetNum);
      miniSheetNumContainer.appendChild(miniSheetNumPrecentage);
      miniSheetNumPrecentage.classList.add('miniSheetNumPrecentage');
      miniSheetNum.classList.add('miniSheetNum' + pageIndex);
      miniSheetNumContainer.classList.add('miniSheetNum');
      miniSheetNum.textContent = '00/00';
      miniSheetNumPrecentage.textContent = ' 00%';
      gridItem.appendChild(miniSheetNumContainer);
    }

    // Main content generation logic
    const words = text.split(' ');
    const initialWordCount = words.length;
    let blocks = [];
    createNewPage(
      json.headerInfo.readTime,
      initialWordCount,
      words.length,
      json.headerInfo,
    );
    let currentBlockIndex = 0;
    let currentBlock = blocks[currentBlockIndex];

    for (let i = 0; i < words.length; i++) {
      currentBlock.innerHTML += ' ' + words[i];
      const miniSheetNumPrecentage = currentBlock.querySelector(
        '.miniSheetNumPrecentage',
      );
      if (miniSheetNumPrecentage) {
        miniSheetNumPrecentage.textContent = ` ${Math.round(((i + 1) / words.length) * 100)}%`;
      }

      if (currentBlock.scrollHeight > currentBlock.clientHeight) {
        currentBlock.innerHTML = currentBlock.innerHTML.slice(
          0,
          currentBlock.innerHTML.length - words[i].length,
        );

        currentBlockIndex++;
        if (currentBlockIndex >= blocks.length) {
          createNewPage(
            json.headerInfo.readTime,
            initialWordCount,
            words.length - i,
            json.headerInfo,
          );
          currentBlockIndex = blocks.length - 16;
        }
        currentBlock = blocks[currentBlockIndex];
        currentBlock.innerHTML += ' ' + words[i];
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

    // Populate headers with sheet numbers
    const SHEETS_AMOUNT = Math.ceil(pageIndex / 2);
    isCurrentPageFront = true;
    for (let i = 0; i < pageIndex; i++) {
      const sideIndicator = isCurrentPageFront ? '' : 'b';
      const SHEET_NUM = `${Math.ceil((i + 1) / 2)}/${SHEETS_AMOUNT}`;
      const MINI_SHEET_NUM = `${Math.ceil((i + 1) / 2)}${sideIndicator}/${SHEETS_AMOUNT}`;
      const miniSheetNums = document.querySelectorAll('.miniSheetNum' + i);

      for (let j = 0; j < miniSheetNums.length; j++) {
        miniSheetNums[j].textContent = MINI_SHEET_NUM;
      }

      if (isCurrentPageFront && i !== 0) {
        const sheetNumElement = document.querySelector('#sheetNum' + i);
        if (sheetNumElement) {
          sheetNumElement.textContent = SHEET_NUM;
        }
      }
      isCurrentPageFront = !isCurrentPageFront;
    }

    // Remove empty grid items on final page
    const allGridItems = document.querySelectorAll('.grid-item');
    Array.from(allGridItems)
      .slice(-15)
      .forEach(block => {
        const cloneBlock = block.cloneNode(true);
        const spanElement = cloneBlock.querySelector('.miniSheetNum');
        if (spanElement) {
          spanElement.remove();
        }
        if (cloneBlock.textContent.trim() === '') {
          block.remove();
        }
      });
  };
}

module.exports = {
  createPageContentScript,
};
