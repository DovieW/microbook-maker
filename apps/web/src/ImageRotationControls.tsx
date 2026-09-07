import { RotateCcw, RotateCw } from 'lucide-react';
import { IconButton } from './ui';
export function ImageRotationControls({
  rotation,
  onChange,
  onMatch,
  count = 0,
}: {
  rotation: number;
  onChange: (rotation: 0 | 90 | 180 | 270) => void;
  onMatch?: () => void;
  count?: number;
}) {
  return (
    <div className="image-rotation-controls">
      <span>Orientation · {rotation}°</span>
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
      <button disabled={!rotation} onClick={() => onChange(0)}>
        Reset orientation
      </button>
      {onMatch && count > 1 && (
        <button onClick={onMatch}>Apply orientation to all {count} matching images</button>
      )}
    </div>
  );
}
