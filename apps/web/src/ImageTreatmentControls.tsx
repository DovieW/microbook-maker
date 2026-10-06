import {
  automaticImageHeadings,
  headingLabel,
  matchingImageBlocks,
  imageLayoutForBlock,
  imageLayoutOverride,
  imageLayoutOptions,
  type ImageLayout,
  type Block,
} from '@microbook/core';
import { Dropdown } from './ui';
import { imageLayoutChanges } from './imageLayoutSettings';
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
  const layout = imageLayoutForBlock(s, block.id);
  const override = imageLayoutOverride(s, block.id);
  const matches = matchingImageBlocks(w.doc!, block);
  const set = (value: typeof treatment) =>
    w.edit({ imageTreatments: { ...s.imageTreatments, [block.id]: value } });
  const flourish =
    treatment?.kind === 'flourish' ? treatment : { kind: 'flourish' as const, widthEm: 4, gapEm: 0.25 };
  return (
    <div className="image-treatment-controls">
      <label className="field">
        <span>Image layout</span>
        <Dropdown
          label="Image layout"
          value={override || 'inherit'}
          options={[['inherit', 'Use book default'], ...imageLayoutOptions]}
          onChange={(value) => w.edit(imageLayoutChanges(s, [block.id], value as ImageLayout | 'inherit'))}
        />
      </label>
      {heading ? (
        <p className="image-output-help">This image is currently replaced with a text heading.</p>
      ) : (
        <button
          onClick={() => {
            const text =
              w.doc!.assets.find((a) => a.id === block.assetId)?.alt ||
              w.doc!.sections.find((section) => section.id === block.sectionId)?.title ||
              'Chapter';
            set({
              kind: 'heading',
              text: text.slice(0, 500),
              headingKind: headingLabel(text)?.kind || 'chapter',
            });
          }}
        >
          Replace with text heading
        </button>
      )}
      {!heading && layout === 'flourish' && (
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
                value={flourish.widthEm}
                onChange={(e) => set({ ...flourish, widthEm: Number(e.target.value) })}
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
                value={flourish.gapEm}
                onChange={(e) => set({ ...flourish, gapEm: Number(e.target.value) })}
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
            onClick={() => {
              const ids = matches.map((b) => b.id);
              if (heading)
                w.edit({
                  imageTreatments: {
                    ...s.imageTreatments,
                    ...Object.fromEntries(ids.map((id) => [id, { kind: 'heading', ...heading }])),
                  },
                });
              else {
                const changes = imageLayoutChanges(s, ids, layout);
                if (layout === 'flourish')
                  ids.forEach((id) => {
                    changes.imageTreatments![id] = { ...flourish };
                  });
                w.edit(changes);
              }
            }}
          >
            Apply {heading ? 'text heading' : 'layout'} to all {matches.length}
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
            disabled={!!heading}
            onClick={() =>
              w.edit({ excludedImageIds: [...new Set([...s.excludedImageIds, ...matches.map((b) => b.id)])] })
            }
          >
            Exclude all matching
          </button>
        </details>
      )}
      {treatment && automaticImageHeadings(w.doc!).has(block.id) && (
        <button
          className="image-location"
          onClick={() => w.edit(imageLayoutChanges(s, [block.id], 'inherit'))}
        >
          Reset to detected heading
        </button>
      )}
      {heading && !automaticImageHeadings(w.doc!).has(block.id) && (
        <button
          className="image-location"
          onClick={() => w.edit(imageLayoutChanges(s, [block.id], 'inherit'))}
        >
          Use image instead
        </button>
      )}
    </div>
  );
}
