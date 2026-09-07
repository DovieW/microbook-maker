import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, AnnotationMode, type PDFDocumentProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFViewer, PDFLinkService, EventBus, PDFFindController } from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { RenderJob } from '@microbook/core';
import type { ReadingPosition } from './store';
GlobalWorkerOptions.workerSrc = worker;
export type FindState = { current: number; total: number; pending?: boolean };
type Props = {
  job: RenderJob;
  cell: number;
  initial?: ReadingPosition;
  zoom: number;
  zoomMode: 'fit' | 'custom';
  visible?: boolean;
  onZoom: (n: number) => void;
  onReading: (id: string, p: ReadingPosition) => void;
  selectedImageId?: string;
  onImage: (id: string) => void;
  imageLabels?: Record<string, number>;
  jump?: { id: string; page: number; x: number; y: number; serial: number };
  query: string;
  findOpen: boolean;
  findCommand?: { serial: number; previous: boolean };
  onFind: (state: FindState) => void;
};
export function Preview(props: Props) {
  const { job, visible = true } = props;
  const holder = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;
  const [adapter, setAdapter] = useState<{
    viewer: PDFViewer;
    events: EventBus;
    find: PDFFindController;
    pdf: PDFDocumentProxy;
  }>();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState('');
  const restored = useRef(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number>();
  const activeRef = useRef(visible);
  activeRef.current = visible;
  const lastJump = useRef(0);
  const lastPosition = useRef<ReadingPosition | undefined>(undefined);
  useEffect(() => {
    if (!holder.current || !pages.current) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let scrollTimer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setError('');
    setProgress(undefined);
    lastJump.current = 0;
    restored.current = false;
    setReady('');
    const events = new EventBus();
    const linkService = new PDFLinkService({ eventBus: events });
    const find = new PDFFindController({ eventBus: events, linkService });
    const viewer = new PDFViewer({
      container: holder.current,
      viewer: pages.current,
      eventBus: events,
      linkService,
      findController: find,
      textLayerMode: 1,
      annotationMode: AnnotationMode.DISABLE,
      removePageBorders: true,
      maxCanvasPixels: 16_000_000,
      enableAutoLinking: false,
    });
    linkService.setViewer(viewer);
    const overlays = () => {
      for (let p = 0; p < job.result!.pages; p++) {
        const page = viewer.getPageView(p);
        if (!page?.div) continue;
        if (job.settings.mode !== 'book') continue;
        const existing = page.div.querySelector('.image-overlays') as HTMLElement | null;
        if (existing) {
          existing.querySelectorAll<HTMLElement>('.image-hit').forEach((hit) => {
            hit.classList.toggle('selected', hit.dataset.imageBlock === live.current.selectedImageId);
          });
          continue;
        }
        const layer = document.createElement('div');
        layer.className = 'image-overlays';
        for (const region of job.result!.imageRegions || [])
          if (region.page === p && region.blockId) {
            const hit = document.createElement('div');
            hit.className = `image-hit${region.blockId === live.current.selectedImageId ? ' selected' : ''}`;
            hit.dataset.imageBlock = region.blockId;
            Object.assign(hit.style, {
              left: `${(region.x / 612) * 100}%`,
              top: `${(region.y / 792) * 100}%`,
              width: `${(region.width / 612) * 100}%`,
              height: `${(region.height / 792) * 100}%`,
            });
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Edit image';
            button.setAttribute(
              'aria-label',
              `Edit image ${live.current.imageLabels?.[region.blockId] ?? region.blockId}`,
            );
            button.onclick = () => live.current.onImage(region.blockId!);
            hit.append(button);
            layer.append(hit);
          }
        page.div.append(layer);
      }
    };
    events.on('pagesinit', () => {
      if (!stopped) {
        setReady(job.id);
        overlays();
      }
    });
    events.on('pagerendered', () => {
      if (!stopped && activeRef.current) {
        setLoading(false);
        overlays();
      }
    });
    events.on('scalechanging', ({ scale }: { scale: number }) => {
      if (activeRef.current) live.current.onZoom(scale);
    });
    events.on('updatefindmatchescount', ({ matchesCount }: { matchesCount: FindState }) => {
      if (activeRef.current) live.current.onFind(matchesCount);
    });
    events.on(
      'updatefindcontrolstate',
      ({ state, matchesCount }: { state: number; matchesCount: FindState }) => {
        if (activeRef.current) live.current.onFind({ ...matchesCount, pending: state === 3 });
      },
    );
    events.on(
      'updateviewarea',
      ({ location }: { location: { pageNumber: number; left: number; top: number } }) => {
        if (stopped || !activeRef.current) return;
        lastPosition.current = { page: location.pageNumber, left: location.left, top: location.top };
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          if (lastPosition.current) live.current.onReading(job.id, lastPosition.current);
        }, 120);
        clearTimeout(timer);
        timer = setTimeout(() => {
          const viewport = holder.current!.getBoundingClientRect();
          for (let i = 0; i < viewer.pagesCount; i++) {
            const pv = viewer.getPageView(i),
              r = pv.div.getBoundingClientRect();
            if (r.bottom < viewport.top - r.height || r.top > viewport.bottom + r.height) pv.reset();
          }
          overlays();
        }, 250);
      },
    );
    const task = getDocument({ url: `/api/renders/${job.id}/pdf` });
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (total && !stopped) setProgress(Math.round((loaded / total) * 100));
    };
    void task.promise
      .then((pdf) => {
        if (stopped) return;
        linkService.setDocument(pdf);
        viewer.setDocument(pdf);
        setAdapter({ viewer, events, find, pdf });
      })
      .catch((e) => {
        if (!stopped) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(scrollTimer);
      viewer.setDocument(null as unknown as PDFDocumentProxy);
      void task.destroy();
      setAdapter(undefined);
    };
  }, [job.id]);
  useEffect(() => {
    if (!adapter || ready !== job.id) return;
    const { viewer } = adapter;
    if (!visible) {
      for (let i = 0; i < viewer.pagesCount; i++) viewer.getPageView(i).reset();
      return;
    }
    viewer.currentScaleValue = props.zoomMode === 'fit' ? 'page-width' : String(props.zoom);
    if (!restored.current) {
      restored.current = true;
      const p = live.current.initial;
      const c = job.result!.cells[live.current.cell];
      if (p)
        viewer.scrollPageIntoView({
          pageNumber: Math.min(job.result!.pages, p.page),
          destArray: [null, { name: 'XYZ' }, p.left, p.top, null],
          allowNegativeOffset: true,
        });
      else if (c)
        viewer.scrollPageIntoView({
          pageNumber: c.page + 1,
          destArray: [null, { name: 'XYZ' }, c.x, 792 - c.y, null],
        });
    }
    viewer.update();
    props.onZoom(viewer.currentScale);
    const resize = new ResizeObserver(() => {
      if (props.zoomMode === 'fit') {
        const p = lastPosition.current;
        viewer.currentScaleValue = 'page-width';
        if (p)
          viewer.scrollPageIntoView({
            pageNumber: p.page,
            destArray: [null, { name: 'XYZ' }, p.left, p.top, null],
            allowNegativeOffset: true,
          });
      }
    });
    if (holder.current) resize.observe(holder.current);
    return () => resize.disconnect();
  }, [adapter, visible, props.zoom, props.zoomMode, ready]);
  useEffect(() => {
    if (
      !adapter ||
      ready !== job.id ||
      !visible ||
      props.jump?.id !== job.id ||
      lastJump.current === props.jump.serial
    )
      return;
    lastJump.current = props.jump.serial;
    adapter.viewer.scrollPageIntoView({
      pageNumber: props.jump.page,
      destArray: [null, { name: 'XYZ' }, props.jump.x, 792 - props.jump.y, null],
      allowNegativeOffset: true,
    });
  }, [adapter, visible, props.jump, ready]);
  useEffect(() => {
    holder.current
      ?.querySelectorAll<HTMLElement>('.image-hit')
      .forEach((hit) => hit.classList.toggle('selected', hit.dataset.imageBlock === props.selectedImageId));
  }, [props.selectedImageId]);
  useEffect(() => {
    if (adapter && visible) {
      if (!props.findOpen) {
        adapter.events.dispatch('findbarclose', { source: holder.current });
        return;
      }
      props.onFind({ current: 0, total: 0, pending: !!props.query });
      adapter.events.dispatch('find', {
        source: holder.current,
        type: '',
        query: props.query,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        findPrevious: false,
        matchDiacritics: false,
      });
    }
  }, [adapter, props.query, visible, props.findOpen]);
  useEffect(() => {
    if (adapter && visible && props.findOpen && props.findCommand)
      adapter.events.dispatch('find', {
        source: holder.current,
        type: 'again',
        query: props.query,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        findPrevious: props.findCommand.previous,
        matchDiacritics: false,
      });
  }, [props.findCommand]);
  return (
    <div
      className="viewer-holder"
      hidden={!visible}
      aria-label="Print preview"
      aria-busy={loading ? 'true' : 'false'}
      data-render-id={job.id}
    >
      <div className="pdf-viewport" ref={holder}>
        <div className="pdfViewer" ref={pages} />
      </div>
      {loading && (
        <span className="viewer-progress" role="status">
          {progress !== undefined && progress < 100 ? `Loading PDF · ${progress}%` : 'Drawing preview'}
        </span>
      )}
      {error && (
        <p className="viewer-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
