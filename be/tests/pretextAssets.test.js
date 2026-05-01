const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { getPretextModuleUrls } = require('../pipeline/render/pretextAssets');

test('getPretextModuleUrls resolves installed Pretext ESM browser modules', () => {
  const backendRoot = path.join(__dirname, '..');
  const urls = getPretextModuleUrls(backendRoot);

  assert.equal(typeof urls.version, 'string');
  assert.match(urls.version, /^\d+\.\d+\.\d+/);
  assert.match(urls.layoutUrl, /^file:\/\//);
  assert.match(urls.layoutUrl, /@chenglou\/pretext\/dist\/layout\.js$/);
  assert.match(urls.richInlineUrl, /^file:\/\//);
  assert.match(urls.richInlineUrl, /@chenglou\/pretext\/dist\/rich-inline\.js$/);
});

test('getPretextModuleUrls can resolve same-origin renderer URLs', () => {
  const backendRoot = path.join(__dirname, '..');
  const urls = getPretextModuleUrls(backendRoot, { baseUrl: 'http://127.0.0.1:3001' });

  assert.equal(urls.layoutUrl, 'http://127.0.0.1:3001/__microbook-pretext/layout.js');
  assert.equal(urls.richInlineUrl, 'http://127.0.0.1:3001/__microbook-pretext/rich-inline.js');
});
