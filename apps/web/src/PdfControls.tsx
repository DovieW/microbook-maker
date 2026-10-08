import { Dropdown } from './ui';
import type { Workspace } from './LayoutControls';
export function PdfControls({ w }: { w: Workspace }) {
  const s = w.kept?.settings || w.draft;
  const pdf = s.pdf;
  return (
    <div className="pdf-controls">
      <p className="image-output-help">PDF pages keep their original text, fonts, and layout.</p>
      {s.printFormat !== 'booklet' && (
        <label className="field">
          <span>Size per PDF page</span>
          <Dropdown
            label="Size per PDF page"
            value={String(pdf.cellsPerPage)}
            options={[
              ['1', '1 cell'],
              ['2', '2 cells'],
              ['4', '4 cells'],
            ]}
            onChange={(value) => w.edit({ pdf: { ...pdf, cellsPerPage: Number(value) as 1 | 2 | 4 } })}
          />
        </label>
      )}
      <label className="field">
        <span>Page rotation</span>
        <Dropdown
          label="PDF page rotation"
          value={pdf.rotation}
          options={[
            ['original', 'As in PDF'],
            ['auto', 'Best fit'],
            ['90', '90° clockwise'],
            ['180', '180°'],
            ['270', '90° counterclockwise'],
          ]}
          onChange={(value) => w.edit({ pdf: { ...pdf, rotation: value as typeof pdf.rotation } })}
        />
      </label>
      <label className="field">
        <span>Page padding</span>
        <span className="unit-input">
          <input
            aria-label="PDF page padding"
            type="number"
            min="0"
            max="12"
            step="0.5"
            value={pdf.paddingMm}
            onChange={(e) => w.edit({ pdf: { ...pdf, paddingMm: Number(e.target.value) } })}
          />
          <span>mm</span>
        </span>
      </label>
      {s.printFormat !== 'booklet' && (
        <label className="check-field">
          <span>Source page numbers</span>
          <input
            type="checkbox"
            checked={pdf.pageNumbers}
            onChange={(e) => w.edit({ pdf: { ...pdf, pageNumbers: e.target.checked } })}
          />
        </label>
      )}
      {s.printFormat === 'booklet' && <small>One source PDF page per booklet page.</small>}
    </div>
  );
}
