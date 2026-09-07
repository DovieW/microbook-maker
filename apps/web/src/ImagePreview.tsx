import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Minus, Plus, X } from 'lucide-react';
import { imageOutputQuery, imageOutputModes, laserContrastLevels, type ImageOutput } from '@microbook/core';
import { IconButton } from './ui';
export type PreviewImage = { src: string; blockId: string; output: ImageOutput; alt: string; title: string };
function ComparisonImage({ src, alt, zoom }: { src: string; alt: string; zoom: number }) {
  const [status, setStatus] = useState('Preparing image…');
  return (
    <>
      <div className="image-preview-stage" tabIndex={0} aria-label={`${alt} pan area`}>
        <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={() => setStatus('')}
            onError={() => setStatus('Image could not load. Close and retry.')}
          />
        </div>
      </div>
      <span className="image-processing-status" role="status">
        {status}
      </span>
    </>
  );
}
export function ImagePreview({
  image,
  onClose,
  returnFocus,
  onChoose,
}: {
  image?: PreviewImage;
  onClose: () => void;
  returnFocus: () => void;
  onChoose?: (output: ImageOutput) => void;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [version, setVersion] = useState<ImageOutput['mode']>('laser');
  const [strength, setStrength] = useState<ImageOutput['strength']>('gentle');
  useEffect(() => {
    if (!image) return;
    setZoom(1);
    setVersion(image.output.mode);
    setStrength(image.output.strength);
  }, [image?.src]);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  const shown =
    width >= 1050
      ? imageOutputModes
      : width >= 700
        ? imageOutputModes.filter(
            (m) => m.value === 'original' || m.value === (version === 'original' ? 'laser' : version),
          )
        : imageOutputModes.filter((m) => m.value === version);
  return (
    <Dialog.Root
      open={!!image}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="image-preview-overlay" />
        <Dialog.Content
          ref={setElement}
          className="image-preview-dialog redesign"
          aria-describedby="image-preview-description"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus();
          }}
        >
          <header>
            <div>
              <Dialog.Title>Image preview</Dialog.Title>
              <Dialog.Description id="image-preview-description">{image?.title}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close image preview">
                <X size={20} />
              </IconButton>
            </Dialog.Close>
          </header>
          <div className="image-comparison-toolbar">
            {width < 1050 && (
              <label>
                {width >= 700 ? 'Compare with' : 'Preview version'}{' '}
                <select
                  aria-label="Preview version"
                  value={width >= 700 && version === 'original' ? 'laser' : version}
                  onChange={(e) => {
                    setVersion(e.target.value as ImageOutput['mode']);
                    setZoom(1);
                  }}
                >
                  {imageOutputModes
                    .filter((m) => width < 700 || m.value !== 'original')
                    .map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {shown.some((m) => m.value === 'laser') && (
              <label>
                Laser contrast{' '}
                <select
                  aria-label="Preview laser contrast"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value as ImageOutput['strength'])}
                >
                  {laserContrastLevels.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div
            className="image-comparison-panels"
            style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
          >
            {image &&
              shown.map((mode) => {
                const output: ImageOutput = { mode: mode.value, strength };
                const selected =
                  image.output.mode === mode.value &&
                  (mode.value !== 'laser' || image.output.strength === strength);
                const src = image.src + imageOutputQuery(output);
                return (
                  <section
                    key={mode.value}
                    className="image-comparison-panel"
                    aria-label={`${mode.label} preview`}
                  >
                    <div className="image-comparison-heading">
                      <h3>{mode.label}</h3>
                      {onChoose && (
                        <button
                          disabled={selected}
                          aria-label={`Use ${mode.label} for this image`}
                          onClick={() => onChoose(output)}
                        >
                          {selected ? 'Selected' : 'Use this version'}
                        </button>
                      )}
                    </div>
                    <ComparisonImage key={src} src={src} alt={mode.label} zoom={zoom} />
                  </section>
                );
              })}
          </div>
          <footer>
            <span className="image-preview-hint">
              {onChoose
                ? 'Choose a version here, then Apply in the sidebar to update the PDF.'
                : 'Preview only · kept version'}{' '}
            </span>
            <IconButton
              label="Zoom image out"
              disabled={zoom <= 1}
              onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            >
              <Minus size={18} />
            </IconButton>
            <button onClick={() => setZoom(1)} aria-label="Fit image">
              {zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}
            </button>
            <IconButton
              label="Zoom image in"
              disabled={zoom >= 4}
              onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
            >
              <Plus size={18} />
            </IconButton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
