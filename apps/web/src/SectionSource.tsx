import { useState } from 'react';
import { bookBlockText, type Block, type BookDocument } from '@microbook/core';
import { hasSectionContent } from './sectionContent';

export function SectionSource({
  doc,
  sectionId,
  title,
  blocks,
}: {
  doc: BookDocument;
  sectionId: string;
  title: string;
  blocks: Block[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <details className="section-source" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Inspect source content</summary>
      {open && (
        <div className="section-source-body" role="region" aria-label={`Source content of ${title}`}>
          <p className="section-source-description">Imported content before print settings are applied.</p>
          {!hasSectionContent(blocks) && (
            <p>No text, images, or section breaks were imported for this section.</p>
          )}
          {blocks.map((block) => {
            if (block.kind === 'image') {
              const asset = doc.assets.find((entry) => entry.id === block.assetId);
              return asset ? (
                <figure key={block.id}>
                  <img
                    loading="lazy"
                    src={`/api/documents/${doc.id}/assets/${asset.id}`}
                    alt={asset.alt || 'Source image'}
                  />
                  {block.imageHeading && <figcaption>{block.imageHeading}</figcaption>}
                </figure>
              ) : (
                <p key={block.id}>Source image unavailable.</p>
              );
            }
            if (block.pageLabel) return <p key={block.id}>Source page marker: {block.pageLabel}</p>;
            if (block.kind === 'separator') return <hr key={block.id} aria-label="Section break" />;
            const text = bookBlockText(block);
            return text.trim() ? (
              <p key={block.id} className={block.kind === 'heading' ? 'section-source-heading' : undefined}>
                {text}
              </p>
            ) : null;
          })}
          <p className="section-source-description">
            Source: {doc.sections.find((section) => section.id === sectionId)?.source || sectionId}
          </p>
        </div>
      )}
    </details>
  );
}
