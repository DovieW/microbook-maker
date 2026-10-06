import { type ImageLayout, type ImageRotation, type RenderSettings } from '@microbook/core';

export function imageRotationChanges(
  settings: RenderSettings,
  ids: string[],
  rotation: ImageRotation | 'inherit',
): Partial<RenderSettings> {
  const imageRotations = { ...settings.imageRotations };
  for (const id of ids) {
    if (rotation === 'inherit') delete imageRotations[id];
    else imageRotations[id] = rotation;
  }
  return { imageRotations };
}

/** Clear legacy span overrides whenever the single layout choice changes. */
export function imageLayoutChanges(
  settings: RenderSettings,
  ids: string[],
  layout: ImageLayout | 'inherit',
): Partial<RenderSettings> {
  const imageTreatments = { ...settings.imageTreatments };
  const imageCellSpans = { ...settings.imageCellSpans };
  for (const id of ids) {
    delete imageCellSpans[id];
    if (layout === 'inherit') delete imageTreatments[id];
    else if (layout === 'flourish') {
      const previous = imageTreatments[id];
      imageTreatments[id] =
        previous?.kind === 'flourish' ? previous : { kind: 'flourish', widthEm: 4, gapEm: 0.25 };
    } else imageTreatments[id] = { kind: 'image', layout };
  }
  return { imageTreatments, imageCellSpans };
}
