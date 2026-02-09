const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_FONT_FAMILY,
  FONT_OPTIONS,
  getAvailableFontOptions,
  getDefaultFontFamily,
  resolveFontFamily,
} = require('../pipeline/render/fontCatalog');

test('FONT_OPTIONS includes arial key and label', () => {
  const arialOption = FONT_OPTIONS.find((option) => option.value === 'arial');

  assert.ok(arialOption);
  assert.equal(arialOption.label, 'Arial');
});

test('DEFAULT_FONT_FAMILY is arial', () => {
  assert.equal(DEFAULT_FONT_FAMILY, 'arial');
});

test('getAvailableFontOptions filters catalog to installed families', () => {
  const available = getAvailableFontOptions({
    installedFamilies: new Set(['dejavu sans', 'times new roman']),
  });

  assert.deepEqual(
    available.map((option) => option.value),
    ['times-new-roman', 'dejavu-sans']
  );
});

test('getDefaultFontFamily prefers arial when available and falls back to first available', () => {
  assert.equal(getDefaultFontFamily([
    { value: 'dejavu-sans', label: 'DejaVu Sans' },
    { value: 'arial', label: 'Arial' },
  ]), 'arial');

  assert.equal(getDefaultFontFamily([
    { value: 'dejavu-serif', label: 'DejaVu Serif' },
  ]), 'dejavu-serif');
});

test('resolveFontFamily returns default for unknown value', () => {
  assert.equal(resolveFontFamily('unknown-font'), 'arial');
  assert.equal(resolveFontFamily(''), 'arial');
});

test('resolveFontFamily accepts valid values case-insensitively', () => {
  assert.equal(resolveFontFamily('arial'), 'arial');
  assert.equal(resolveFontFamily('Times-New-Roman'), 'times-new-roman');
  assert.equal(resolveFontFamily('COURIER-NEW'), 'courier-new');
});

test('resolveFontFamily respects allowed values and falls back when value is unavailable', () => {
  const allowedValues = new Set(['dejavu-sans']);

  assert.equal(resolveFontFamily('arial', { allowedValues }), 'dejavu-sans');
  assert.equal(resolveFontFamily('DEJAVU-SANS', { allowedValues }), 'dejavu-sans');
});
