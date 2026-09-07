import { useEffect, useState } from 'react';
import { imageHeadingTreatment, type Block, type BookDocument, type RenderSettings } from '@microbook/core';
import { Dropdown } from './ui';

export function ImageHeadingControls({
  doc,
  block,
  draft,
  onEdit,
}: {
  doc: BookDocument;
  block: Block;
  draft: RenderSettings;
  onEdit: (edit: Partial<RenderSettings>) => void;
}) {
  const heading = imageHeadingTreatment(doc, block, draft);
  const initial =
    heading?.text ||
    doc.assets.find((a) => a.id === block.assetId)?.alt ||
    doc.sections.find((s) => s.id === block.sectionId)?.title ||
    'Chapter';
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  const change = (value: RenderSettings['imageTreatments'][string]) =>
    onEdit({ imageTreatments: { ...draft.imageTreatments, [block.id]: value } });
  return (
    <div className="image-heading-controls">
      {heading && (
        <>
          <label>
            Heading text
            <input
              aria-label="Heading text"
              value={text}
              maxLength={500}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim())
                  change({ kind: 'heading', text: e.target.value.trim(), headingKind: heading.headingKind });
              }}
              onBlur={() => {
                if (!text.trim()) setText(initial);
              }}
            />
          </label>
          <Dropdown
            label="Heading type"
            value={heading.headingKind}
            options={[
              ['chapter', 'Chapter'],
              ['part', 'Part'],
            ]}
            onChange={(kind) =>
              change({ kind: 'heading', text: heading.text, headingKind: kind as 'chapter' | 'part' })
            }
          />
        </>
      )}
    </div>
  );
}
