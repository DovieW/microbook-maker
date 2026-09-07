import { settingsSchema, imageOutputModes, laserContrastLevels, type ImageOutput } from '@microbook/core';
import type { Workspace } from './LayoutControls';
export function ImageOutputControls({ w, blockId }: { w: Workspace; blockId?: string }) {
  const draft = w.kept ? settingsSchema.parse(w.kept.settings) : w.draft;
  const override = blockId ? draft.imageOutputOverrides[blockId] : undefined;
  const output = override || draft.imageOutput;
  const change = (value: ImageOutput) =>
    w.edit(
      blockId
        ? { imageOutputOverrides: { ...draft.imageOutputOverrides, [blockId]: value } }
        : { imageOutput: value },
    );
  return (
    <div className="image-output-controls">
      <label className="field">
        <span>Image output</span>
        <select
          aria-label={blockId ? 'Output for this image' : 'Default image output'}
          value={blockId && !override ? 'inherit' : output.mode}
          onChange={(e) => {
            if (e.target.value === 'inherit' && blockId) {
              const overrides = { ...draft.imageOutputOverrides };
              delete overrides[blockId];
              w.edit({ imageOutputOverrides: overrides });
            } else change({ ...output, mode: e.target.value as ImageOutput['mode'] });
          }}
        >
          {blockId && <option value="inherit">Use book setting</option>}
          {imageOutputModes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {blockId && !override && (
        <p className="image-output-help">
          Using book setting: {imageOutputModes.find((m) => m.value === output.mode)?.label}
          {output.mode === 'laser'
            ? ` · ${laserContrastLevels.find((l) => l.value === output.strength)?.label}`
            : ''}
          . Choose an output above to change this image.
        </p>
      )}
      <p className="image-output-help">
        {imageOutputModes.find((m) => m.value === output.mode)?.description}
      </p>
      {output.mode === 'laser' && (!blockId || override) && (
        <>
          <label className="field">
            <span>Laser contrast</span>
            <select
              aria-label={blockId ? 'Laser contrast for this image' : 'Default laser contrast'}
              value={output.strength}
              onChange={(e) => change({ ...output, strength: e.target.value as ImageOutput['strength'] })}
            >
              {laserContrastLevels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <p className="image-output-help">
            {laserContrastLevels.find((l) => l.value === output.strength)?.description}
          </p>
        </>
      )}
      {!blockId && (
        <p className="image-output-help">
          Originals are preserved. Processed images are reused when you Apply. These defaults are remembered
          for new books.
        </p>
      )}
    </div>
  );
}
