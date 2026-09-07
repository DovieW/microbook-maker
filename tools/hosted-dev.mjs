// Local Cloudflare-frontend harness; PDFs use a disposable local Chromium instance.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer';
const browser = await puppeteer.connect({
  browserURL: process.env.LOCAL_BROWSER_URL || 'http://127.0.0.1:39222',
});
const app = express();
app.post('/_cloud/print', express.text({ type: 'text/html', limit: '24mb' }), async (req, res) => {
  const page = await browser.newPage();
  try {
    await fs.writeFile('.artifacts/hosted/prepared.html', req.body);
    await page.setContent(req.body, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    res
      .type('application/pdf')
      .send(Buffer.from(await page.pdf({ format: 'Letter', printBackground: true })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await page.close();
  }
});
app.use(express.static(path.resolve('.cloudflare/output/v0/workers/default/assets')));
const server = app.listen(Number(process.env.PORT || 39101), '127.0.0.1', () =>
  console.log('Hosted frontend harness ready'),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close();
    browser.disconnect();
    process.exit();
  });
