import { describe, expect, it } from 'vitest';
import {
  applyFold,
  bounds,
  choices,
  exampleRecording,
  exposed,
  flatPaper,
  foldProblem,
  hinges,
  parseRecording,
  replay,
  type Fold,
} from '../apps/web/src/folding/model';

describe('connected folding model', () => {
  it('halves the footprint to a two-cell packet and preserves the paper', () => {
    const example = exampleRecording();
    for (const [index, size] of [
      [0, [4, 4]],
      [1, [4, 2]],
      [2, [4, 1]],
      [3, [2, 1]],
    ] as const) {
      const paper = replay(example, index);
      const b = bounds(paper);
      expect([b.right - b.left, b.top - b.bottom]).toEqual(size);
      expect(new Set(paper.order).size).toBe(16);
      expect(paper.panels.every((p) => Math.abs(p.sx * p.sy) === 1)).toBe(true);
      for (const h of hinges(paper)) {
        const a = paper.panels[h.a],
          c = paper.panels[h.b];
        if (h.b - h.a === 1) {
          expect(a.x + a.sx * 0.5).toBe(c.x - c.sx * 0.5);
          expect(a.y).toBe(c.y);
        } else {
          expect(a.y - a.sy * 0.5).toBe(c.y + c.sy * 0.5);
          expect(a.x).toBe(c.x);
        }
      }
      expect(exposed(paper).length).toBe(size[0] * size[1]);
    }
  });
  it('records physical unfolding and returns to the original panels', () => {
    const r = exampleRecording();
    let paper = replay(r);
    for (const s of [...r.steps].reverse()) {
      expect(foldProblem(paper, s.fold!)).toBeUndefined();
      paper = applyFold(paper, s.fold!);
    }
    expect(paper.panels).toEqual(flatPaper().panels);
    expect(exposed(paper)).toEqual(Array.from({ length: 16 }, (_, i) => `F${i + 1}`));
    expect(exposed(paper, false)).toEqual(Array.from({ length: 16 }, (_, i) => `B${i + 1}`));
  });
  it('prevents lifting a buried layer through the one covering it', () => {
    const f = exampleRecording().steps[0].fold!;
    const p = applyFold(flatPaper(), f);
    const bad = { ...f, direction: -1 as const };
    expect(foldProblem(p, bad)).toMatch(/underneath/);
    expect(() => applyFold(p, bad)).toThrow();
    expect(choices(p, 'y', 2).every((c) => c.moving.length < 16)).toBe(true);
  });
  it('rejects detached panels, altered hinges and crossing-axis packets', () => {
    const f = exampleRecording().steps[0].fold!;
    expect(foldProblem(flatPaper(), { ...f, moving: [8] })).toMatch(/separate|crease/);
    expect(foldProblem(flatPaper(), { ...f, hinges: [] })).toMatch(/crease/);
    expect(foldProblem(flatPaper(), { ...f, moving: [...f.moving, 0] })).toBeTruthy();
  });
  it('round trips deterministic recordings and rejects unsafe imports', () => {
    const r = exampleRecording();
    expect(replay(parseRecording(JSON.stringify(r)))).toEqual(replay(r));
    expect(() => parseRecording(JSON.stringify({ ...r, version: 2 }))).toThrow();
    expect(() =>
      parseRecording(
        JSON.stringify({
          ...r,
          steps: [{ ...r.steps[0], view: { position: [0, 0, 0], target: [0, 0, 0] } }],
        }),
      ),
    ).toThrow();
    const bad = structuredClone(r);
    (bad.steps[0].fold as Fold).moving = [999];
    expect(() => parseRecording(JSON.stringify(bad))).toThrow();
  });
  it('preserves rotated views while accepting older recordings', () => {
    const r = exampleRecording();
    expect(parseRecording(JSON.stringify(r))).toEqual(r);
    r.steps[0].view.up = [-1, 0, 0];
    expect(parseRecording(JSON.stringify(r))).toEqual(r);
    for (const up of [
      [0, 0, 0],
      [5, -6, 22],
      [1, 2],
      [null, 1, 0],
    ]) {
      const invalid = structuredClone(r);
      (invalid.steps[0].view as any).up = up;
      expect(() => parseRecording(JSON.stringify(invalid))).toThrow(/orientation/);
    }
  });
  it('keeps arbitrary supported folds connected across repeated refolding', () => {
    let p = flatPaper();
    for (let i = 0; i < 40; i++) {
      const axes = [...new Map(hinges(p).map((h) => [`${h.axis}:${h.line}`, h])).values()];
      const options = axes.flatMap((h) =>
        choices(p, h.axis, h.line).map((c) => ({
          axis: h.axis,
          line: h.line,
          moving: c.moving,
          hinges: c.hinges,
          direction: c.directions[0],
        })),
      );
      p = applyFold(p, options[(i * 13) % options.length]);
      for (const h of hinges(p)) {
        const a = p.panels[h.a],
          b = p.panels[h.b];
        expect(h.b - h.a === 1 ? [a.x + a.sx * 0.5, a.y] : [a.x, a.y - a.sy * 0.5]).toEqual(
          h.b - h.a === 1 ? [b.x - b.sx * 0.5, b.y] : [b.x, b.y + b.sy * 0.5],
        );
      }
    }
  });
});

describe('direct folding selection', () => {
  it('defaults to the smallest exposed flap on the side being viewed', async () => {
    const { pickFlap } = await import('../apps/web/src/folding/interaction');
    const paper = replay(exampleRecording(), 2);
    for (const direction of [1, -1] as const) {
      const id = direction === 1 ? paper.order.at(-1)! : paper.order[0];
      for (const crease of hinges(paper)) {
        const options = choices(paper, crease.axis, crease.line).filter(
          (c) => c.moving.includes(id) && c.directions.includes(direction),
        );
        if (!options.length) continue;
        const picked = pickFlap(paper, crease.axis, crease.line, id, direction)!;
        expect(picked.fold.direction).toBe(direction);
        expect(picked.fold.moving.length).toBe(Math.min(...options.map((c) => c.moving.length)));
        expect(foldProblem(paper, picked.fold)).toBeUndefined();
      }
    }
  });
});
