import { useEffect, useMemo, useState } from 'react';
import { orderedSections, type CellMap } from '@microbook/core';
import { printedLocation } from './imageLocations';
import type { Workspace } from './LayoutControls';
export function ContentsPane({ w }: { w: Workspace }) {
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<{ id: string; target: string } | null>(null);
  const [announcement, announce] = useState('');
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
  const sections = orderedSections(w.doc, (w.kept?.settings || w.draft).sectionOrder);
  const move = (id: string, position: number) => {
    if (w.kept || !Number.isInteger(position) || position < 1 || position > sections.length) return;
    const ids = sections.map((s) => s.id).filter((key) => key !== id);
    ids.splice(position - 1, 0, id);
    w.edit({ sectionOrder: ids });
    announce(`Moved ${sections.find((s) => s.id === id)?.title} to position ${position}`);
  };
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
      <div className="contents-order-tools">
        <span>Drag ⋮⋮ or enter a position</span>
        <button
          disabled={!!w.kept || !w.draft.sectionOrder?.length}
          onClick={() => w.edit({ sectionOrder: [] })}
        >
          Restore order
        </button>
      </div>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <div className="contents-list">
        {sections
          .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
          .map((s) => {
            const location = locations.get(s.id);
            return (
              <div
                className={`contents-row${drag?.target === s.id ? ' reorder-target' : ''}`}
                data-section-id={s.id}
                key={s.id}
              >
                <div className="contents-position">
                  <button
                    className="contents-drag"
                    aria-label={`Move ${s.title}; use arrow keys to reorder`}
                    disabled={!!w.kept || !!query}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        move(s.id, sections.findIndex((x) => x.id === s.id) + (e.key === 'ArrowUp' ? 0 : 2));
                      }
                      if (e.key === 'Escape') setDrag(null);
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDrag({ id: s.id, target: s.id });
                    }}
                    onPointerMove={(e) => {
                      if (!drag) return;
                      const row = document
                        .elementFromPoint(e.clientX, e.clientY)
                        ?.closest<HTMLElement>('[data-section-id]');
                      if (row?.dataset.sectionId) setDrag({ ...drag, target: row.dataset.sectionId });
                      const body = e.currentTarget.closest('.sidebar-body');
                      if (body) {
                        const rect = body.getBoundingClientRect();
                        if (e.clientY < rect.top + 40) body.scrollTop -= 16;
                        if (e.clientY > rect.bottom - 40) body.scrollTop += 16;
                      }
                    }}
                    onPointerUp={() => {
                      if (drag && drag.id !== drag.target)
                        move(drag.id, sections.findIndex((x) => x.id === drag.target) + 1);
                      setDrag(null);
                    }}
                    onPointerCancel={() => setDrag(null)}
                  >
                    ⋮⋮
                  </button>
                  <Position
                    title={s.title}
                    value={sections.findIndex((x) => x.id === s.id) + 1}
                    max={sections.length}
                    disabled={!!w.kept}
                    move={(n) => move(s.id, n)}
                  />
                </div>
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

function Position({
  title,
  value,
  max,
  disabled,
  move,
}: {
  title: string;
  value: number;
  max: number;
  disabled: boolean;
  move: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isInteger(n) && n >= 1 && n <= max && n !== value) move(n);
    else setText(String(value));
  };
  return (
    <input
      className="contents-position-input"
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      aria-label={`Position of ${title}`}
      disabled={disabled}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          setText(String(value));
        }
      }}
    />
  );
}
