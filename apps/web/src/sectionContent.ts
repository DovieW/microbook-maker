import { bookBlockText, type Block } from '@microbook/core';

/** Anchors and whitespace alone are not source content; rules and page markers are. */
export function hasSectionContent(blocks: Block[]) {
  return blocks.some(
    (block) =>
      block.kind === 'image' ||
      block.kind === 'separator' ||
      !!block.pageLabel ||
      !!block.imageHeading?.trim() ||
      !!bookBlockText(block).replace(/[\s\u200b\ufeff]/gu, ''),
  );
}

export function sectionStatus({
  included,
  hasContent,
  generated,
  previewReady,
  pending,
  location,
}: {
  included: boolean;
  hasContent: boolean;
  generated: boolean;
  previewReady: boolean;
  pending: boolean;
  location?: string;
}) {
  if (!included) return 'Excluded';
  if (!hasContent && !generated) return 'Empty section';
  if (!previewReady) return 'Preview not generated';
  if (pending && !location) return 'No location in applied preview';
  return location || 'No visible content with current settings';
}
