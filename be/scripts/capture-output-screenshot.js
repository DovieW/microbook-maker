#!/usr/bin/env node

const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

const { getPuppeteerLaunchOptions } = require('../utils/browserUtils');
const {
  captureFirstPageScreenshot,
  resolveOutputHtmlTarget,
} = require('../pipeline/render/screenshotArtifacts');

async function main() {
  const input = process.argv[2];
  const backendRoot = path.join(__dirname, '..');
  const generatedDir = path.join(backendRoot, 'generated');

  if (!input || input === '--help' || input === '-h') {
    console.error('Usage: npm run screenshot -- <job-id-or-output-html-path>');
    process.exitCode = input ? 0 : 1;
    return;
  }

  const { id, htmlPath } = resolveOutputHtmlTarget(input, { generatedDir });
  const browser = await puppeteer.launch(getPuppeteerLaunchOptions());

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 816,
      height: 1056,
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });

    const screenshots = await captureFirstPageScreenshot(page, {
      id,
      generatedDir,
    });

    console.log(screenshots.firstPage.path);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
