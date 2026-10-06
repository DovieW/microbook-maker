import { expect, it } from 'vitest';
import {
  defaultSettings,
  defaultImageLayout,
  imageLayoutForBlock,
  defaultImageRotation,
  imageRotationForBlock,
  settingsSchema,
  previewRegion,
  type CellMap,
} from '@microbook/core';
import { imageLayoutChanges, imageRotationChanges } from '../apps/web/src/imageLayoutSettings';

it('inherits orientation while preserving explicit Original and clearing bulk overrides', () => {
  const s = defaultSettings();
  expect(defaultImageRotation(s)).toBe(0);
  const rotated = settingsSchema.parse({
    ...s,
    imageRotation: 90,
    imageRotations: { original: 0, left: 270 },
  });
  expect(imageRotationForBlock(rotated, 'other')).toBe(90);
  expect(imageRotationForBlock(rotated, 'original')).toBe(0);
  expect(imageRotationForBlock(rotated, 'left')).toBe(270);
  const inherited = settingsSchema.parse({
    ...rotated,
    ...imageRotationChanges(rotated, ['original', 'left'], 'inherit'),
  });
  expect(inherited.imageRotations).toEqual({});
  expect(imageRotationForBlock(inherited, 'original')).toBe(90);
  expect(imageRotationForBlock({ ...inherited, imageRotation: 180 }, 'original')).toBe(180);
  expect(settingsSchema.safeParse({ imageRotation: 45 }).success).toBe(false);
});

it('defaults to inline and preserves legacy book and per-image choices', () => {
  const s = defaultSettings();
  expect(defaultImageLayout(s)).toBe('inline');
  const old = settingsSchema.parse({
    ...s,
    twoCellImages: true,
    imageCellSpans: { one: 1 },
    imageTreatments: { ornament: { kind: 'flourish', widthEm: 6, gapEm: 0.5 } },
  });
  expect(defaultImageLayout(old)).toBe('two-cells');
  expect(imageLayoutForBlock(old, 'one')).toBe('inline');
  expect(imageLayoutForBlock(old, 'ornament')).toBe('flourish');
  expect(imageLayoutForBlock({ ...old, imageLayout: 'four-cells' }, 'other')).toBe('four-cells');
  const changed = settingsSchema.parse({ ...old, ...imageLayoutChanges(old, ['one'], 'cell') });
  expect(imageLayoutForBlock(changed, 'one')).toBe('cell');
  expect(changed.imageCellSpans.one).toBeUndefined();
  const inherited = settingsSchema.parse({ ...changed, ...imageLayoutChanges(changed, ['one'], 'inherit') });
  expect(imageLayoutForBlock(inherited, 'one')).toBe('two-cells');
});

it('all four physical slots preview the same 2 by 2 region', () => {
  const cells = Array.from({ length: 6 }, (_, index) => ({
    index,
    page: 0,
    x: (index % 4) * 100,
    y: Math.floor(index / 4) * 150,
    width: 100,
    height: 150,
    blockIds: [],
    text: '',
  })) as CellMap[];
  cells[0].span = 4;
  for (const index of [1, 4, 5]) cells[index].continuationOf = 0;
  for (const index of [0, 1, 4, 5])
    expect(previewRegion(cells, index)).toMatchObject({ x: 0, y: 0, width: 200, height: 300 });
  cells[0].span = 2;
  expect(previewRegion(cells, 1)).toMatchObject({ width: 200, height: 150 });
});
