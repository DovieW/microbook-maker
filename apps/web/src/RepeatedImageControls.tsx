import { settingsSchema, imageOutputModes, laserContrastLevels, type Block } from '@microbook/core';
import type { Workspace } from './LayoutControls';

export function RepeatedImageControls({ w, group }: { w: Workspace; group: Block[] }) {
  const s = settingsSchema.parse(w.kept?.settings || w.draft);
  const common = (values: (string | number)[]) =>
    values.every((v) => v === values[0]) ? String(values[0]) : '';
  const treatments = group.map((b) => s.imageTreatments[b.id] || { kind: 'image' as const });
  const kind = common(treatments.map((t) => t.kind));
  const output = common(group.map((b) => s.imageOutputOverrides[b.id]?.mode ?? 'inherit'));
  const field = (
    label: string,
    value: string,
    options: (readonly [string, string])[],
    change: (value: string) => void,
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={'Repeated images ' + label.toLowerCase()}
        value={value}
        onChange={(e) => change(e.target.value)}
      >
        {!value && (
          <option value="" disabled>
            Mixed
          </option>
        )}
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const treatment = (change: (t: (typeof treatments)[number]) => (typeof treatments)[number]) =>
    w.edit({
      imageTreatments: {
        ...s.imageTreatments,
        ...Object.fromEntries(group.map((b, i) => [b.id, change(treatments[i])])),
      },
    });
  return (
    <details className="repeated-image-controls">
      <summary>Adjust all {group.length} images</summary>
      <fieldset disabled={!!w.kept}>
        <p className="image-output-help">
          Changes affect every occurrence. Other individual settings stay unchanged.
        </p>
        {field(
          'Treatment',
          kind,
          [
            ['image', 'Illustration'],
            ['flourish', 'Flourish'],
          ],
          (value) =>
            treatment(() =>
              value === 'flourish' ? { kind: 'flourish', widthEm: 4, gapEm: 0.25 } : { kind: 'image' },
            ),
        )}
        {kind === 'flourish' &&
          (['widthEm', 'gapEm'] as const).map((key) => {
            const value = common(treatments.map((t) => (t.kind === 'flourish' ? t[key] : 0)));
            return (
              <label className="field" key={key}>
                <span>{key === 'widthEm' ? 'Max width (em)' : 'Gap (em)'}</span>
                <input
                  type="number"
                  aria-label={'Repeated images ' + (key === 'widthEm' ? 'width' : 'gap')}
                  placeholder="Mixed"
                  value={value}
                  min={key === 'widthEm' ? 1 : 0}
                  max={key === 'widthEm' ? 12 : 2}
                  step={key === 'widthEm' ? 0.5 : 0.05}
                  onChange={(e) => {
                    if (e.target.value !== '')
                      treatment((t) => (t.kind === 'flourish' ? { ...t, [key]: Number(e.target.value) } : t));
                  }}
                />
              </label>
            );
          })}
        {kind === 'image' &&
          field(
            'Layout',
            common(group.map((b) => s.imageCellSpans[b.id] ?? 'inherit')),
            [
              ['inherit', 'Use book setting'],
              ['1', 'One cell'],
              ['2', 'Two cells'],
            ],
            (value) => {
              const imageCellSpans = { ...s.imageCellSpans };
              group.forEach((b) => {
                if (value === 'inherit') delete imageCellSpans[b.id];
                else imageCellSpans[b.id] = Number(value) as 1 | 2;
              });
              w.edit({ imageCellSpans });
            },
          )}
        {field(
          'Orientation',
          common(group.map((b) => s.imageRotations[b.id] ?? 0)),
          [
            ['0', 'Original (0°)'],
            ['90', '90° right'],
            ['180', '180°'],
            ['270', '90° left'],
          ],
          (value) =>
            w.edit({
              imageRotations: {
                ...s.imageRotations,
                ...Object.fromEntries(group.map((b) => [b.id, Number(value) as 0 | 90 | 180 | 270])),
              },
            }),
        )}
        {field(
          'Image output',
          output,
          [['inherit', 'Use book setting'], ...imageOutputModes.map((m) => [m.value, m.label] as const)],
          (value) => {
            const imageOutputOverrides = { ...s.imageOutputOverrides };
            group.forEach((b) => {
              if (value === 'inherit') delete imageOutputOverrides[b.id];
              else
                imageOutputOverrides[b.id] = {
                  ...(imageOutputOverrides[b.id] || s.imageOutput),
                  mode: value as 'original' | 'grayscale' | 'laser',
                };
            });
            w.edit({ imageOutputOverrides });
          },
        )}
        {(output === 'laser' || (output === 'inherit' && s.imageOutput.mode === 'laser')) &&
          field(
            'Laser contrast',
            common(group.map((b) => (s.imageOutputOverrides[b.id] || s.imageOutput).strength)),
            laserContrastLevels.map((l) => [l.value, l.label] as const),
            (value) =>
              w.edit({
                imageOutputOverrides: {
                  ...s.imageOutputOverrides,
                  ...Object.fromEntries(
                    group.map((b) => [
                      b.id,
                      { mode: 'laser' as const, strength: value as 'gentle' | 'standard' | 'strong' },
                    ]),
                  ),
                },
              }),
          )}
      </fieldset>
    </details>
  );
}
