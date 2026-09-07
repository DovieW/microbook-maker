import { useEffect, useState } from 'react';
import {
  automaticImageHeadings,
  headingLabel,
  imageHeadingTreatment,
  type Block,
  type BookDocument,
  type RenderSettings,
} from '@microbook/core';
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
      <label className="check-field">
        <span>Treat as heading</span>
        <input
          type="checkbox"
          aria-label="Treat as heading"
          checked={!!heading}
          onChange={(e) =>
            change(
              e.target.checked
                ? {
                    kind: 'heading',
                    text: initial.slice(0, 500),
                    headingKind: headingLabel(initial)?.kind || 'chapter',
                  }
                : { kind: 'image' },
            )
          }
        />
      </label>
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
      {draft.imageTreatments?.[block.id] && (
        <button
          className="image-location"
          onClick={() => {
            const imageTreatments = { ...draft.imageTreatments };
            delete imageTreatments[block.id];
            onEdit({ imageTreatments });
          }}
        >
          Reset to {automaticImageHeadings(doc).has(block.id) ? 'detected heading' : 'image'}
        </button>
      )}
    </div>
  );
}
