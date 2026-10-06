/** Exact, flat endpoint model. Coordinates are grid units; +Z is the front of the original sheet.
 * A fold rotates connected, accessible layers on ONE side of a hinge through an empty half-space.
 * This is deliberately not a paper elasticity or general origami solver. */
export type Axis = 'x' | 'y';
export type Panel = { id: number; x: number; y: number; sx: 1 | -1; sy: 1 | -1 };
export type Paper = { panels: Panel[]; order: number[] };
export type Fold = { axis: Axis; line: number; moving: number[]; direction: 1 | -1; hinges: string[] };
export type CameraView = {
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
};
export type Step = { fold?: Fold; view: CameraView; note: string };
export type Recording = { version: 1; paper: 'letter-4x4'; title: string; steps: Step[] };
export const INITIAL_VIEW: CameraView = { position: [5, -6, 22], target: [0, 0, 0] };
export const blankRecording = (): Recording => ({
  version: 1,
  paper: 'letter-4x4',
  title: 'My folding method',
  steps: [],
});
export const flatPaper = (): Paper => ({
  panels: Array.from({ length: 16 }, (_, id) => ({
    id,
    x: (id % 4) + 0.5,
    y: 3.5 - Math.floor(id / 4),
    sx: 1,
    sy: 1,
  })),
  order: Array.from({ length: 16 }, (_, id) => id),
});
const samePlace = (a: Panel, b: Panel) => a.x === b.x && a.y === b.y;
export function bounds(paper: Paper) {
  return {
    left: Math.min(...paper.panels.map((p) => p.x)) - 0.5,
    right: Math.max(...paper.panels.map((p) => p.x)) + 0.5,
    bottom: Math.min(...paper.panels.map((p) => p.y)) - 0.5,
    top: Math.max(...paper.panels.map((p) => p.y)) + 0.5,
  };
}
export function faceLabel(panel: Panel, front: boolean) {
  const originalFront = (panel.sx * panel.sy === 1) === front;
  return originalFront ? `F${panel.id + 1}` : `B${Math.floor(panel.id / 4) * 4 + 4 - (panel.id % 4)}`;
}
export function exposed(paper: Paper, front = true): string[] {
  const seen = new Set<string>();
  const panels = (front ? [...paper.order].reverse() : paper.order).map((id) => paper.panels[id]);
  return panels
    .filter((p) => {
      const key = `${p.x},${p.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.y - a.y || (front ? a.x - b.x : b.x - a.x))
    .map((p) => faceLabel(p, front));
}
type Hinge = { id: string; a: number; b: number; axis: Axis; line: number };
export function hinges(paper: Paper): Hinge[] {
  const result: Hinge[] = [];
  for (const p of paper.panels) {
    if (p.id % 4 < 3)
      result.push({ id: `${p.id}-${p.id + 1}`, a: p.id, b: p.id + 1, axis: 'x', line: p.x + p.sx * 0.5 });
    if (p.id < 12)
      result.push({ id: `${p.id}-${p.id + 4}`, a: p.id, b: p.id + 4, axis: 'y', line: p.y - p.sy * 0.5 });
  }
  return result;
}
export function creases(paper: Paper) {
  return [
    ...new Map(hinges(paper).map((h) => [`${h.axis}:${h.line}`, { axis: h.axis, line: h.line }])).values(),
  ].sort((a, b) => a.axis.localeCompare(b.axis) || b.line - a.line);
}
function components(paper: Paper, axis: Axis, line: number): number[][] {
  const edges = hinges(paper).filter((h) => h.axis !== axis || h.line !== line);
  const left = new Set(paper.order);
  const groups: number[][] = [];
  while (left.size) {
    const todo = [left.values().next().value!];
    const group: number[] = [];
    left.delete(todo[0]);
    while (todo.length) {
      const id = todo.pop()!;
      group.push(id);
      for (const e of edges) {
        const other = e.a === id ? e.b : e.b === id ? e.a : -1;
        if (left.delete(other)) todo.push(other);
      }
    }
    groups.push(group.sort((a, b) => a - b));
  }
  return groups;
}
/** Empty means supported. Invalid/ambiguous moves never silently pass through paper. */
export function foldProblem(paper: Paper, fold: Fold): string | undefined {
  if (!['x', 'y'].includes(fold.axis) || !Number.isInteger(fold.line) || ![1, -1].includes(fold.direction))
    return 'Invalid fold axis or direction.';
  const moving = new Set(fold.moving);
  if (
    !moving.size ||
    moving.size >= 16 ||
    moving.size !== fold.moving.length ||
    [...moving].some((id) => !Number.isInteger(id) || id < 0 || id > 15)
  )
    return 'Select a flap, leaving part of the sheet stationary.';
  const edges = hinges(paper);
  const crossing = edges.filter((h) => moving.has(h.a) !== moving.has(h.b));
  if (!crossing.length || crossing.some((h) => h.axis !== fold.axis || h.line !== fold.line))
    return 'This move would separate connected paper away from the selected crease.';
  const actual = crossing
    .map((h) => h.id)
    .sort()
    .join(',');
  if ([...fold.hinges].sort().join(',') !== actual)
    return 'The recorded crease does not match this paper state.';
  const selected = paper.panels.filter((p) => moving.has(p.id));
  const sign = Math.sign(selected[0][fold.axis] - fold.line);
  if (
    selected.some(
      (p) => Math.sign(p[fold.axis] - fold.line) !== sign || Math.abs(p[fold.axis] - fold.line) < 0.5,
    )
  )
    return 'This prototype can only turn a packet entirely on one side of a crease.';
  // Moving pieces must form one packet: source-connected or in face contact.
  const reached = new Set([selected[0].id]);
  for (let i = 0; i < 16; i++)
    for (const p of selected)
      if (
        !reached.has(p.id) &&
        selected.some(
          (q) =>
            reached.has(q.id) &&
            (samePlace(p, q) ||
              edges.some((h) => (h.a === p.id && h.b === q.id) || (h.b === p.id && h.a === q.id))),
        )
      )
        reached.add(p.id);
  if (reached.size !== selected.length)
    return 'These panels do not form one connected flap or touching packet.';
  const rank = new Map(paper.order.map((id, i) => [id, i]));
  for (const p of selected)
    for (const q of paper.panels) {
      if (!moving.has(q.id) && samePlace(p, q) && fold.direction * (rank.get(p.id)! - rank.get(q.id)!) < 0)
        return 'That flap is underneath another layer on this side. Try the opposite direction or unfold the covering layer first.';
    }
  // All stationary faces lie in Z=0; the selected packet stays strictly in the chosen
  // open half-space for 0<angle<PI. Thus no mid-sweep face intersections are possible.
  return undefined;
}
export function applyFold(paper: Paper, fold: Fold): Paper {
  const problem = foldProblem(paper, fold);
  if (problem) throw Error(problem);
  const moving = new Set(fold.moving);
  const turned = paper.order.filter((id) => moving.has(id)).reverse();
  const rest = paper.order.filter((id) => !moving.has(id));
  return {
    panels: paper.panels.map((p) =>
      !moving.has(p.id)
        ? { ...p }
        : fold.axis === 'x'
          ? { ...p, x: 2 * fold.line - p.x, sx: -p.sx as 1 | -1 }
          : { ...p, y: 2 * fold.line - p.y, sy: -p.sy as 1 | -1 },
    ),
    order: fold.direction === 1 ? [...rest, ...turned] : [...turned, ...rest],
  };
}
export type FoldChoice = { moving: number[]; hinges: string[]; side: number; directions: (1 | -1)[] };
export function choices(paper: Paper, axis: Axis, line: number): FoldChoice[] {
  const groups = components(paper, axis, line);
  const result: FoldChoice[] = [];
  for (const side of [-1, 1]) {
    const possible = groups.filter((group) =>
      group.every((id) => Math.sign(paper.panels[id][axis] - line) === side),
    );
    for (let mask = 1; mask < 2 ** possible.length; mask++) {
      const moving = possible
        .filter((_, i) => mask & (1 << i))
        .flat()
        .sort((a, b) => a - b);
      const ids = new Set(moving);
      const hs = hinges(paper)
        .filter((h) => ids.has(h.a) !== ids.has(h.b))
        .map((h) => h.id);
      const directions = ([1, -1] as const).filter(
        (direction) => !foldProblem(paper, { axis, line, moving, hinges: hs, direction }),
      );
      if (directions.length) result.push({ moving, hinges: hs, side, directions });
    }
  }
  return result.sort(
    (a, b) => b.moving.length - a.moving.length || a.side - b.side || a.moving[0] - b.moving[0],
  );
}
export function replay(recording: Recording, count = recording.steps.length): Paper {
  return recording.steps
    .slice(0, count)
    .reduce((paper, step) => (step.fold ? applyFold(paper, step.fold) : paper), flatPaper());
}
export function exampleRecording(): Recording {
  let paper = flatPaper();
  const steps: Step[] = [];
  for (const [axis, line, side] of [
    ['y', 2, -1],
    ['y', 3, -1],
    ['x', 2, 1],
  ] as const) {
    const choice = choices(paper, axis, line).find((c) => c.side === side && c.directions.includes(1))!;
    const fold: Fold = { axis, line, moving: choice.moving, hinges: choice.hinges, direction: 1 };
    steps.push({
      fold,
      view: { position: [5, -6, 22], target: [0, 0, 0] },
      note: [
        'Fold the lower half over the upper half. This is an example, not a verified reading method.',
        'Fold in half again to make a one-row strip.',
        'Fold across to make a two-cell packet.',
      ][steps.length],
    });
    paper = applyFold(paper, fold);
  }
  return { version: 1, paper: 'letter-4x4', title: 'Half, half, across', steps };
}
export function parseRecording(text: string): Recording {
  if (text.length > 2_000_000) throw Error('This recording is too large.');
  const r = JSON.parse(text);
  if (
    !r ||
    r.version !== 1 ||
    r.paper !== 'letter-4x4' ||
    typeof r.title !== 'string' ||
    r.title.length > 120 ||
    !Array.isArray(r.steps) ||
    r.steps.length > 500
  )
    throw Error('Unsupported folding recording. Expected a version 1 Letter 4×4 method.');
  const steps: Step[] = r.steps.map((s: any) => {
    const vector = (v: unknown): v is [number, number, number] =>
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000);
    if (
      !s ||
      typeof s.note !== 'string' ||
      s.note.length > 2000 ||
      !vector(s.view?.position) ||
      !vector(s.view?.target) ||
      Math.hypot(...s.view.position.map((n: number, i: number) => n - s.view.target[i])) < 0.1
    )
      throw Error('Invalid step notes or camera view.');
    if (s.view.up !== undefined) {
      if (!vector(s.view.up)) throw Error('Invalid camera orientation.');
      const [x, y, z] = s.view.up;
      const [dx, dy, dz] = s.view.position.map((n: number, i: number) => n - s.view.target[i]);
      const cross = Math.hypot(y * dz - z * dy, z * dx - x * dz, x * dy - y * dx);
      if (Math.hypot(x, y, z) < 0.001 || cross / (Math.hypot(x, y, z) * Math.hypot(dx, dy, dz)) < 0.001)
        throw Error('Invalid camera orientation.');
    }
    let fold: Fold | undefined;
    if (s.fold !== undefined) {
      const f = s.fold;
      if (
        !f ||
        !Array.isArray(f.moving) ||
        !Array.isArray(f.hinges) ||
        !f.hinges.every((h: unknown) => typeof h === 'string') ||
        f.hinges.length > 24
      )
        throw Error('Invalid recorded fold.');
      fold = { axis: f.axis, line: f.line, direction: f.direction, moving: f.moving, hinges: f.hinges };
    }
    return {
      ...(fold ? { fold } : {}),
      note: s.note,
      view: {
        position: [...s.view.position],
        target: [...s.view.target],
        ...(s.view.up ? { up: [...s.view.up] } : {}),
      },
    };
  });
  const result: Recording = { version: 1, paper: 'letter-4x4', title: r.title, steps };
  replay(result);
  return result;
}
