import { settingsSchema, type ImageOutput } from '@microbook/core';
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
          <option value="original">Original color</option>
          <option value="grayscale">Grayscale</option>
          <option value="laser">Laser optimized</option>
        </select>
      </label>
      {output.mode === 'laser' && (!blockId || override) && (
        <label className="field">
          <span>Contrast</span>
          <select
            aria-label={blockId ? 'Contrast for this image' : 'Default image contrast'}
            value={output.strength}
            onChange={(e) => change({ ...output, strength: e.target.value as ImageOutput['strength'] })}
          >
            <option value="gentle">Gentle</option>
            <option value="standard">Standard</option>
            <option value="strong">Strong</option>
          </select>
        </label>
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
