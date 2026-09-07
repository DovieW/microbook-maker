import { automaticImageHeadings, headingLabel, matchingImageBlocks, type Block } from '@microbook/core';
import { Dropdown } from './ui';
import type { Workspace } from './LayoutControls';

export function ImageTreatmentControls({
  w,
  block,
  heading,
}: {
  w: Workspace;
  block: Block;
  heading?: { text: string; headingKind: 'chapter' | 'part' };
}) {
  const s = w.kept?.settings || w.draft;
  const treatment = s.imageTreatments[block.id];
  const kind = heading ? 'heading' : treatment?.kind || 'image';
  const matches = matchingImageBlocks(w.doc!, block);
  const set = (value: typeof treatment) =>
    w.edit({ imageTreatments: { ...s.imageTreatments, [block.id]: value } });
  const current =
    treatment || (heading ? { kind: 'heading' as const, ...heading } : { kind: 'image' as const });
  return (
    <div className="image-treatment-controls">
      <label className="field">
        <span>Treatment</span>
        <Dropdown
          label="Image treatment"
          value={kind}
          options={[
            ['image', 'Illustration'],
            ['flourish', 'Flourish'],
            ['heading', 'Heading'],
          ]}
          onChange={(value) => {
            const text =
              w.doc!.assets.find((a) => a.id === block.assetId)?.alt ||
              w.doc!.sections.find((section) => section.id === block.sectionId)?.title ||
              'Chapter';
            set(
              value === 'flourish'
                ? { kind: 'flourish', widthEm: 4, gapEm: 0.25 }
                : value === 'heading'
                  ? {
                      kind: 'heading',
                      text: text.slice(0, 500),
                      headingKind: headingLabel(text)?.kind || 'chapter',
                    }
                  : { kind: 'image' },
            );
          }}
        />
      </label>
      {treatment?.kind === 'flourish' && (
        <>
          <label className="field">
            <span>Max width</span>
            <span className="unit-input">
              <input
                aria-label="Flourish width"
                type="number"
                min="1"
                max="12"
                step="0.5"
                value={treatment.widthEm}
                onChange={(e) => set({ ...treatment, widthEm: Number(e.target.value) })}
              />
              <span>em</span>
            </span>
          </label>
          <label className="field">
            <span>Gap</span>
            <span className="unit-input">
              <input
                aria-label="Flourish gap"
                type="number"
                min="0"
                max="2"
                step="0.05"
                value={treatment.gapEm}
                onChange={(e) => set({ ...treatment, gapEm: Number(e.target.value) })}
              />
              <span>em</span>
            </span>
          </label>
        </>
      )}
      {matches.length > 1 && (
        <details className="matching-images">
          <summary>{matches.length} matching images</summary>
          <button
            onClick={() =>
              w.edit({
                imageTreatments: {
                  ...s.imageTreatments,
                  ...Object.fromEntries(matches.map((b) => [b.id, { ...current }])),
                },
              })
            }
          >
            Apply treatment to all {matches.length}
          </button>
          <button
            onClick={() =>
              w.edit({
                excludedImageIds: s.excludedImageIds.filter((id) => !matches.some((b) => b.id === id)),
              })
            }
          >
            Include all matching
          </button>
          <button
            disabled={kind === 'heading'}
            onClick={() =>
              w.edit({ excludedImageIds: [...new Set([...s.excludedImageIds, ...matches.map((b) => b.id)])] })
            }
          >
            Exclude all matching
          </button>
        </details>
      )}
      {treatment && (
        <button
          className="image-location"
          onClick={() => {
            const imageTreatments = { ...s.imageTreatments };
            delete imageTreatments[block.id];
            w.edit({ imageTreatments });
          }}
        >
          Reset to {automaticImageHeadings(w.doc!).has(block.id) ? 'detected heading' : 'image'}
        </button>
      )}
    </div>
  );
}
