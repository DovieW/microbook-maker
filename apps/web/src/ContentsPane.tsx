import { useMemo, useState } from 'react';
import type { CellMap } from '@microbook/core';
import { printedLocation } from './imageLocations';
import type { Workspace } from './LayoutControls';
export function ContentsPane({ w }: { w: Workspace }) {
  const [query, setQuery] = useState('');
  const locations = useMemo(() => {
    const map = new Map<string, CellMap>();
    const sections = new Map(w.doc?.blocks.map((block) => [block.id, block.sectionId]));
    for (const cell of w.preview?.result?.cells || []) {
      if (cell.sectionId && !map.has(cell.sectionId)) map.set(cell.sectionId, cell);
      for (const id of cell.blockIds) {
        const section = sections.get(id);
        if (section && !map.has(section)) map.set(section, cell);
      }
    }
    return map;
  }, [w.doc, w.preview?.result]);
  if (!w.doc) return null;
  const selected = (w.kept?.settings || w.draft).selectedSections || w.doc.sections.map((s) => s.id);
  const allSelected = w.doc.sections.every((s) => selected.includes(s.id));
  return (
    <div className="contents-pane">
      <input
        aria-label="Find section"
        type="search"
        placeholder="Find section…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="list-summary">
        <span>
          {selected.length} / {w.doc.sections.length} included
        </span>
        <button disabled={!!w.kept} onClick={() => w.edit({ selectedSections: allSelected ? [] : null })}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="contents-list">
        {w.doc.sections
          .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
          .map((s) => {
            const location = locations.get(s.id);
            return (
              <div className="contents-row" key={s.id}>
                <button
                  className="contents-jump"
                  disabled={!location}
                  onClick={() => location && w.goTo(location.index)}
                >
                  <span>{s.title}</span>
                  <small>{location ? printedLocation(location.page) : 'Not in preview'}</small>
                </button>
                <input
                  type="checkbox"
                  aria-label={`Include ${s.title}`}
                  disabled={!!w.kept}
                  checked={selected.includes(s.id)}
                  onChange={(e) =>
                    w.edit({
                      selectedSections: e.target.checked
                        ? [...selected, s.id]
                        : selected.filter((id) => id !== s.id),
                    })
                  }
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}
