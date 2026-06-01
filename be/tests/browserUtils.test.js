const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_LAUNCH_TIMEOUT_MS,
  DEFAULT_PAGE_TIMEOUT_MS,
  DEFAULT_PDF_TIMEOUT_MS,
  DEFAULT_PROTOCOL_TIMEOUT_MS,
  resolveBrowserExecutablePath,
  getPuppeteerLaunchOptions,
  getPuppeteerTimeoutConfig,
} = require('../utils/browserUtils');

test('resolveBrowserExecutablePath uses env path when it exists', () => {
  const executablePath = resolveBrowserExecutablePath({
    envPath: '/custom/chrome',
    existsSync: (filePath) => filePath === '/custom/chrome',
    candidates: ['/usr/bin/chromium'],
  });

  assert.equal(executablePath, '/custom/chrome');
});

test('resolveBrowserExecutablePath falls back to first available candidate', () => {
  const executablePath = resolveBrowserExecutablePath({
    envPath: null,
    existsSync: (filePath) => filePath === '/usr/bin/google-chrome',
    candidates: ['/usr/bin/chromium', '/usr/bin/google-chrome'],
  });

  assert.equal(executablePath, '/usr/bin/google-chrome');
});

test('resolveBrowserExecutablePath returns null when no browser executable exists', () => {
  const executablePath = resolveBrowserExecutablePath({
    envPath: null,
    existsSync: () => false,
    candidates: ['/usr/bin/chromium', '/usr/bin/google-chrome'],
  });

  assert.equal(executablePath, null);
});

test('getPuppeteerLaunchOptions omits executablePath when no browser exists', () => {
  const options = getPuppeteerLaunchOptions({
    envPath: null,
    existsSync: () => false,
    candidates: ['/usr/bin/chromium'],
  });

  assert.equal('executablePath' in options, false);
  assert.equal(options.headless, true);
  assert.ok(Array.isArray(options.args));
  assert.ok(options.args.includes('--disable-dev-shm-usage'));
  assert.ok(options.args.includes('--js-flags=--max-old-space-size=2048'));
  assert.equal(options.protocolTimeout, DEFAULT_PROTOCOL_TIMEOUT_MS);
  assert.equal(options.timeout, DEFAULT_LAUNCH_TIMEOUT_MS);
});

test('getPuppeteerTimeoutConfig reads timeout overrides from env', () => {
  const timeouts = getPuppeteerTimeoutConfig({
    env: {
      PUPPETEER_PROTOCOL_TIMEOUT_MS: '1200000',
      PUPPETEER_LAUNCH_TIMEOUT_MS: '120000',
      PUPPETEER_PAGE_TIMEOUT_MS: '300000',
      PUPPETEER_NAVIGATION_TIMEOUT_MS: '240000',
      PUPPETEER_PDF_TIMEOUT_MS: '420000',
    },
  });

  assert.equal(timeouts.protocolTimeoutMs, 1200000);
  assert.equal(timeouts.launchTimeoutMs, 120000);
  assert.equal(timeouts.pageTimeoutMs, 300000);
  assert.equal(timeouts.navigationTimeoutMs, 240000);
  assert.equal(timeouts.pdfTimeoutMs, 420000);
});

test('getPuppeteerTimeoutConfig falls back for invalid timeout env values', () => {
  const timeouts = getPuppeteerTimeoutConfig({
    env: {
      PUPPETEER_PROTOCOL_TIMEOUT_MS: 'nope',
      PUPPETEER_PAGE_TIMEOUT_MS: '-1',
      PUPPETEER_PDF_TIMEOUT_MS: '0',
    },
  });

  assert.equal(timeouts.protocolTimeoutMs, DEFAULT_PROTOCOL_TIMEOUT_MS);
  assert.equal(timeouts.pageTimeoutMs, DEFAULT_PAGE_TIMEOUT_MS);
  assert.equal(timeouts.pdfTimeoutMs, DEFAULT_PDF_TIMEOUT_MS);
});

