const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PRETEXT_DIST_ROUTE = '/__microbook-pretext/';

function getPretextModuleUrls(backendRoot = path.join(__dirname, '..', '..'), { baseUrl } = {}) {
  const packageRoot = path.join(backendRoot, 'node_modules', '@chenglou', 'pretext');
  const layoutPath = path.join(packageRoot, 'dist', 'layout.js');
  const richInlinePath = path.join(packageRoot, 'dist', 'rich-inline.js');
  const packageJsonPath = path.join(packageRoot, 'package.json');

  const missing = [layoutPath, richInlinePath, packageJsonPath].filter((filePath) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    throw new Error(`Pretext is not installed correctly. Missing: ${missing.join(', ')}`);
  }

  let version = 'unknown';
  try {
    version = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version || version;
  } catch (error) {
    version = 'unknown';
  }

  if (baseUrl) {
    const normalizedBaseUrl = String(baseUrl).endsWith('/') ? String(baseUrl) : `${baseUrl}/`;
    return {
      layoutUrl: new URL(`${PRETEXT_DIST_ROUTE.replace(/^\//, '')}layout.js`, normalizedBaseUrl).href,
      richInlineUrl: new URL(`${PRETEXT_DIST_ROUTE.replace(/^\//, '')}rich-inline.js`, normalizedBaseUrl).href,
      version,
    };
  }

  return {
    layoutUrl: pathToFileURL(layoutPath).href,
    richInlineUrl: pathToFileURL(richInlinePath).href,
    version,
  };
}

module.exports = {
  PRETEXT_DIST_ROUTE,
  getPretextModuleUrls,
};
