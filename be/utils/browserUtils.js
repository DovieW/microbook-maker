const fs = require('fs');

const DEFAULT_BROWSER_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
];

const DEFAULT_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  // Docker defaults /dev/shm to 64MB, which is small enough for Chromium renderer
  // crashes on bigger jobs. Falling back to /tmp is slower, but vastly more reliable.
  '--disable-dev-shm-usage',
  // Large renderer-side layout passes can create a lot of DOM and JS state for
  // full books. Give Chromium's V8 heap more room before it gives up dramatically.
  '--js-flags=--max-old-space-size=2048',
  '--disable-extensions',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI',
  '--disable-ipc-flooding-protection',
];

// Large books on slower NAS hardware can legitimately take a long time to lay out.
// These defaults bias toward finishing the job instead of timing out mid-render, and
// the env vars make it easy to tune production without code changes.
const DEFAULT_PROTOCOL_TIMEOUT_MS = 60 * 60 * 1000;
const DEFAULT_LAUNCH_TIMEOUT_MS = 60 * 1000;
const DEFAULT_PAGE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PDF_TIMEOUT_MS = 10 * 60 * 1000;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPuppeteerTimeoutConfig({ env = process.env } = {}) {
  return {
    protocolTimeoutMs: parsePositiveInteger(env.PUPPETEER_PROTOCOL_TIMEOUT_MS, DEFAULT_PROTOCOL_TIMEOUT_MS),
    launchTimeoutMs: parsePositiveInteger(env.PUPPETEER_LAUNCH_TIMEOUT_MS, DEFAULT_LAUNCH_TIMEOUT_MS),
    pageTimeoutMs: parsePositiveInteger(env.PUPPETEER_PAGE_TIMEOUT_MS, DEFAULT_PAGE_TIMEOUT_MS),
    navigationTimeoutMs: parsePositiveInteger(env.PUPPETEER_NAVIGATION_TIMEOUT_MS, DEFAULT_NAVIGATION_TIMEOUT_MS),
    pdfTimeoutMs: parsePositiveInteger(env.PUPPETEER_PDF_TIMEOUT_MS, DEFAULT_PDF_TIMEOUT_MS),
  };
}

function resolveBrowserExecutablePath({
  envPath = process.env.PUPPETEER_EXECUTABLE_PATH || null,
  existsSync = fs.existsSync,
  candidates = DEFAULT_BROWSER_CANDIDATES,
} = {}) {
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getPuppeteerLaunchOptions({
  envPath = process.env.PUPPETEER_EXECUTABLE_PATH || null,
  existsSync = fs.existsSync,
  candidates = DEFAULT_BROWSER_CANDIDATES,
  env = process.env,
} = {}) {
  const timeoutConfig = getPuppeteerTimeoutConfig({ env });
  const executablePath = resolveBrowserExecutablePath({
    envPath,
    existsSync,
    candidates,
  });

  const launchOptions = {
    args: DEFAULT_LAUNCH_ARGS,
    protocolTimeout: timeoutConfig.protocolTimeoutMs,
    headless: true,
    devtools: false,
    timeout: timeoutConfig.launchTimeoutMs,
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return launchOptions;
}

module.exports = {
  DEFAULT_BROWSER_CANDIDATES,
  DEFAULT_LAUNCH_TIMEOUT_MS,
  DEFAULT_NAVIGATION_TIMEOUT_MS,
  DEFAULT_PAGE_TIMEOUT_MS,
  DEFAULT_PDF_TIMEOUT_MS,
  DEFAULT_PROTOCOL_TIMEOUT_MS,
  getPuppeteerLaunchOptions,
  getPuppeteerTimeoutConfig,
  parsePositiveInteger,
  resolveBrowserExecutablePath,
};
