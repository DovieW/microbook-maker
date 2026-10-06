import { choices, type Axis, type Fold, type Paper } from './model';

export type PickedFold = { fold: Fold; directions: (1 | -1)[] };
/** Prefer the smallest exposed flap, rather than asking users to understand the stack. */
export function pickFlap(
  paper: Paper,
  axis: Axis,
  line: number,
  panelId: number,
  facing: 1 | -1,
): PickedFold | undefined {
  const options = choices(paper, axis, line).filter((c) => c.moving.includes(panelId));
  options.sort(
    (a, b) =>
      Number(b.directions.includes(facing)) - Number(a.directions.includes(facing)) ||
      a.moving.length - b.moving.length,
  );
  const c = options[0];
  return c
    ? {
        fold: {
          axis,
          line,
          moving: c.moving,
          hinges: c.hinges,
          direction: c.directions.includes(facing) ? facing : c.directions[0],
        },
        directions: c.directions,
      }
    : undefined;
}
