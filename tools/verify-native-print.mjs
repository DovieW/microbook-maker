// Chrome/Linux verification only: an isolated profile forces Save as PDF, never a physical printer.
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const base = option('url', 'http://127.0.0.1:17881');
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('Use an isolated local application, not production.');
}
const out = path.resolve(option('out', '.artifacts/native-print'));
const profile = path.join(out, 'profile');
await fs.mkdir(path.join(profile, 'Default'), { recursive: true });
await fs.writeFile(
  path.join(profile, 'Default', 'Preferences'),
  JSON.stringify({
    printing: {
      print_preview_sticky_settings: {
        appState: JSON.stringify({
          recentDestinations: [{ id: 'Save as PDF', origin: 'local', account: '' }],
          selectedDestinationId: 'Save as PDF',
          version: 2,
          isHeaderFooterEnabled: false,
          scalingType: 3,
        }),
      },
    },
    savefile: { default_directory: out },
  }),
);
const before = new Set(await fs.readdir(out));
const browser = await puppeteer.launch({
  executablePath: option('chrome', '/usr/bin/google-chrome'),
  headless: false,
  userDataDir: profile,
  args: ['--no-sandbox', '--kiosk-printing', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await (
    await page.$('input[type=file]')
  ).uploadFile(path.resolve(option('input', 'tests/fixtures/classic-duplex.txt')));
  await page.waitForFunction(
    () =>
      document.querySelector('.print-action')?.getAttribute('aria-label') === 'Print' &&
      !document.querySelector('.print-action')?.disabled,
    { timeout: 120000 },
  );
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Print preview"]:not([hidden])')?.getAttribute('aria-busy') ===
      'false',
  );
  const id = await page.$eval('[aria-label="Print preview"]:not([hidden])', (el) => el.dataset.renderId);
  const job = await (await fetch(`${base}/api/renders/${id}`)).json();
  await fs.writeFile(
    path.join(out, 'original.pdf'),
    Buffer.from(await (await fetch(`${base}/api/renders/${id}/pdf`)).arrayBuffer()),
  );
  const pagesBefore = (await browser.pages()).length;
  await page.click('.print-action');
  let printed;
  for (let i = 0; i < 60; i++) {
    printed = (await fs.readdir(out)).find(
      (f) => f.endsWith('.pdf') && f !== 'original.pdf' && !before.has(f),
    );
    if (printed) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!printed) throw new Error('Chrome did not save a PDF through the application Print action.');
  const after = await (await fetch(`${base}/api/renders/${id}`)).json();
  const report = {
    renderId: id,
    original: 'original.pdf',
    printed,
    printedSides: job.result.pages,
    sheets: job.result.sheets,
    keptBefore: job.saved,
    keptAfter: after.saved,
    extraTabs: (await browser.pages()).length - pagesBefore,
    errors,
  };
  await fs.writeFile(path.join(out, 'print-report.json'), JSON.stringify(report, null, 2));
  if (report.extraTabs || after.saved !== job.saved || errors.length) throw new Error(JSON.stringify(report));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
