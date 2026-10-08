import { useState } from 'react';
import { orderedSections, type ImageRotation } from '@microbook/core';
import { ContentPosition, ContentRowHeader, type ContentDrag } from './ContentRow';
import { SectionPreview } from './SectionPreview';
import { Dropdown } from './ui';
import { printedLocation } from './imageLocations';
import type { Workspace } from './LayoutControls';
export function PdfPagesPane({ w }: { w: Workspace }) {
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<ContentDrag>(null);
  if (!w.doc) return null;
  const doc = w.doc,
    s = w.kept?.settings || w.draft;
  const order = orderedSections(doc, s.sectionOrder);
  const selected = s.selectedSections || doc.sections.map((section) => section.id);
  const cells = w.preview?.result?.cells || [];
  const move = (id: string, position: number) => {
    if (w.kept || position < 1 || position > order.length) return;
    const ids = order.map((section) => section.id).filter((entry) => entry !== id);
    ids.splice(position - 1, 0, id);
    w.edit({ sectionOrder: ids });
  };
  return (
    <div className="contents-pane pdf-pages-pane">
      <input
        className="full-input"
        aria-label="Find PDF page"
        placeholder="Find page…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="list-summary">
        <span>
          {selected.length} / {doc.sections.length} pages included
        </span>
        <button
          disabled={!!w.kept}
          onClick={() => w.edit({ selectedSections: selected.length === doc.sections.length ? [] : null })}
        >
          {selected.length === doc.sections.length ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="contents-order-tools">
        <span>Drag pages or enter a position</span>
        <button disabled={!!w.kept || !s.sectionOrder.length} onClick={() => w.edit({ sectionOrder: [] })}>
          Restore order
        </button>
      </div>
      <div className="contents-list">
        {order.map((section, index) => {
          if (!section.title.toLowerCase().includes(query.toLowerCase())) return null;
          const included = selected.includes(section.id),
            cell = cells.find((entry) => entry.sectionId === section.id);
          const expanded = w.selectedSectionId === section.id;
          const info = doc.pdfPages?.[doc.sections.findIndex((entry) => entry.id === section.id)];
          return (
            <div
              key={section.id}
              data-content-token={section.id}
              className={`contents-row${expanded ? ' selected' : ''}${drag?.target === section.id ? ' reorder-target' : ''}`}
            >
              <ContentRowHeader
                title={section.title}
                location={
                  !included
                    ? 'Excluded'
                    : cell
                      ? w.preview?.result?.booklet
                        ? `Booklet page ${cell.index + 1}`
                        : printedLocation(cell.page)
                      : 'Not in current preview'
                }
                expanded={expanded}
                onOpen={() => w.jumpSection(expanded ? '' : section.id, cell?.index)}
                position={
                  <ContentPosition
                    token={section.id}
                    title={section.title}
                    position={index + 1}
                    max={order.length}
                    disabled={!!w.kept}
                    setDrag={setDrag}
                    targetPosition={(id) => order.findIndex((entry) => entry.id === id) + 1}
                    move={(position) => move(section.id, position)}
                  />
                }
              >
                <input
                  type="checkbox"
                  aria-label={`Include ${section.title}`}
                  disabled={!!w.kept}
                  checked={included}
                  onChange={() =>
                    w.edit({
                      selectedSections: included
                        ? selected.filter((id) => id !== section.id)
                        : [...selected, section.id],
                    })
                  }
                />
              </ContentRowHeader>
              {expanded && (
                <div className="pdf-page-options">
                  {cell && w.preview && (
                    <SectionPreview renderId={w.preview.id} title={section.title} cell={cell} fullPage />
                  )}
                  {info && (
                    <small>
                      {((info.width * 25.4) / 72).toFixed(1)} × {((info.height * 25.4) / 72).toFixed(1)} mm in
                      source PDF
                    </small>
                  )}
                  <fieldset disabled={!!w.kept}>
                    <label className="field">
                      <span>This page rotation</span>
                      <Dropdown
                        label={`Rotation of ${section.title}`}
                        value={
                          s.pdf.pageRotations[section.id] === undefined
                            ? 'default'
                            : String(s.pdf.pageRotations[section.id])
                        }
                        options={[
                          ['default', 'Use default'],
                          ['0', 'As in PDF'],
                          ['90', '90° clockwise'],
                          ['180', '180°'],
                          ['270', '90° counterclockwise'],
                        ]}
                        onChange={(value) => {
                          const pageRotations = { ...s.pdf.pageRotations };
                          if (value === 'default') delete pageRotations[section.id];
                          else pageRotations[section.id] = Number(value) as ImageRotation;
                          w.edit({ pdf: { ...s.pdf, pageRotations } });
                        }}
                      />
                    </label>
                  </fieldset>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
