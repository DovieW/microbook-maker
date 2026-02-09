const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveBrowserExecutablePath,
  getPuppeteerLaunchOptions,
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
});

