const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateReadingTime,
  calculateSheetsCount,
  normalizeDisplayBookName,
} = require('../utils/outputStats');

test('calculateSheetsCount mirrors frontend paper count rules', () => {
  assert.equal(calculateSheetsCount(78015, '6'), 5);
  assert.equal(calculateSheetsCount(0, '6'), 0);
  assert.equal(calculateSheetsCount(1000, '99'), 0);
});

test('calculateReadingTime mirrors frontend reading time formatting', () => {
  assert.equal(calculateReadingTime(78015), '6 hours 3 minutes');
  assert.equal(calculateReadingTime(20), '1 minute');
  assert.equal(calculateReadingTime(0), '--');
});

test('normalizeDisplayBookName preserves spaces for visible titles', () => {
  assert.equal(normalizeDisplayBookName('  The Prince and the Pauper  '), 'The Prince and the Pauper');
  assert.equal(normalizeDisplayBookName('', 'Untitled'), 'Untitled');
});
