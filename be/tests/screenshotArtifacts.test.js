const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  extractJobIdFromOutputHtmlPath,
  getScreenshotArtifactPaths,
  normalizeScreenshotClip,
  resolveOutputHtmlTarget,
} = require('../pipeline/render/screenshotArtifacts');

test('getScreenshotArtifactPaths returns stable first-page screenshot artifact info', () => {
  const generatedDir = path.join('/tmp', 'microbook-generated');
  const artifacts = getScreenshotArtifactPaths({
    id: '20260429214737_acbf9d14-9366-4d9e-8f37-563a4b7ae039',
    generatedDir,
  });

  assert.equal(
    artifacts.firstPage.fileName,
    'screenshot_20260429214737_acbf9d14-9366-4d9e-8f37-563a4b7ae039_page1.png'
  );
  assert.equal(
    artifacts.firstPage.path,
    path.join(generatedDir, 'screenshot_20260429214737_acbf9d14-9366-4d9e-8f37-563a4b7ae039_page1.png')
  );
  assert.equal(
    artifacts.firstPage.url,
    '/history/screenshot_20260429214737_acbf9d14-9366-4d9e-8f37-563a4b7ae039_page1.png'
  );
});

test('extractJobIdFromOutputHtmlPath reads generated output ids', () => {
  assert.equal(
    extractJobIdFromOutputHtmlPath('/repo/be/generated/output_20260429214737_acbf9d14.html'),
    '20260429214737_acbf9d14'
  );
  assert.equal(extractJobIdFromOutputHtmlPath('/repo/be/generated/not-output.html'), null);
});

test('resolveOutputHtmlTarget accepts a direct output html path', () => {
  const htmlPath = path.join('/repo', 'be', 'generated', 'output_abc123.html');
  const target = resolveOutputHtmlTarget(htmlPath, {
    existsSync: (candidate) => candidate === htmlPath,
  });

  assert.deepEqual(target, {
    id: 'abc123',
    htmlPath,
  });
});

test('resolveOutputHtmlTarget accepts a job id when generated html exists', () => {
  const generatedDir = path.join('/repo', 'be', 'generated');
  const target = resolveOutputHtmlTarget('abc123', {
    generatedDir,
    existsSync: (candidate) => candidate === path.join(generatedDir, 'output_abc123.html'),
  });

  assert.deepEqual(target, {
    id: 'abc123',
    htmlPath: path.join(generatedDir, 'output_abc123.html'),
  });
});

test('normalizeScreenshotClip rounds page bounds to a safe positive screenshot clip', () => {
  assert.deepEqual(
    normalizeScreenshotClip({ x: 0.2, y: 1.8, width: 815.4, height: 1055.1 }),
    { x: 0, y: 1, width: 816, height: 1056 }
  );
});
