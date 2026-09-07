import { useState } from 'react';
import { blockText, customHeadingKind, type RenderSettings } from '@microbook/core';
import type { Workspace } from './LayoutControls';

export function HeadingDetection({ w, settings }: { w: Workspace; settings: RenderSettings }) {
  const rules = settings.customHeadingRules || [];
  const [presets, setPresets] = useState<{ name: string; rules: typeof rules }[]>(() => {
    try { return JSON.parse(localStorage.getItem('microbook-heading-presets') || '[]'); }
    catch { return []; }
  });
  const [name, setName] = useState('');
  const edit = (next: typeof rules) => w.edit({ customHeadingRules: next });
  const matches = w.doc?.blocks.filter(b => customHeadingKind(b, settings)) || [];
  return <details className="heading-detection">
    <summary>Heading detection</summary>
    <p className="muted">Source chapter and part labels are detected automatically. Custom rules override matching text in this book.</p>
    <p className="muted">Match a whole heading: # means a number, * means any text. For example, #: * matches “002: ADJUSTMENTS”. First matching rule wins.</p>
    {rules.map((rule, i) => <div className="heading-rule" key={i}>
      <label>Pattern<input aria-label={`Heading pattern ${i + 1}`} maxLength={200} value={rule.pattern}
        onChange={e => edit(rules.map((r, n) => n === i ? { ...r, pattern: e.target.value } : r))} /></label>
      <label>Treat as<select aria-label={`Heading type ${i + 1}`} value={rule.headingKind}
        onChange={e => edit(rules.map((r, n) => n === i ? { ...r, headingKind: e.target.value as 'chapter' | 'part' } : r))}>
        <option value="chapter">Chapter</option><option value="part">Part</option>
      </select></label>
      <button onClick={() => edit(rules.filter((_, n) => n !== i))}>Remove rule {i + 1}</button>
    </div>)}
    <button disabled={rules.length >= 30} onClick={() => edit([...rules, { pattern: '', headingKind: 'chapter' }])}>Add heading rule</button>
    {!!rules.length && <details open>
      <summary>{matches.length} matching headings</summary>
      <ul>{matches.slice(0, 100).map(b => <li key={b.id}>{blockText(b)} <small>({customHeadingKind(b, settings)})</small></li>)}</ul>
      {matches.length > 100 && <small>Showing the first 100 matches.</small>}
      <small>Review matches before Apply. Paragraphs longer than 500 characters are excluded.</small>
    </details>}
    <details><summary>Reusable presets</summary>
      <label>Preset name<input value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label>
      <button disabled={!name.trim() || !rules.length} onClick={() => {
        const next = [...presets.filter(p => p.name !== name.trim()), { name: name.trim(), rules }].slice(-30);
        localStorage.setItem('microbook-heading-presets', JSON.stringify(next)); setPresets(next); setName('');
      }}>Save preset</button>
      {presets.map(p => <button key={p.name} onClick={() => edit(p.rules)}>Use {p.name}</button>)}
      <small>Presets are saved in this browser. Loading one replaces this book’s draft rules.</small>
    </details>
  </details>;
}
