import {
  imageHeadingTreatment,
  type RenderSettings,
  type BookDocument,
  type RenderResult,
} from '@microbook/core';

export function imageLocations(
  doc: BookDocument,
  result?: RenderResult,
  settings?: RenderSettings,
  includeHeadings = false,
) {
  const cells = new Map<string, NonNullable<RenderResult['cells']>[number]>();
  for (const cell of result?.cells || []) {
    if (cell.continuationOf !== undefined) continue;
    for (const id of cell.blockIds) if (!cells.has(id)) cells.set(id, cell);
  }
  return doc.blocks.flatMap((block, index) => {
    if (block.kind !== 'image') return [];
    const heading = imageHeadingTreatment(doc, block, settings);
    if (heading && !includeHeadings && !settings?.imageTreatments?.[block.id]) return [];
    const cell = cells.get(block.id);
    let context = cell;
    if (!context) {
      for (let i = index + 1; i < doc.blocks.length && !context; i++) context = cells.get(doc.blocks[i].id);
      for (let i = index - 1; i >= 0 && !context; i--) context = cells.get(doc.blocks[i].id);
    }
    return [
      {
        block,
        heading,
        cell,
        context,
        region: result?.imageRegions?.find((r) => r.blockId === block.id),
        section: doc.sections.find((s) => s.id === block.sectionId)?.title || block.source,
        asset: doc.assets.find((a) => a.id === block.assetId),
      },
    ];
  });
}
export const printedLocation = (page: number) =>
  `Sheet ${Math.floor(page / 2) + 1} · ${page % 2 ? 'Back' : 'Front'}`;
