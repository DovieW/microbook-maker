const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTokenStyles, normalizeBorderStyle } = require('../pipeline/render/tokenStyles');

test('buildTokenStyles exposes deterministic Pretext-adjustable body spacing', () => {
  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'dashed',
  });

  assert.match(styles, /\.grid-item\s*\{[^}]*--microbook-text-align:\s*left;/s);
  assert.match(styles, /\.grid-item\s*\{[^}]*text-align:\s*var\(--microbook-text-align, left\);/s);
  assert.match(styles, /\.grid-item\s*\{[^}]*text-justify:\s*inter-word;/s);
  assert.match(styles, /\.grid-item\.microbook-horizontal-justified\s*\{[^}]*--microbook-text-align:\s*justify;/s);
  assert.match(styles, /\.grid-item\.microbook-horizontal-justified \.token-body,/s);
  assert.match(styles, /\.grid-item\.microbook-horizontal-justified \.token \s*\{[^}]*hyphens:\s*auto;/s);
  assert.match(styles, /\.grid-item\s*\{[^}]*--microbook-line-height:\s*1;/s);
  assert.match(styles, /\.token-body\s*\{[^}]*line-height:\s*var\(--microbook-line-height, 1\);/s);
  assert.match(styles, /\.token-body\s*\{[^}]*letter-spacing:\s*var\(--microbook-letter-spacing, 0px\);/s);
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

test('buildTokenStyles renders paragraph separators as collapsible single spaces', () => {
  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'dashed',
  });

  assert.match(styles, /\.token-break-paragraph-space\s*\{[^}]*display:\s*inline;/s);
  assert.match(styles, /\.token-break-paragraph-space\s*\{[^}]*white-space:\s*normal;/s);
});

test('buildTokenStyles keeps big headers left aligned when cell text is justified', () => {
  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'dashed',
  });

  assert.match(styles, /\.grid-item\.microbook-horizontal-justified \.main-header\s*\{[^}]*text-align:\s*left;/s);
  assert.match(styles, /\.grid-item\.microbook-horizontal-justified \.main-header\s*\{[^}]*text-align-last:\s*left;/s);
});

test('buildTokenStyles falls back for unsupported border styles', () => {
  assert.equal(normalizeBorderStyle('solid'), 'solid');
  assert.equal(normalizeBorderStyle('dashed'), 'dashed');
  assert.equal(normalizeBorderStyle('dotted'), 'dotted');
  assert.equal(normalizeBorderStyle('solid; color: red;'), 'dashed');

  const styles = buildTokenStyles({
    selectedFontStack: "Arial, sans-serif",
    borderStyle: 'solid; color: red;',
  });

  assert.doesNotMatch(styles, /color:\s*red/);
  assert.match(styles, /border-right:\s*1px dashed black;/);
});
