import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { CellMap } from '@microbook/core';

GlobalWorkerOptions.workerSrc = worker;
const documents = new Map<string, Promise<PDFDocumentProxy>>();

function load(renderId: string) {
  let document = documents.get(renderId);
  if (!document) {
    document = getDocument({ url: `/api/renders/${renderId}/pdf` }).promise;
    documents.set(renderId, document);
  }
  return document;
}

export function SectionPreview({
  renderId,
  title,
  cell,
  region,
}: {
  renderId: string;
  title: string;
  cell: CellMap;
  region?: { x: number; y: number };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let render: { cancel: () => void; promise: Promise<void> } | undefined;
    setLoading(true);
    setError(false);
    void load(renderId)
      .then(async (document) => {
        if (cancelled || !canvas.current) return;
        const page = await document.getPage(cell.page + 1);
        if (cancelled || !canvas.current) return;
        const width = 280;
        const cropY = Math.max(cell.y, (region?.y ?? cell.y) - 8);
        const cropHeight = Math.min(cell.y + cell.height - cropY, cell.width * 0.65);
        const pixelRatio = Math.min(devicePixelRatio || 1, 2);
        const scale = (width / cell.width) * pixelRatio;
        const viewport = page.getViewport({ scale });
        const target = canvas.current;
        target.width = Math.ceil(width * pixelRatio);
        target.height = Math.ceil(cropHeight * scale);
        const context = target.getContext('2d')!;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, target.width, target.height);
        render = page.render({
          canvas: target,
          canvasContext: context,
          viewport,
          transform: [1, 0, 0, 1, -cell.x * scale, -cropY * scale],
        });
        await render.promise;
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [renderId, cell.page, cell.x, cell.y, cell.width, cell.height, region?.y]);

  return (
    <div className="section-mini-preview" aria-label={`Preview of ${title}`}>
      {loading && <span className="section-preview-loading">Loading preview…</span>}
      {error ? <span>Preview unavailable</span> : <canvas ref={canvas} role="img" aria-label={title} />}
    </div>
  );
}
