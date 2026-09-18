import { useEffect, useRef, useState, type ReactNode } from 'react';
import { repeatedImageGroups, imageOutputQuery, settingsSchema } from '@microbook/core';
import { RepeatedImageControls } from './RepeatedImageControls';
import { ImageOutputControls } from './ImageOutputControls';
import { ImageRotationControls } from './ImageRotationControls';
import { ImagePreview, type PreviewImage } from './ImagePreview';
import { RichFeatures } from './RichFeatures';
import { ImageTreatmentControls } from './ImageTreatmentControls';
import { RotateCcw } from 'lucide-react';
import { IconButton } from './ui';
import { imageLocations, printedLocation } from './imageLocations';
import { ImageHeadingControls } from './ImageHeadingControls';
import { ContentRowHeader } from './ContentRow';
import { ImageContentDialog } from './CustomContentDialogs';
import type { Workspace } from './LayoutControls';
export function ImagesPane({
  w,
  query: suppliedQuery,
  imageIds,
  embedded = false,
  controlsOnly = false,
  rowPosition,
  sectionId,
}: {
  w: Workspace;
  query?: string;
  imageIds?: string[];
  embedded?: boolean;
  controlsOnly?: boolean;
  rowPosition?: ReactNode;
  sectionId?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<PreviewImage>();
  const previewTrigger = useRef<HTMLElement | null>(null);
  const showPreview = (trigger: HTMLElement, blockId: string, src: string, alt: string, title: string) => {
    previewTrigger.current = trigger;
    w.selectImage(blockId);
    setPreviewImage({
      src,
      alt,
      title,
      blockId,
      output: draft.imageOutputOverrides[blockId] ?? draft.imageOutput,
    });
  };
  const doc = w.doc!;
  const draft = w.kept ? settingsSchema.parse(w.kept.settings) : w.draft;
  const images = imageLocations(doc, w.preview?.result, draft);
  const allowed = imageIds && new Set(imageIds);
  const activeQuery = suppliedQuery ?? query;
  const filteredImages = images.filter(
    ({ block, asset, section }) =>
      (!allowed || allowed.has(block.id)) &&
      `${section} ${asset?.alt || ''}`.toLowerCase().includes(activeQuery.toLowerCase()),
  );
  const headings = imageLocations(doc, w.preview?.result, draft, true).filter(
    (i) =>
      !images.some((e) => e.block.id === i.block.id) &&
      (!allowed || allowed.has(i.block.id)) &&
      `${i.section} ${i.asset?.alt || ''}`.toLowerCase().includes(activeQuery.toLowerCase()),
  );
  useEffect(() => {
    const node = root.current?.querySelector(
      `[data-image-id="${CSS.escape(w.docPrefs?.selectedImageId || '')}"]`,
    );
    if (node?.closest('details')) node.closest('details')!.open = true;
    const header = node?.querySelector('.content-row-header') || node;
    header?.scrollIntoView({ block: 'nearest' });
    const body = node?.closest('.sidebar-body');
    const toolbar = body?.querySelector('.contents-toolbar');
    if (header && body && toolbar) {
      const overlap = toolbar.getBoundingClientRect().bottom + 8 - header.getBoundingClientRect().top;
      if (overlap > 0) body.scrollTop -= overlap;
    }
  }, [w.docPrefs?.selectedImageId]);
  return (
    <div className={`images-pane${embedded ? ' embedded-images' : ''}`} ref={root}>
      <ImagePreview
        image={
          previewImage && {
            ...previewImage,
            rotation: draft.imageRotations[previewImage.blockId] ?? 0,
            output: draft.imageOutputOverrides[previewImage.blockId] ?? draft.imageOutput,
          }
        }
        onChoose={
          w.kept
            ? undefined
            : (output) => {
                if (previewImage)
                  w.edit({
                    imageOutputOverrides: { ...draft.imageOutputOverrides, [previewImage.blockId]: output },
                  });
              }
        }
        onRotate={
          w.kept
            ? undefined
            : (rotation) => {
                if (previewImage)
                  w.edit({ imageRotations: { ...draft.imageRotations, [previewImage.blockId]: rotation } });
              }
        }
        onClose={() => setPreviewImage(undefined)}
        returnFocus={() => previewTrigger.current?.focus()}
      />
      {!embedded && !controlsOnly && (
        <div className="images-toolbar content-filter-row">
          <input
            aria-label="Find image"
            type="search"
            placeholder="Find image…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}
      {!embedded && !controlsOnly && (
        <a className="image-test-print" href="/api/image-test-print" target="_blank" rel="noopener">
          Test print · Compare image output
        </a>
      )}
      {(!embedded || controlsOnly) && (
        <details className="image-defaults">
          <summary>Defaults</summary>
          <fieldset disabled={!!w.kept}>
            <ImageOutputControls w={w} />
            <RichFeatures w={w} group="images" />
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
      )}
      {(!embedded || controlsOnly) && repeatedImageGroups(doc).length > 0 && (
        <details className="repeated-images">
          <summary>Repeated images</summary>
          {repeatedImageGroups(doc).map((group) => {
            const asset = doc.assets.find((a) => a.id === group[0].assetId);
            const includedCount = group.filter((b) => !draft.excludedImageIds.includes(b.id)).length;
            const applied = group.every((b) => draft.imageTreatments[b.id]?.kind === 'flourish');
            return (
              <div className="repeated-image" key={group[0].assetId}>
                {asset && <img src={`/api/documents/${doc.id}/assets/${asset.id}`} alt="Repeated artwork" />}
                <span>{group.length} occurrences</span>
                <input
                  type="checkbox"
                  aria-label={`Include all ${group.length} occurrences of repeated image ${group[0].assetId}`}
                  title={includedCount === group.length ? 'Uncheck all occurrences' : 'Check all occurrences'}
                  disabled={!!w.kept || !draft.includeImages}
                  checked={includedCount === group.length}
                  ref={(node) => {
                    if (node) node.indeterminate = includedCount > 0 && includedCount < group.length;
                  }}
                  onChange={(event) => {
                    const ids = new Set(group.map((b) => b.id));
                    w.edit({
                      excludedImageIds: event.target.checked
                        ? draft.excludedImageIds.filter((id) => !ids.has(id))
                        : [...new Set([...draft.excludedImageIds, ...ids])].sort(),
                    });
                  }}
                />
                <button
                  disabled={!!w.kept}
                  onClick={() =>
                    w.edit({
                      imageTreatments: {
                        ...draft.imageTreatments,
                        ...Object.fromEntries(
                          group.map((b) => [
                            b.id,
                            applied
                              ? { kind: 'image' as const }
                              : { kind: 'flourish' as const, widthEm: 4, gapEm: 0.25 },
                          ]),
                        ),
                      },
                    })
                  }
                >
                  {applied ? 'Use as illustrations' : 'Use as flourishes'}
                </button>
                <RepeatedImageControls w={w} group={group} />
              </div>
            );
          })}
        </details>
      )}
      {!controlsOnly && (
        <div className="image-list">
          {filteredImages.map(({ block, asset, section, cell, context, heading }) => {
            const i = images.findIndex((entry) => entry.block.id === block.id);
            const included =
              (!!heading || !draft.excludedImageIds.includes(block.id)) &&
              (!sectionId || !draft.selectedSections || draft.selectedSections.includes(sectionId));
            const active = block.id === w.docPrefs?.selectedImageId;
            const thumbnail = (
              <button
                className="image-thumbnail"
                aria-label={`Preview image ${i + 1}`}
                onClick={(event) =>
                  asset &&
                  showPreview(
                    event.currentTarget,
                    block.id,
                    `/api/documents/${doc.id}/assets/${asset.id}`,
                    asset.alt,
                    section,
                  )
                }
              >
                {asset && <img src={`/api/documents/${doc.id}/assets/${asset.id}`} alt="" loading="lazy" />}
              </button>
            );
            const include = (
              <input
                type="checkbox"
                aria-label={`Include image ${i + 1}`}
                disabled={!!w.kept || !!heading || !draft.includeImages}
                checked={included}
                onChange={(e) =>
                  w.edit({
                    ...(sectionId
                      ? {
                          selectedSections: e.target.checked
                            ? [
                                ...new Set([
                                  ...(draft.selectedSections || doc.sections.map((s) => s.id)),
                                  sectionId,
                                ]),
                              ]
                            : (draft.selectedSections || doc.sections.map((s) => s.id)).filter(
                                (id) => id !== sectionId,
                              ),
                        }
                      : {}),
                    excludedImageIds: e.target.checked
                      ? draft.excludedImageIds.filter((id) => id !== block.id)
                      : sectionId
                        ? draft.excludedImageIds
                        : [...new Set([...draft.excludedImageIds, block.id])].sort(),
                  })
                }
              />
            );
            return (
              <div
                className={`image-choice${active ? ' selected' : ''}${included ? '' : ' excluded'}`}
                data-image-id={block.id}
                aria-current={active ? true : undefined}
                key={block.id}
                onClick={(event) => {
                  if (
                    !(event.target as HTMLElement).closest(
                      'button, input, select, label, fieldset, summary, a',
                    )
                  )
                    w.selectImage(block.id);
                }}
              >
                {embedded ? (
                  <ContentRowHeader
                    position={rowPosition}
                    title={section || `Image ${i + 1}`}
                    location={cell ? printedLocation(cell.page) : 'Not in preview'}
                    label={`Image ${i + 1} details`}
                    expanded={active}
                    onOpen={() => w.jumpImage(block.id)}
                    thumbnail={thumbnail}
                  >
                    {include}
                  </ContentRowHeader>
                ) : (
                  <div className="image-choice-main">
                    {thumbnail}
                    <div className="image-description">
                      <button
                        className="image-title"
                        aria-label={`Image ${i + 1} details`}
                        aria-expanded={active}
                        onClick={() => w.selectImage(block.id)}
                        title={section}
                      >
                        {section || `Image ${i + 1}`}
                      </button>
                      {!embedded && (
                        <small>
                          Image {i + 1}
                          {heading ? ' · Heading' : ''}
                        </small>
                      )}
                      {!cell && !embedded && <small>Not in preview</small>}
                      <button
                        className="image-location"
                        aria-label={
                          cell
                            ? `Show image ${i + 1}: ${printedLocation(cell.page)}`
                            : `Go to context for image ${i + 1}`
                        }
                        disabled={!cell && !context}
                        onClick={() => w.jumpImage(block.id)}
                      >
                        {cell ? printedLocation(cell.page) : embedded ? 'Not in preview' : 'Go to context'}
                      </button>
                    </div>
                    {include}
                  </div>
                )}
                {active && (
                  <div className="image-expanded">
                    {asset && (
                      <button
                        className="image-preview-button"
                        aria-label={`Enlarge image ${i + 1}`}
                        onClick={(event) =>
                          showPreview(
                            event.currentTarget,
                            block.id,
                            `/api/documents/${doc.id}/assets/${asset.id}`,
                            asset.alt,
                            section,
                          )
                        }
                      >
                        <img
                          className="image-large-preview"
                          src={`/api/documents/${doc.id}/assets/${asset.id}${imageOutputQuery(draft.imageOutputOverrides[block.id] ?? draft.imageOutput, draft.imageRotations[block.id] ?? 0)}`}
                          alt={asset.alt || `Image ${i + 1}`}
                        />
                      </button>
                    )}
                    <fieldset className="image-detail" disabled={!!w.kept}>
                      {!heading && draft.imageTreatments[block.id]?.kind !== 'flourish' && (
                        <div className="image-layout-choice">
                          <label>
                            <span>Use two cells</span>
                            <input
                              type="checkbox"
                              aria-label={`Two cells for image ${i + 1}`}
                              checked={
                                (draft.imageCellSpans[block.id] ?? (draft.twoCellImages ? 2 : 1)) === 2
                              }
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
                      <ImageTreatmentControls w={w} block={block} heading={heading} />
                      {!heading && (
                        <ImageRotationControls
                          rotation={draft.imageRotations[block.id] ?? 0}
                          onChange={(rotation) =>
                            w.edit({ imageRotations: { ...draft.imageRotations, [block.id]: rotation } })
                          }
                          count={
                            doc.blocks.filter((b) => b.kind === 'image' && b.assetId === block.assetId).length
                          }
                          onMatch={() =>
                            w.edit({
                              imageRotations: {
                                ...draft.imageRotations,
                                ...Object.fromEntries(
                                  doc.blocks
                                    .filter((b) => b.kind === 'image' && b.assetId === block.assetId)
                                    .map((b) => [b.id, draft.imageRotations[block.id] ?? 0]),
                                ),
                              },
                            })
                          }
                        />
                      )}
                      {!heading && <ImageOutputControls w={w} blockId={block.id} />}
                      {!heading && asset && (
                        <div className="image-source-actions">
                          <ImageContentDialog w={w} blockId={block.id} defaultAlt={asset.alt} />
                          {block.originalAssetId && (
                            <button onClick={() => void w.restoreDocumentImage(block.id)}>
                              Restore original
                            </button>
                          )}
                        </div>
                      )}
                      {heading && (
                        <ImageHeadingControls doc={doc} block={block} draft={draft} onEdit={w.edit} />
                      )}
                    </fieldset>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!controlsOnly && headings.length > 0 && (
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
                    onClick={() => w.jumpImage(block.id)}
                  >
                    {cell ? printedLocation(cell.page) : 'Go to context'}
                  </button>
                  <fieldset disabled={!!w.kept}>
                    <ImageTreatmentControls w={w} block={block} heading={heading} />
                    {!heading && (
                      <ImageRotationControls
                        rotation={draft.imageRotations[block.id] ?? 0}
                        onChange={(rotation) =>
                          w.edit({ imageRotations: { ...draft.imageRotations, [block.id]: rotation } })
                        }
                        count={
                          doc.blocks.filter((b) => b.kind === 'image' && b.assetId === block.assetId).length
                        }
                        onMatch={() =>
                          w.edit({
                            imageRotations: {
                              ...draft.imageRotations,
                              ...Object.fromEntries(
                                doc.blocks
                                  .filter((b) => b.kind === 'image' && b.assetId === block.assetId)
                                  .map((b) => [b.id, draft.imageRotations[block.id] ?? 0]),
                              ),
                            },
                          })
                        }
                      />
                    )}
                    {!heading && <ImageOutputControls w={w} blockId={block.id} />}
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
