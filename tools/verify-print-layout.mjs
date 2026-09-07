import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

export async function verifyPrintLayout(html, directory, job) {
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
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    const audit = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.cell')];
      const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let nonBlackText = 0;
      while (textNodes.nextNode()) {
        const node = textNodes.currentNode;
        if (node.textContent.trim() && getComputedStyle(node.parentElement).color !== 'rgb(0, 0, 0)')
          nonBlackText++;
      }
      const spreads = [...document.querySelectorAll('.image-spread')].map((group) => {
        const image = group.querySelector('img');
        const a = image.getBoundingClientRect(),
          b = group.getBoundingClientRect();
        const matrix = new DOMMatrix(getComputedStyle(image).transform);
        return {
          blockId: group.dataset.block,
          index: cells.indexOf(group.closest('.cell')),
          centerX: Math.abs(a.x + a.width / 2 - b.x - b.width / 2),
          centerY: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
          aspect: Math.abs(a.width / a.height - image.naturalHeight / image.naturalWidth),
          width: b.width,
          bounds:
            a.top >= b.top - 0.1 &&
            a.bottom <= b.bottom + 0.1 &&
            a.left >= b.left - 0.1 &&
            a.right <= b.right + 0.1,
          rotation: [matrix.a, matrix.b, matrix.c, matrix.d],
          filter: getComputedStyle(image).filter,
        };
      });
      const paragraphs = [...document.querySelectorAll('p')];
      const first = paragraphs.find((p) => p.textContent.startsWith('FIRST-PARAGRAPH'));
      const second = paragraphs.find((p) => p.textContent.startsWith('SECOND-PARAGRAPH'));
      return {
        nonBlackText,
        spreads,
        imageCount: document.images.length,
        imageIds: [...document.images].map((img) => img.closest('.image-group')?.dataset.block),
        openingPositionHeaders: cells
          .slice(0, 2)
          .reduce((n, cell) => n + cell.querySelectorAll('.cell-position').length, 0),
        sourcePageNumbers: document.querySelectorAll('.source-page').length,
        paragraphGap:
          first && second
            ? second.getBoundingClientRect().top - first.getBoundingClientRect().bottom
            : undefined,
        partStyle: document.querySelector('.heading-part')
          ? getComputedStyle(document.querySelector('.heading-part')).fontStyle
          : undefined,
      };
    });
    assert.equal(audit.nonBlackText, 0);
    assert.equal(audit.openingPositionHeaders, 0);
    assert.equal(audit.sourcePageNumbers > 0, job.settings.sourcePageNumbers);
    if (job.settings.paragraphStyle === 'spaced' && audit.paragraphGap !== undefined)
      assert.ok(Math.abs(audit.paragraphGap - job.settings.fontSizePx * job.settings.lineHeight) < 0.1);
    if (audit.partStyle)
      assert.equal(audit.partStyle, job.settings.partHeadingStyle === 'upright' ? 'normal' : 'italic');
    const expectedSpreads = audit.imageIds.filter(
      (id) => (job.settings.imageCellSpans?.[id] ?? (job.settings.twoCellImages ? 2 : 1)) === 2,
    );
    assert.deepEqual(
      audit.spreads.map((s) => s.blockId),
      expectedSpreads,
    );
    if (expectedSpreads.length) {
      assert.equal(audit.spreads.length, expectedSpreads.length);
      for (const spread of audit.spreads) {
        const first = job.result.cells[spread.index],
          second = job.result.cells[spread.index + 1];
        assert.equal(first.span, 2);
        assert.equal(second.continuationOf, first.index);
        assert.equal(first.page, second.page);
        assert.ok(first.index % 4 <= 2);
        assert.equal(second.text, '');
        assert.ok(spread.centerX < 0.1 && spread.centerY < 0.1, JSON.stringify(spread));
        assert.ok(spread.aspect < 0.03 && spread.bounds);
        assert.deepEqual(spread.rotation, [0, -1, 1, 0]);
        assert.equal(spread.filter, 'none');
      }
    } else assert.equal(audit.spreads.length, 0);
    await page.screenshot({ path: path.join(directory, 'print-layout.png') });
    await fs.writeFile(path.join(directory, 'print-layout-audit.json'), JSON.stringify(audit, null, 2));
  } finally {
    await browser.close();
  }
}
