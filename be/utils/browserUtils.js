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
  '--disable-extensions',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI',
  '--disable-ipc-flooding-protection',
];

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
} = {}) {
  const executablePath = resolveBrowserExecutablePath({
    envPath,
    existsSync,
    candidates,
  });

  const launchOptions = {
    args: DEFAULT_LAUNCH_ARGS,
    protocolTimeout: 1000000,
    headless: true,
    devtools: false,
    timeout: 60000,
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return launchOptions;
}

module.exports = {
  DEFAULT_BROWSER_CANDIDATES,
  getPuppeteerLaunchOptions,
  resolveBrowserExecutablePath,
};
