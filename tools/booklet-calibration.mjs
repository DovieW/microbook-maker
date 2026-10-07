// Run after npm run build. Generates two 16-page signatures using the production imposition engine.
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';
const output = path.resolve('output/pdf/booklet-calibration.pdf');
await fs.mkdir(path.dirname(output), { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.setContent(
    '<html><head><title>Booklet calibration</title><style>@page{size:153pt 198pt;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial;color:black}.page{width:204px;height:264px;position:relative;break-after:page}.page:last-child{break-after:auto}.sample{padding:20px;font-size:12px;line-height:1.5}.number{font-size:54px;font-weight:bold}.booklet-footer{position:absolute;bottom:8px;left:12px;right:12px;font-size:9px}</style></head><body></body></html>',
  );
  await page.addScriptTag({ path: path.resolve('dist/book.js') });
  await page.evaluate(() => {
    const cells = Array.from({ length: 32 }, (_, index) => {
      const node = document.createElement('div');
      node.className = 'page';
      node.dataset.logicalPage = String(index + 1);
      node.innerHTML = `<div class="sample"><strong>TOP ↑</strong><div class="number">${index + 1}</div><div>Signature ${Math.floor(index / 16) + 1}<br>Piece ${Math.min(Math.ceil(((index % 16) + 1) / 2), Math.ceil((16 - (index % 16)) / 2))}<br>${index % 2 ? 'Left page' : 'Right page'}</div></div><div class="booklet-footer">MicroBook assembly test</div>`;
      document.body.append(node);
      return { index, page: index, x: 0, y: 0, width: 153, height: 198, blockIds: [], text: '' };
    });
    const settings = {
      booklet: {
        pageWidth: 1,
        pageHeight: 1,
        piecesPerSignature: 4,
        bindingMarginMm: 2,
        cutGuides: true,
        foldGuides: true,
        assemblyLabels: true,
      },
    };
    const booklet = Microbook.prepareBooklet({ cells }, settings);
    Microbook.arrangeBooklet(booklet, settings);
    for (const placement of booklet.placements) {
      const leaf = document.querySelector(`[data-logical-page="${placement.pageNumber}"]`);
      leaf.querySelector('.booklet-footer').textContent =
        `S${placement.signature} · Piece ${placement.piece} · ${placement.side.toUpperCase()}`;
    }
  });
  await page.pdf({ path: output, format: 'Letter', printBackground: true, preferCSSPageSize: false });
  process.stdout.write(output + '\n');
} finally {
  await browser.close();
}
