import { newRichFeatures, richFeaturesSchema, type RichFeatures as Features } from '@microbook/core';
import { Dropdown } from './ui';
import type { Workspace } from './LayoutControls';
export function RichFeatures({
  w,
  group,
}: {
  w: Workspace;
  group: 'navigation' | 'references' | 'passages' | 'headings' | 'images';
}) {
  const s = richFeaturesSchema.parse((w.kept?.settings || w.draft).rich || {});
  const edit = (change: Partial<Features>) => w.edit({ rich: { ...s, ...change } });
  const select = (key: keyof Features, label: string, options: [string, string][]) => (
    <label className="field feature-field">
      <span>{label}</span>
      <Dropdown
        label={label}
        value={s[key] as string}
        options={options}
        onChange={(value) => edit({ [key]: value })}
      />
    </label>
  );
  const check = (key: keyof Features, label: string) => (
    <label className="check-field">
      <span>{label}</span>
      <input type="checkbox" checked={!!s[key]} onChange={(e) => edit({ [key]: e.target.checked })} />
    </label>
  );
  const number = (key: 'passageGapEm' | 'passageIndentEm', label: string, max: number) => (
    <label className="field">
      <span>{label}</span>
      <span className="unit-input">
        <input
          type="number"
          aria-label={label}
          min={0}
          max={max}
          step={0.05}
          value={s[key]}
          onChange={(e) => edit({ [key]: Number(e.target.value) })}
        />
        <span>em</span>
      </span>
    </label>
  );
  if (group === 'navigation')
    return (
      <details>
        <summary>Navigation &amp; references</summary>
        {select('contents', 'Printed contents', [
          ['compact', 'Compact generated'],
          ['publisher', 'Publisher’s original'],
          ['none', 'None'],
        ])}
        {select('contentsDepth', 'Contents depth', [
          ['chapters', 'Parts and chapters'],
          ['all', 'All sections'],
        ])}
        {check('bookmarks', 'PDF bookmarks')}
        {select('bookmarkDepth', 'Bookmark depth', [
          ['chapters', 'Parts and chapters'],
          ['all', 'All sections'],
        ])}
        {check('chapterHeaders', 'Chapter names in mini headers')}
        {select('pageReferences', 'Original page references', [
          ['off', 'Off'],
          ['headers', 'Mini headers'],
          ['boundaries', 'Source boundaries'],
        ])}
        {!w.doc?.pageList?.length && !w.doc?.blocks.some((b) => b.pageLabel) && (
          <small>No original page markers supplied by this book.</small>
        )}
        <button className="full-button" onClick={() => edit(newRichFeatures())}>
          Use new Rich defaults
        </button>
        <small>Changes apply to this book only, after Apply.</small>
      </details>
    );
  if (group === 'references')
    return (
      <details>
        <summary>Links &amp; notes</summary>
        {select('urls', 'Printed URLs', [
          ['inline', 'After link text'],
          ['chapter', 'After chapter'],
          ['book', 'End of book'],
          ['hidden', 'Hidden'],
        ])}
        {check('internalReferences', 'Print internal link locations')}
        {check('clickableLinks', 'Clickable PDF links')}
        {select('notes', 'Note placement', [
          ['chapter', 'After chapter'],
          ['paragraph', 'After referring paragraph'],
          ['book', 'End of book'],
          ['source', 'Source placement'],
          ['legacy', 'Existing layout'],
        ])}
        <small>Near-reference notes follow the paragraph; they are not pinned to the cell’s bottom.</small>
      </details>
    );
  if (group === 'passages')
    return (
      <details>
        <summary>Special passages</summary>
        {check('passages', 'Preserve passage formatting')}
        {(['quote', 'epigraph', 'letter', 'poetry', 'aside'] as const).map((type) => (
          <label className="check-field" key={type}>
            <span>
              {
                {
                  quote: 'Quotations',
                  epigraph: 'Epigraphs',
                  letter: 'Letters',
                  poetry: 'Poetry',
                  aside: 'Asides',
                }[type]
              }
            </span>
            <input
              type="checkbox"
              checked={s.passageTypes.includes(type)}
              onChange={(e) =>
                edit({
                  passageTypes: e.target.checked
                    ? [...s.passageTypes, type]
                    : s.passageTypes.filter((t) => t !== type),
                })
              }
            />
          </label>
        ))}
        {number('passageGapEm', 'Passage spacing', 2)}
        {number('passageIndentEm', 'Passage indentation', 3)}
      </details>
    );
  if (group === 'headings')
    return (
      <>
        {select('headingFonts', 'Heading font', [
          ['microbook', 'MicroBook'],
          ['publisher', 'Publisher when available'],
        ])}
        {!w.doc?.publisherFonts?.length && (
          <small>No usable publisher fonts found; MicroBook’s heading font will be used.</small>
        )}
        {check('dropCaps', 'Chapter drop caps')}
        <label className="field">
          <span>Drop cap height</span>
          <Dropdown
            label="Drop cap height"
            value={String(s.dropCapLines)}
            options={[
              ['2', 'Two lines'],
              ['3', 'Three lines'],
            ]}
            onChange={(v) => edit({ dropCapLines: Number(v) as 2 | 3 })}
          />
        </label>
      </>
    );
  return select('vectors', 'Vector illustrations', [
    ['preserve', 'Preserve vector'],
    ['raster', 'Raster compatibility'],
  ]);
}
