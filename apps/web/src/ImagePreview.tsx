import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Minus, Plus, X } from 'lucide-react';
import { IconButton } from './ui';
export type PreviewImage = { src: string; alt: string; title: string };
export function ImagePreview({
  image,
  onClose,
  returnFocus,
}: {
  image?: PreviewImage;
  onClose: () => void;
  returnFocus: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => setZoom(1), [image?.src]);
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
          className="image-preview-dialog redesign"
          aria-describedby="image-preview-description"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
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
          <div className="image-preview-stage" tabIndex={0} aria-label="Image pan area">
            <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
              {image && <img src={image.src} alt={image.alt} draggable={false} />}
            </div>
          </div>
          <footer>
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
