import { describe, it, expect } from 'vitest';
import { matchesHeadingPattern, customHeadingKind, defaultSettings, type Block } from '../packages/core/src/index';
describe('custom heading rules', () => {
  it('matches complete numbered headings without treating punctuation as regex', () => {
    expect(matchesHeadingPattern('002: ADJUSTMENTS', '#: *')).toBe(true);
    expect(matchesHeadingPattern('  002:   Adjustments ', '#: adjustments')).toBe(true);
    expect(matchesHeadingPattern('Text 002: ADJUSTMENTS', '#: *')).toBe(false);
    expect(matchesHeadingPattern(': ADJUSTMENTS', '#: *')).toBe(false);
    expect(matchesHeadingPattern('ABC', '')).toBe(false);
    expect(matchesHeadingPattern('ABC', '[ABC]')).toBe(false);
  });
  it('preserves order and excludes source page labels and long paragraphs', () => {
    const s = { ...defaultSettings(), customHeadingRules: [
      { pattern: '#: *', headingKind: 'part' as const },
      { pattern: '*', headingKind: 'chapter' as const },
    ] };
    const b = { kind: 'paragraph', inlines: [{ text: '002: ADJUSTMENTS' }] } as Block;
    expect(customHeadingKind(b, s)).toBe('part');
    expect(customHeadingKind({ ...b, pageLabel: '2' }, s)).toBeUndefined();
    expect(customHeadingKind({ ...b, inlines: [{ text: 'A'.repeat(501) }] }, s)).toBeUndefined();
  });
});
