import { useEffect, useRef } from 'react';
import { repeatedImageGroups } from '@microbook/core';
import { ImageTreatmentControls } from './ImageTreatmentControls';
import { RotateCcw } from 'lucide-react';
import { IconButton } from './ui';
import { imageLocations, printedLocation } from './imageLocations';
import { ImageHeadingControls } from './ImageHeadingControls';
import type { Workspace } from './LayoutControls';
export function ImagesPane({ w }: { w: Workspace }) {
  const root = useRef<HTMLDivElement>(null);
  const doc = w.doc!;
  const draft = w.kept?.settings || w.draft;
  const images = imageLocations(doc, w.preview?.result, draft);
  const headings = imageLocations(doc, w.preview?.result, draft, true).filter(
    (i) => !images.some((e) => e.block.id === i.block.id),
  );
  useEffect(() => {
    const node = root.current?.querySelector(
      `[data-image-id="${CSS.escape(w.docPrefs?.selectedImageId || '')}"]`,
    );
    if (node?.closest('details')) node.closest('details')!.open = true;
    node?.scrollIntoView({ block: 'nearest' });
  }, [w.docPrefs?.selectedImageId]);
  return (
    <div className="images-pane" ref={root}>
      <details className="image-defaults">
        <summary>Defaults</summary>
        <fieldset disabled={!!w.kept}>
          <label className="check-field">
            <span>Illustrations</span>
            <input
              type="checkbox"
              checked={draft.includeImages}
              onChange={(e) => w.edit({ includeImages: e.target.checked })}
            />
          </label>
          <label className="check-field">
            <span>Two-cell images</span>
            <input
              type="checkbox"
              checked={draft.twoCellImages}
              onChange={(e) => w.edit({ twoCellImages: e.target.checked })}
            />
          </label>
          <label className="field">
            <span>Image scale</span>
            <input
              aria-label="Image scale"
              type="number"
              min=".2"
              max="1"
              step=".1"
              value={draft.imageScale}
              onChange={(e) => w.edit({ imageScale: Number(e.target.value) })}
            />
          </label>
        </fieldset>
      </details>
      {repeatedImageGroups(doc).length > 0 && (
        <details className="repeated-images">
          <summary>Repeated images</summary>
          {repeatedImageGroups(doc).map((group) => {
            const asset = doc.assets.find((a) => a.id === group[0].assetId);
            const applied = group.every((b) => draft.imageTreatments[b.id]?.kind === 'flourish');
            return (
              <div className="repeated-image" key={group[0].assetId}>
                {asset && <img src={`/api/documents/${doc.id}/assets/${asset.id}`} alt="Repeated artwork" />}
                <span>{group.length} occurrences</span>
                <button
                  disabled={!!w.kept || applied}
                  onClick={() =>
                    w.edit({
                      imageTreatments: {
                        ...draft.imageTreatments,
                        ...Object.fromEntries(
                          group.map((b) => [b.id, { kind: 'flourish' as const, widthEm: 4, gapEm: 0.25 }]),
                        ),
                      },
                    })
                  }
                >
                  {applied ? 'Flourishes' : 'Use as flourishes'}
                </button>
              </div>
            );
          })}
        </details>
      )}
      <div className="image-list">
        {images.map(({ block, asset, section, cell, context, heading }, i) => {
          const included = !!heading || !draft.excludedImageIds.includes(block.id);
          const active = block.id === w.docPrefs?.selectedImageId;
          return (
            <div
              className={`image-choice${active ? ' selected' : ''}${included ? '' : ' excluded'}`}
              data-image-id={block.id}
              aria-current={active ? true : undefined}
              key={block.id}
            >
              <div className="image-choice-main">
                <button
                  className="image-thumbnail"
                  aria-label={`Show image ${i + 1}`}
                  onClick={() => w.selectImage(block.id)}
                >
                  {asset && <img src={`/api/documents/${doc.id}/assets/${asset.id}`} alt="" loading="lazy" />}
                </button>
                <div className="image-description">
                  <button className="image-title" onClick={() => w.selectImage(block.id)} title={section}>
                    {section || `Image ${i + 1}`}
                  </button>
                  <small>
                    Image {i + 1}
                    {heading ? ' · Heading' : ''}
                  </small>
                  {!cell && <small>Not in preview</small>}
                  <button
                    className="image-location"
                    aria-label={
                      cell
                        ? `Show image ${i + 1}: ${printedLocation(cell.page)}`
                        : `Go to context for image ${i + 1}`
                    }
                    disabled={!cell && !context}
                    onClick={() => w.selectImage(block.id)}
                  >
                    {cell ? printedLocation(cell.page) : 'Go to context'}
                  </button>
                </div>
                <input
                  type="checkbox"
                  aria-label={`Include image ${i + 1}`}
                  disabled={!!w.kept || !!heading || !draft.includeImages}
                  checked={included}
                  onChange={(e) =>
                    w.edit({
                      excludedImageIds: e.target.checked
                        ? draft.excludedImageIds.filter((id) => id !== block.id)
                        : [...new Set([...draft.excludedImageIds, block.id])].sort(),
                    })
                  }
                />
              </div>
              {active && (
                <fieldset className="image-detail" disabled={!!w.kept}>
                  <ImageTreatmentControls w={w} block={block} heading={heading} />
                  {!heading && draft.imageTreatments[block.id]?.kind !== 'flourish' && (
                    <div className="image-layout-choice">
                      <label>
                        <span>Use two cells</span>
                        <input
                          type="checkbox"
                          aria-label={`Two cells for image ${i + 1}`}
                          checked={(draft.imageCellSpans[block.id] ?? (draft.twoCellImages ? 2 : 1)) === 2}
                          disabled={!included}
                          onChange={(e) =>
                            w.edit({
                              imageCellSpans: {
                                ...draft.imageCellSpans,
                                [block.id]: e.target.checked ? 2 : 1,
                              },
                            })
                          }
                        />
                      </label>
                      {draft.imageCellSpans[block.id] !== undefined && (
                        <IconButton
                          label={`Use book setting for image ${i + 1}`}
                          onClick={() => {
                            const imageCellSpans = { ...draft.imageCellSpans };
                            delete imageCellSpans[block.id];
                            w.edit({ imageCellSpans });
                          }}
                        >
                          <RotateCcw size={13} />
                        </IconButton>
                      )}
                    </div>
                  )}
                  {draft.imageTreatments[block.id]?.kind !== 'flourish' && (
                    <details>
                      <summary>Heading</summary>
                      <ImageHeadingControls doc={doc} block={block} draft={draft} onEdit={w.edit} />
                    </details>
                  )}
                </fieldset>
              )}
            </div>
          );
        })}
      </div>
      {headings.length > 0 && (
        <details className="heading-artwork">
          <summary>Heading artwork · {headings.length}</summary>
          {headings.map(({ block, heading, cell, context }) => (
            <div className="heading-artwork-row" data-image-id={block.id} key={block.id}>
              <button className="heading-artwork-select" onClick={() => w.selectImage(block.id)}>
                {heading?.text}
              </button>
              {w.docPrefs?.selectedImageId === block.id && (
                <>
                  <button
                    className="image-location"
                    disabled={!cell && !context}
                    onClick={() => w.selectImage(block.id)}
                  >
                    {cell ? printedLocation(cell.page) : 'Go to context'}
                  </button>
                  <fieldset disabled={!!w.kept}>
                    <ImageHeadingControls doc={doc} block={block} draft={draft} onEdit={w.edit} />
                  </fieldset>
                </>
              )}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
