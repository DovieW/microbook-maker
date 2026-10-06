import {
  settingsSchema,
  imageOutputModes,
  laserContrastLevels,
  imageLayoutForBlock,
  imageLayoutOverride,
  imageLayoutOptions,
  imageRotationOptions,
  type ImageRotation,
  type ImageLayout,
  type Block,
} from '@microbook/core';
import { imageLayoutChanges, imageRotationChanges } from './imageLayoutSettings';
import type { Workspace } from './LayoutControls';

export function RepeatedImageControls({ w, group }: { w: Workspace; group: Block[] }) {
  const s = settingsSchema.parse(w.kept?.settings || w.draft);
  const common = (values: (string | number)[]) =>
    values.every((v) => v === values[0]) ? String(values[0]) : '';
  const treatments = group.map(
    (b) =>
      s.imageTreatments[b.id] ||
      (imageLayoutForBlock(s, b.id) === 'flourish'
        ? { kind: 'flourish' as const, widthEm: 4, gapEm: 0.25 }
        : { kind: 'image' as const }),
  );
  const kind = common(group.map((b) => imageLayoutForBlock(s, b.id)));
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
    <fieldset className="repeated-image-controls" disabled={!!w.kept}>
      <p className="image-output-help">
        Changes affect every occurrence. Other individual settings stay unchanged.
      </p>
      {field(
        'Image layout',
        common(group.map((b) => imageLayoutOverride(s, b.id) ?? 'inherit')),
        [['inherit', 'Use book default'], ...imageLayoutOptions],
        (value) =>
          w.edit(
            imageLayoutChanges(
              s,
              group.map((b) => b.id),
              value as ImageLayout | 'inherit',
            ),
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
      {field(
        'Orientation',
        common(group.map((b) => s.imageRotations[b.id] ?? 'inherit')),
        [['inherit', 'Use book default'], ...imageRotationOptions],
        (value) =>
          w.edit(
            imageRotationChanges(
              s,
              group.map((b) => b.id),
              value === 'inherit' ? 'inherit' : (Number(value) as ImageRotation),
            ),
          ),
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
  );
}
