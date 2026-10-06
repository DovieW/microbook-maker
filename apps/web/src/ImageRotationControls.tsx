import { RotateCcw, RotateCw, Undo2 } from 'lucide-react';
import { imageRotationOptions, type ImageRotation } from '@microbook/core';
import { Dropdown, IconButton } from './ui';
export function ImageRotationControls({
  rotation,
  onChange,
  onMatch,
  count = 0,
  override,
  onInherit,
}: {
  rotation: ImageRotation;
  override?: ImageRotation;
  onChange: (rotation: ImageRotation) => void;
  onInherit?: () => void;
  onMatch?: () => void;
  count?: number;
}) {
  return (
    <div className="image-rotation-controls">
      <label className="field">
        <span>Orientation</span>
        <Dropdown
          label="Image orientation"
          value={onInherit ? (override === undefined ? 'inherit' : String(override)) : String(rotation)}
          options={
            onInherit ? [['inherit', 'Use book default'], ...imageRotationOptions] : imageRotationOptions
          }
          onChange={(value) =>
            value === 'inherit' ? onInherit?.() : onChange(Number(value) as ImageRotation)
          }
        />
      </label>
      <IconButton
        label="Rotate image left"
        onClick={() => onChange(((rotation + 270) % 360) as 0 | 90 | 180 | 270)}
      >
        <RotateCcw size={18} />
      </IconButton>
      <IconButton
        label="Rotate image right"
        onClick={() => onChange(((rotation + 90) % 360) as 0 | 90 | 180 | 270)}
      >
        <RotateCw size={18} />
      </IconButton>
      <IconButton
        label="Reset orientation"
        disabled={onInherit ? override === undefined : !rotation}
        onClick={() => (onInherit ? onInherit() : onChange(0))}
      >
        <Undo2 size={18} />
      </IconButton>
      {onMatch && count > 1 && (
        <button onClick={onMatch}>Apply orientation to all {count} matching images</button>
      )}
    </div>
  );
}
