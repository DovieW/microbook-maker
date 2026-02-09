const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTokenStyles } = require('../pipeline/render/tokenStyles');

test('buildTokenStyles uses deterministic left-aligned body spacing', () => {
  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'dashed',
  });

  assert.match(styles, /\.grid-item\s*\{[^}]*text-align:\s*left;/s);
  assert.doesNotMatch(styles, /\.grid-item\s*\{[^}]*text-justify:/s);
  assert.match(styles, /\.token-body\s*\{[^}]*line-height:\s*1\.05;/s);
  assert.match(styles, /\.token-body\s*\{[^}]*letter-spacing:\s*0;/s);
});

test('buildTokenStyles uses moderate heading size scale', () => {
  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'solid',
  });

  assert.match(styles, /\.token-heading-1\s*\{\s*font-size:\s*1\.15em;\s*\}/s);
  assert.match(styles, /\.token-heading-2\s*\{\s*font-size:\s*1\.1em;\s*\}/s);
  assert.match(styles, /\.token-heading-3\s*\{\s*font-size:\s*1\.06em;\s*\}/s);
});

test('buildTokenStyles keeps mini sheet header compact', () => {
  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'dotted',
  });

  assert.match(styles, /\.miniSheetNum\s*\{[^}]*display:\s*inline-block;/s);
  assert.match(styles, /\.miniSheetNum\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(styles, /\.miniSheetNum\s*\{[^}]*margin-right:\s*0\.25em;/s);
});

test('buildTokenStyles renders paragraph separators as literal preserved spaces', () => {
  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'dashed',
  });

  assert.match(styles, /\.token-break-paragraph-space\s*\{[^}]*display:\s*inline;/s);
  assert.match(styles, /\.token-break-paragraph-space\s*\{[^}]*white-space:\s*pre;/s);
});
