import { version } from '../../../package.json';
import { useRef } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { defaultSettings, fonts, modeLabels, settingsSchema, type RenderSettings } from '@microbook/core';
import { Dropdown } from './ui';
import { HeadingDetection } from './HeadingDetection';
import { RichFeatures } from './RichFeatures';
import { MetadataEditor } from './MetadataEditor';
import type { useWorkspace } from './useWorkspace';
export type Workspace = ReturnType<typeof useWorkspace>;
export function LayoutControls({ w }: { w: Workspace }) {
  const settingsInput = useRef<HTMLInputElement>(null);
  const s = settingsSchema.parse(w.kept?.settings || w.draft);
  const rich = s.mode === 'book';
  const number = (
    key: keyof RenderSettings,
    label: string,
    unit: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <label className="field" key={key}>
      <span>{key === 'fontSizePx' ? 'Text size' : label}</span>
      <span className="unit-input">
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={s[key] as number}
          onChange={(e) => w.edit({ [key]: Number(e.target.value) })}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
  const check = (key: keyof RenderSettings, label: string) => (
    <label className="check-field" key={key}>
      <span>{key === 'fontSizePx' ? 'Text size' : label}</span>
      <input type="checkbox" checked={!!s[key]} onChange={(e) => w.edit({ [key]: e.target.checked })} />
    </label>
  );
  const notes = w.preview?.result?.diagnostics.length
    ? w.preview.result.diagnostics
    : w.doc?.diagnostics || [];
  const groups = Array.from(
    notes
      .reduce((map, n) => {
        const key = n.code + n.message;
        const old = map.get(key);
        map.set(key, { message: n.message, count: (old?.count || 0) + 1 });
        return map;
      }, new Map<string, { message: string; count: number }>())
      .values(),
  );
  return (
    <div className="layout-controls">
      <div className="segments mode-control" aria-label="Rendering mode">
        {(['classic', 'book'] as const).map((m) => (
          <button key={m} aria-pressed={w.mode === m} disabled={w.busy} onClick={() => w.switchMode(m)}>
            {modeLabels[m]}
          </button>
        ))}
      </div>
      <fieldset disabled={!!w.kept}>
        <label className="field font-field">
          <span>Font</span>
          <Dropdown
            label="Print font"
            value={s.fontFamily}
            options={fonts}
            onChange={(fontFamily) => w.edit({ fontFamily })}
          />
        </label>
        {number('fontSizePx', 'Text size in CSS pixels', 'px', 4, rich ? 12 : 10, rich ? 0.25 : 1)}
        <label className="field">
          <span>Fold lines</span>
          <Dropdown
            label="Fold lines"
            value={s.borderStyle}
            options={['solid', 'dashed', 'dotted', ...(rich ? ['none'] : [])].map((v) => [
              v,
              v[0].toUpperCase() + v.slice(1),
            ])}
            onChange={(borderStyle) => w.edit({ borderStyle: borderStyle as RenderSettings['borderStyle'] })}
          />
        </label>
        <label className="field">
          <span>Reading order</span>
          <Dropdown
            label="Reading order"
            value={s.readingOrder}
            options={[
              ['rows', 'Across rows'],
              ['quadrants', 'By quadrant'],
            ]}
            onChange={(readingOrder) =>
              w.edit({
                readingOrder: readingOrder as RenderSettings['readingOrder'],
                foldGapEveryRow: readingOrder === 'rows',
              })
            }
          />
        </label>
        {check('foldGaps', 'Space at folds')}
        {s.foldGaps && <>{number('foldGapMm', 'Fold gap size', 'mm', 0.5, 6, 0.25)}</>}
        {rich && (
          <>
            {check('positionHeaders', 'Position headers')}
            {number('lineHeight', 'Line height', '×', 1, 1.6, 0.05)}
            <RichFeatures w={w} group="navigation" />
            <RichFeatures w={w} group="references" />
            <details>
              <summary>Paragraphs</summary>
              <label className="field">
                <span>Treatment</span>
                <Dropdown
                  label="Paragraphs"
                  value={s.paragraphStyle}
                  options={[
                    ['continuous', 'Continuous'],
                    ['lines', 'New line'],
                    ['spaced', 'Blank line'],
                    ['markers', 'Compact markers ¶'],
                  ]}
                  onChange={(paragraphStyle) =>
                    w.edit({ paragraphStyle: paragraphStyle as RenderSettings['paragraphStyle'] })
                  }
                />
              </label>
              {number('paragraphIndentEm', 'Indent', 'em', 0, 3, 0.1)}
              {number('paragraphGapEm', 'Paragraph gap', 'em', 0, 2, 0.1)}
              <RichFeatures w={w} group="passages" />
            </details>
            <details>
              <summary>Headings</summary>
              {(['chapter', 'part'] as const).map((kind) => (
                <div className="heading-group" key={kind}>
                  <label className="field">
                    <span>{kind === 'part' ? 'Part style' : 'Chapter style'}</span>
                    <Dropdown
                      label={kind === 'part' ? 'Part style' : 'Chapter style'}
                      value={s[`${kind}HeadingStyle`]}
                      options={[
                        ['upright', 'Upright'],
                        ['italic', 'Italic'],
                      ]}
                      onChange={(value) => w.edit({ [`${kind}HeadingStyle`]: value })}
                    />
                  </label>
                  {number(
                    `${kind}HeadingScale`,
                    kind === 'part' ? 'Part size' : 'Chapter size',
                    '×',
                    0.65,
                    kind === 'part' ? 3 : 2.5,
                    0.05,
                  )}
                  {number(
                    `${kind}HeadingGapEm`,
                    kind === 'part' ? 'Part spacing' : 'Chapter spacing',
                    'em',
                    0,
                    2,
                    0.05,
                  )}
                </div>
              ))}
              {number('headingScale', 'Other headings', '×', 0.65, 2.5, 0.05)}
              {check('headingRules', 'Divider lines')}
              <HeadingDetection w={w} settings={s} />
              <RichFeatures w={w} group="headings" />
            </details>
          </>
        )}
        <details>
          <summary>Book details</summary>
          {w.metadata && (
            <MetadataEditor
              metadata={w.metadata}
              manualFields={w.docPrefs?.manualFields || []}
              onChange={(metadata, field) =>
                w.doc &&
                w.prefs.document(w.doc.id, {
                  metadata,
                  manualFields: field
                    ? [...new Set([...(w.docPrefs?.manualFields || []), field])]
                    : w.docPrefs?.manualFields,
                })
              }
            />
          )}
        </details>
        <details>
          <summary>Advanced</summary>
          <p className="image-output-help">MicroBook {version}</p>
          {rich && (
            <>
              <label className="check-field">
                <span>Wrap printed contents titles</span>
                <input
                  type="checkbox"
                  checked={s.rich.contentsWrap}
                  onChange={(e) => w.edit({ rich: { ...s.rich, contentsWrap: e.target.checked } })}
                />
              </label>
              {number('marginMm', 'Page margins', 'mm', 0, 12, 0.5)}
              {check('sourcePageNumbers', 'Source page numbers')}
              <label className="field">
                <span>Opening image order</span>
                <Dropdown
                  label="Opening image order"
                  value={s.rich.openingImageOrder}
                  options={[
                    ['text-first', 'Text first'],
                    ['image-first', 'Image first'],
                    ['source', 'Keep source order'],
                  ]}
                  onChange={(openingImageOrder) =>
                    w.edit({
                      rich: {
                        ...s.rich,
                        openingImageOrder: openingImageOrder as typeof s.rich.openingImageOrder,
                      },
                    })
                  }
                />
              </label>
            </>
          )}
          <div className="settings-file-actions">
            <button
              className="full-button"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = 'microbook-settings.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={14} />
              Export settings
            </button>
            <button className="full-button" onClick={() => settingsInput.current?.click()}>
              <Upload size={14} />
              Import settings
            </button>
            <input
              ref={settingsInput}
              className="sr-only"
              type="file"
              accept=".json,application/json"
              aria-label="Import settings JSON"
              onChange={(event) => {
                void w.importSettings(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>
          <button
            className="full-button"
            onClick={() => w.doc && w.prefs.edit(w.doc.id, defaultSettings(w.mode))}
          >
            <RotateCcw size={14} />
            Reset {modeLabels[w.mode]} settings
          </button>
          <small>
            {s.fontSizePx} px = {s.fontSizePx * 0.75} pt · Letter · 4 × 4
          </small>
          {groups.length > 0 && (
            <details>
              <summary>Import notes · {groups.length}</summary>
              <ul className="diagnostics">
                {groups.map((n, i) => (
                  <li key={i}>
                    {n.message}
                    {n.count > 1 ? ` ×${n.count}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </details>
      </fieldset>
    </div>
  );
}
