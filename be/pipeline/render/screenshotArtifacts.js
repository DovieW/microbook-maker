const fs = require('fs');
const path = require('path');

const DEFAULT_SCREENSHOT_ROUTE_BASE = '/history';

function getScreenshotArtifactPaths({ id, generatedDir, routeBase = DEFAULT_SCREENSHOT_ROUTE_BASE }) {
  const firstPageFileName = `screenshot_${id}_page1.png`;

  return {
    firstPage: {
      fileName: firstPageFileName,
      path: path.join(generatedDir, firstPageFileName),
      url: `${routeBase}/${encodeURIComponent(firstPageFileName)}`,
    },
  };
}

function extractJobIdFromOutputHtmlPath(outputHtmlPath) {
  const fileName = path.basename(outputHtmlPath);
  const match = /^output_(.+)\.html$/i.exec(fileName);
  return match ? match[1] : null;
}

function resolveOutputHtmlTarget(input, {
  generatedDir,
  existsSync = fs.existsSync,
} = {}) {
  if (!input || typeof input !== 'string') {
    throw new Error('Provide a job id or an output_<id>.html path.');
  }

  const directPath = path.resolve(input);
  if (existsSync(directPath)) {
    const id = extractJobIdFromOutputHtmlPath(directPath);
    if (!id) {
      throw new Error(`Expected generated HTML file name like output_<id>.html: ${directPath}`);
    }

    return {
      id,
      htmlPath: directPath,
    };
  }

  if (!generatedDir) {
    throw new Error('generatedDir is required when resolving a job id.');
  }

  const id = input;
  const htmlPath = path.join(generatedDir, `output_${id}.html`);
  if (!existsSync(htmlPath)) {
    throw new Error(`Generated HTML not found for job ${id}: ${htmlPath}`);
  }

  return {
    id,
    htmlPath,
  };
}

function normalizeScreenshotClip(bounds) {
  if (!bounds) {
    throw new Error('Cannot capture screenshot because no .page element was found.');
  }

  const width = Math.max(1, Math.ceil(Number(bounds.width) || 0));
  const height = Math.max(1, Math.ceil(Number(bounds.height) || 0));

  return {
    x: Math.max(0, Math.floor(Number(bounds.x) || 0)),
    y: Math.max(0, Math.floor(Number(bounds.y) || 0)),
    width,
    height,
  };
}

async function getFirstPageClip(page) {
  const bounds = await page.evaluate(() => {
    const firstPage = document.querySelector('.page');
    if (!firstPage) {
      return null;
    }

    const rect = firstPage.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  });

  return normalizeScreenshotClip(bounds);
}

async function captureFirstPageScreenshot(page, {
  id,
  generatedDir,
  routeBase = DEFAULT_SCREENSHOT_ROUTE_BASE,
  capturedAt = new Date().toISOString(),
} = {}) {
  if (!id) {
    throw new Error('id is required to capture a screenshot artifact.');
  }
  if (!generatedDir) {
    throw new Error('generatedDir is required to capture a screenshot artifact.');
  }

  fs.mkdirSync(generatedDir, { recursive: true });

  const artifacts = getScreenshotArtifactPaths({ id, generatedDir, routeBase });
  const clip = await getFirstPageClip(page);

  await page.screenshot({
    path: artifacts.firstPage.path,
    clip,
    captureBeyondViewport: true,
  });

  const stats = fs.statSync(artifacts.firstPage.path);

  return {
    firstPage: {
      ...artifacts.firstPage,
      relativePath: path.basename(artifacts.firstPage.path),
      width: clip.width,
      height: clip.height,
      clip,
      viewport: page.viewport(),
      bytes: stats.size,
      capturedAt,
    },
  };
}

module.exports = {
  DEFAULT_SCREENSHOT_ROUTE_BASE,
  captureFirstPageScreenshot,
  extractJobIdFromOutputHtmlPath,
  getFirstPageClip,
  getScreenshotArtifactPaths,
  normalizeScreenshotClip,
  resolveOutputHtmlTarget,
};
