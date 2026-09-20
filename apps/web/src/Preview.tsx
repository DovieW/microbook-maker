import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, AnnotationMode, type PDFDocumentProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFViewer, PDFLinkService, EventBus, PDFFindController } from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { RenderJob } from '@microbook/core';
import type { ReadingPosition } from './store';
import './motion-preview.css';
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
  selectedSectionId?: string;
  selectedSectionCell?: number;
  onImage: (id: string) => void;
  imageLabels?: Record<string, number>;
  jump?: {
    id: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    serial: number;
    cue: boolean;
  };
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
  const [entered, setEntered] = useState(false);
  const restored = useRef(false);
  const enteredRef = useRef(false);
  const [error, setError] = useState('');
  const activeRef = useRef(visible);
  activeRef.current = visible;
  const lastJump = useRef(0);
  const cueTimer = useRef<number | undefined>(undefined);
  const cueFrame = useRef<number | undefined>(undefined);
  const revealFrame = useRef<number | undefined>(undefined);
  const revealReady = useRef<() => void>(() => {});
  const lastPosition = useRef<ReadingPosition | undefined>(undefined);
  useEffect(() => {
    if (!holder.current || !pages.current) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let scrollTimer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setError('');
    lastJump.current = 0;
    restored.current = false;
    enteredRef.current = false;
    setEntered(false);
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
    const addSectionHit = (
      layer: HTMLElement,
      region: { x: number; y: number; width: number; height: number },
      sectionId: string,
      fallback = false,
    ) => {
      const hit = document.createElement('div');
      hit.className = `section-hit${fallback ? ' fallback' : ''}${sectionId === live.current.selectedSectionId ? ' selected' : ''}`;
      hit.dataset.sectionId = sectionId;
      Object.assign(hit.style, {
        left: `${(region.x / 612) * 100}%`,
        top: `${(region.y / 792) * 100}%`,
        width: `${(region.width / 612) * 100}%`,
        height: `${(region.height / 792) * 100}%`,
      });
      layer.append(hit);
    };
    const overlays = () => {
      for (let p = 0; p < job.result!.pages; p++) {
        const page = viewer.getPageView(p);
        if (!page?.div) continue;
        if (job.settings.mode !== 'book') continue;
        const existing = page.div.querySelector('.image-overlays') as HTMLElement | null;
        if (existing) {
          existing.querySelectorAll('.section-hit.fallback').forEach((hit) => hit.remove());
          existing.querySelectorAll<HTMLElement>('.image-hit').forEach((hit) => {
            hit.classList.toggle('selected', hit.dataset.imageBlock === live.current.selectedImageId);
          });
          existing.querySelectorAll<HTMLElement>('.section-hit').forEach((hit) => {
            hit.classList.toggle('selected', hit.dataset.sectionId === live.current.selectedSectionId);
          });
          const selectedCell = job.result!.cells[live.current.selectedSectionCell ?? -1];
          if (
            live.current.selectedSectionId &&
            selectedCell?.page === p &&
            !existing.querySelector(
              `.section-hit[data-section-id="${CSS.escape(live.current.selectedSectionId)}"]`,
            )
          )
            addSectionHit(existing, selectedCell, live.current.selectedSectionId, true);
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
        for (const region of job.result!.sectionRegions || [])
          if (region.page === p) addSectionHit(layer, region, region.sectionId);
        const selectedCell = job.result!.cells[live.current.selectedSectionCell ?? -1];
        if (
          live.current.selectedSectionId &&
          selectedCell?.page === p &&
          !(job.result!.sectionRegions || []).some(
            (region) => region.sectionId === live.current.selectedSectionId,
          )
        )
          addSectionHit(layer, selectedCell, live.current.selectedSectionId, true);
        page.div.append(layer);
      }
    };
    events.on('pagesinit', () => {
      if (!stopped) {
        setReady(job.id);
        overlays();
      }
    });
    const revealVisiblePage = () => {
      if (!restored.current || enteredRef.current || !holder.current) return;
      const viewport = holder.current.getBoundingClientRect();
      for (let index = 0; index < viewer.pagesCount; index++) {
        const page = viewer.getPageView(index);
        if (page?.renderingState !== 3) continue;
        const rect = page.div.getBoundingClientRect();
        if (rect.bottom > viewport.top && rect.top < viewport.bottom) {
          enteredRef.current = true;
          setEntered(true);
          return;
        }
      }
    };
    revealReady.current = revealVisiblePage;
    events.on('pagerendered', () => {
      if (!stopped && activeRef.current) {
        setLoading(false);
        revealVisiblePage();
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
      window.clearTimeout(cueTimer.current);
      window.cancelAnimationFrame(cueFrame.current || 0);
      window.cancelAnimationFrame(revealFrame.current || 0);
      revealReady.current = () => {};
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
    window.cancelAnimationFrame(revealFrame.current || 0);
    revealFrame.current = window.requestAnimationFrame(() => revealReady.current());
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
    holder.current?.querySelector('.preview-jump-cue')?.remove();
    window.clearTimeout(cueTimer.current);
    window.cancelAnimationFrame(cueFrame.current || 0);
    if (props.jump.cue) {
      let attempts = 0;
      const showCue = () => {
        const page = adapter.viewer.getPageView(props.jump!.page - 1);
        const layer = (page?.div as HTMLElement | undefined)?.querySelector<HTMLElement>('.image-overlays');
        if (!layer) {
          if (++attempts < 30) cueFrame.current = window.requestAnimationFrame(showCue);
          return;
        }
        const cue = document.createElement('div');
        cue.className = 'preview-jump-cue';
        cue.dataset.jumpSerial = String(props.jump!.serial);
        Object.assign(cue.style, {
          left: `${(props.jump!.x / 612) * 100}%`,
          top: `${(props.jump!.y / 792) * 100}%`,
          width: `${(props.jump!.width / 612) * 100}%`,
          height: `${(props.jump!.height / 792) * 100}%`,
        });
        layer.append(cue);
        cueTimer.current = window.setTimeout(() => cue.remove(), 700);
      };
      showCue();
    }
  }, [adapter, visible, props.jump, ready]);
  useEffect(() => {
    holder.current
      ?.querySelectorAll<HTMLElement>('.image-hit')
      .forEach((hit) => hit.classList.toggle('selected', hit.dataset.imageBlock === props.selectedImageId));
    holder.current
      ?.querySelectorAll<HTMLElement>('.section-hit')
      .forEach((hit) => hit.classList.toggle('selected', hit.dataset.sectionId === props.selectedSectionId));
  }, [props.selectedImageId, props.selectedSectionId]);
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
      className={`viewer-holder${entered ? ' preview-entered' : ''}`}
      hidden={!visible}
      aria-label="Print preview"
      aria-busy={loading ? 'true' : 'false'}
      data-render-id={job.id}
    >
      <div className="pdf-viewport" ref={holder}>
        <div className="pdfViewer" ref={pages} />
      </div>
      {loading && (
        <div className="viewer-loading" role="status" aria-label="Loading preview">
          <LoaderCircle size={24} className="spin" aria-hidden="true" />
        </div>
      )}
      {error && (
        <p className="viewer-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
