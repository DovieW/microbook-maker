import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

export async function verifyBookOpening(html, directory, settings = {}) {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    pipe: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });
    await page.setContent(await fs.readFile(html, 'utf8'));
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode()));
    });
    const result = await page.evaluate(() => {
      const flows = [...document.querySelectorAll('.flow')];
      const images = [...document.images];
      const heading = [...document.querySelectorAll('h2')].filter(
        (node) => node.textContent === 'Chapter 3 Prodigies',
      );
      const header = document.querySelector('.book-header');
      const centered = [...document.querySelectorAll('p')].find(
        (node) => node.textContent === 'Intentional centered text.',
      );
      const paragraph = [...document.querySelectorAll('p')].find((node) =>
        node.textContent.startsWith('FIRST-PARAGRAPH'),
      );
      const repeated = images.filter((image) => image.alt === 'A wide landscape');
      const label = heading[0]?.querySelector('.heading-label');
      const title = heading[0]?.querySelector('.heading-title');
      const part = document.querySelector('.heading-part');
      return {
        images: images.length,
        headingCount: heading.length,
        headingAlignment: heading.map((node) => getComputedStyle(node).textAlign),
        headingLabel: label?.textContent,
        headingTitle: title?.textContent,
        headingTitleBelowLabel:
          !!label && !!title && title.getBoundingClientRect().top >= label.getBoundingClientRect().bottom,
        headingTypeface: title && getComputedStyle(title).fontFamily,
        headingItalic: title && getComputedStyle(title).fontStyle,
        chapterSize: parseFloat(getComputedStyle(heading[0]).fontSize),
        partSize: part && parseFloat(getComputedStyle(part).fontSize),
        partTitle: part?.textContent,
        chapterRule: getComputedStyle(heading[0]).borderBottomStyle,
        chapterGap: parseFloat(getComputedStyle(heading[0]).marginTop),
        partGap: parseFloat(getComputedStyle(part).marginTop),
        positions: document.querySelectorAll('.cell-position').length,
        cells: flows.length,
        centeredAlignment: getComputedStyle(centered).textAlign,
        paragraphDisplay: getComputedStyle(paragraph).display,
        headers: document.querySelectorAll('.book-header').length,
        headerCell: flows.indexOf(header.parentElement),
        headerSharesText: header.parentElement.textContent.includes('Copyright and front matter'),
        emptyCells: flows.filter((flow) => !flow.querySelector('img, p, h1, h2, h3, blockquote, table, pre'))
          .length,
        coverHeightRatio: images[0].height / flows[0].clientHeight,
        coverFilter: getComputedStyle(images[0]).filter,
        repeatedIllustrations: repeated.length,
        aspectRatios: images.map((image) => {
          const rect = image.getBoundingClientRect();
          return Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight);
        }),
      };
    });
    assert.equal(result.images, 4);
    assert.equal(result.headingCount, 1);
    assert.deepEqual(result.headingAlignment, ['left']);
    assert.equal(result.headingLabel, 'Chapter 3 ');
    assert.equal(result.headingTitle, 'Prodigies');
    assert.equal(result.headingTitleBelowLabel, true);
    assert.ok(result.headingTypeface.includes('Tinos'));
    assert.equal(result.headingItalic, 'italic');
    const chapterSize = 6 * (settings.chapterHeadingScale ?? 1.35);
    const partSize = 6 * (settings.partHeadingScale ?? 1.65);
    assert.ok(Math.abs(result.chapterSize - chapterSize) < 0.01);
    assert.ok(Math.abs(result.partSize - partSize) < 0.01);
    assert.ok(Math.abs(result.chapterGap - chapterSize * (settings.chapterHeadingGapEm ?? 0.15)) < 0.02);
    assert.ok(Math.abs(result.partGap - partSize * (settings.partHeadingGapEm ?? 0.25)) < 0.02);
    assert.equal(result.partTitle, 'Part I The journey');
    assert.equal(result.chapterRule, settings.headingRules === false ? 'none' : 'solid');
    assert.equal(result.positions, settings.positionHeaders === false ? 0 : Math.ceil(result.cells / 4) - 1);
    assert.equal(result.centeredAlignment, 'center');
    assert.equal(result.paragraphDisplay, 'inline');
    assert.equal(result.headers, 1);
    assert.equal(result.headerCell, 2);
    assert.equal(result.headerSharesText, true);
    assert.equal(result.emptyCells, 0);
    assert.ok(result.coverHeightRatio > 0.95);
    assert.equal(result.coverFilter, 'none');
    assert.equal(result.repeatedIllustrations, 2);
    assert.ok(result.aspectRatios.every((delta) => delta < 0.025));
    await page.screenshot({ path: path.join(directory, 'opening.png') });
    await fs.writeFile(path.join(directory, 'opening-audit.json'), JSON.stringify(result, null, 2));
    console.log(
      'Book opening: single left-aligned chapter, full-color images, no empty cells, shared title/info panel.',
    );
  } finally {
    await browser.close();
  }
}
