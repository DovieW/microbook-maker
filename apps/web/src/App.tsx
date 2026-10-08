import { version } from '../../../package.json';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BookOpen,
  PanelLeft,
  Printer,
  Download,
  History,
  Minus,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Origami,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useWorkspace } from './useWorkspace';
import { RenderActivity } from './RenderActivity';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { Navigation } from './Navigation';
import { IconButton } from './ui';
import { modeLabels } from '@microbook/core';
import { printedLocation } from './imageLocations';
import { PrintTips } from './PrintTips';
import type { FindState } from './Preview';
const FoldingSimulator = lazy(() =>
  import('./folding/FoldingSimulator').then((m) => ({ default: m.FoldingSimulator })),
);
const Preview = lazy(() => import('./Preview').then((m) => ({ default: m.Preview })));
export default function App() {
  const w = useWorkspace();
  const [bookletView, setBookletView] = useState<'reading' | 'print'>('reading');
  const readingBooklet = bookletView === 'reading' && !!w.preview?.result?.booklet;
  const [foldingOpen, setFoldingOpen] = useState(false);
  const foldingButton = useRef<HTMLButtonElement>(null);
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width:959px)').matches);
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState<FindState>({ current: 0, total: 0 });
  const [findCommand, setFindCommand] = useState<{ serial: number; previous: boolean }>();
  const findInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.spoilerFree = String(w.prefs.spoilerFree);
    return () => {
      delete document.documentElement.dataset.spoilerFree;
    };
  }, [w.prefs.spoilerFree]);
  useEffect(() => {
    const media = matchMedia('(max-width:959px)');
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (foldingOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && w.preview) {
        e.preventDefault();
        setFindOpen(true);
        requestAnimationFrame(() => findInput.current?.select());
      }
      if (e.key === 'Escape' && findOpen) {
        setFindOpen(false);
        findInput.current?.blur();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [w.preview, findOpen, foldingOpen]);
  const page =
    (readingBooklet
      ? w.preview?.result?.booklet?.reading.cells[w.cell]?.page || 0
      : w.preview?.result?.cells[w.cell]?.page || 0) + 1;
  const toggleSidebar = () =>
    narrow ? w.setMobileOpen(!w.mobileOpen) : w.prefs.patch({ sidebarOpen: !w.prefs.sidebarOpen });
  const mainPreview = (rendered: NonNullable<typeof w.preview>) => (
    <Preview
      key={rendered.id}
      job={rendered}
      bookletView={bookletView}
      visible={w.preview?.id === rendered.id}
      cell={w.preview?.id === rendered.id ? w.cell : w.docPrefs?.cells?.[rendered.settings.mode] || 0}
      initial={w.kept ? undefined : w.docPrefs?.reading?.[rendered.settings.mode]}
      zoom={w.prefs.zoom}
      zoomMode={w.prefs.zoomMode}
      loadingMode={w.prefs.previewLoading}
      onZoom={w.setActualZoom}
      onReading={w.onReading}
      jump={w.jump}
      selectedImageId={w.docPrefs?.selectedImageId}
      selectedSectionId={w.selectedSectionId}
      selectedSectionCell={w.selectedSectionCell}
      onImage={w.openImages}
      imageLabels={Object.fromEntries(w.imageEntries.map((entry, i) => [entry.block.id, i + 1]))}
      query={w.docPrefs?.search || ''}
      findOpen={findOpen}
      onFind={setFind}
      findCommand={findCommand}
    />
  );
  return (
    <div
      className="app redesign"
      onDragOver={(e) => {
        if (foldingOpen) return;
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          w.setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) w.setDragging(false);
      }}
      onDrop={(e) => {
        if (foldingOpen) return;
        e.preventDefault();
        w.setDragging(false);
        const file = e.dataTransfer.files[0];
        if (/\.json$/i.test(file?.name || '')) void w.importSettings(file);
        else void w.importFile(file);
      }}
    >
      <input
        ref={w.input}
        type="file"
        tabIndex={-1}
        className="sr-only"
        aria-label="Import book"
        accept=".epub,.pdf,.txt,.md,.markdown"
        onChange={(e) => void w.importFile(e.target.files?.[0])}
      />
      {foldingOpen && (
        <Suspense
          fallback={
            <div role="status" className="preview-empty">
              Opening folding simulator…
            </div>
          }
        >
          <FoldingSimulator
            onClose={() => {
              setFoldingOpen(false);
              requestAnimationFrame(() => foldingButton.current?.focus());
            }}
          />
        </Suspense>
      )}
      <header className="header">
        {narrow && (
          <button
            ref={w.imageButton}
            className={`icon-button sidebar-toggle${w.dirty ? ' has-pending' : ''}`}
            aria-label={narrow ? 'Open tools' : w.prefs.sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={narrow ? w.mobileOpen : w.prefs.sidebarOpen}
            onClick={toggleSidebar}
          >
            <PanelLeft size={18} />
          </button>
        )}
        <div className="brand" title={`MicroBook ${version}`}>
          <BookOpen size={19} />
          <span className="brand-name">MicroBook</span>
        </div>
        <span className="book-title" title={w.prefs.spoilerFree ? undefined : w.metadata?.title}>
          {w.metadata?.title}
        </span>
        {w.kept && (
          <span className="kept-indicator" title={w.kept.savedLabel}>
            Kept version
          </span>
        )}
        <div className="header-actions">
          <PrintTips booklet={!!w.preview?.result?.booklet} />
          <button
            ref={foldingButton}
            className="icon-button"
            aria-label="Folding simulator"
            title="Folding simulator"
            onClick={() => setFoldingOpen(true)}
          >
            <Origami size={18} />
          </button>
          <button
            className="open-book-action"
            aria-label="Open book"
            title="Open book"
            onClick={() => w.input.current?.click()}
          >
            <Plus size={15} />
            <span>Open book</span>
          </button>
          {w.preview && (
            <>
              <button
                className="primary print-action"
                aria-label={w.dirty ? 'Apply & Print' : 'Print'}
                disabled={w.busy || w.active || w.output.preparing}
                onClick={() => void w.doOutput('print')}
              >
                {w.output.preparing ? <LoaderCircle size={15} className="spin" /> : <Printer size={15} />}
                <span>{w.dirty ? 'Apply & Print' : 'Print'}</span>
              </button>
              <IconButton
                label={w.dirty ? 'Apply & Download' : 'Download PDF'}
                disabled={w.busy || w.active}
                onClick={() => void w.doOutput('download')}
              >
                <Download size={17} />
              </IconButton>
            </>
          )}
          <IconButton
            label="History"
            onClick={() => {
              w.setTab('books');
              if (narrow) w.setMobileOpen(true);
            }}
          >
            <History size={18} />
          </IconButton>
          <button
            type="button"
            className="icon-button spoiler-toggle"
            aria-label="Spoiler-free mode"
            aria-pressed={w.prefs.spoilerFree}
            title={
              w.prefs.spoilerFree
                ? 'Turn off spoiler-free mode'
                : 'Turn on spoiler-free mode: blur book content'
            }
            onClick={() => w.prefs.patch({ spoilerFree: !w.prefs.spoilerFree })}
          >
            {w.prefs.spoilerFree ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </header>
      <div className="workspace-layout">
        <WorkspaceSidebar w={w} narrow={narrow} />
        <main className="workspace">
          {w.output.fallback ? (
            <div className="native-print-view">
              <button onClick={w.output.cancel}>Return to preview</button>
              <iframe title="Native PDF print controls" src={`/api/renders/${w.output.fallback.id}/pdf`} />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="preview-empty">
                  <LoaderCircle size={24} className="spin" role="status" aria-label="Opening preview" />
                </div>
              }
            >
              {Object.entries(w.previews).map(([, rendered]) => rendered?.result && mainPreview(rendered))}
              {w.kept?.result &&
                !Object.values(w.previews).some((p) => p?.id === w.kept?.id) &&
                mainPreview(w.kept)}
            </Suspense>
          )}
          {!w.preview && (
            <div className="preview-empty">
              {w.busy || w.active ? (
                <LoaderCircle size={24} className="spin" role="status" aria-label="Loading preview" />
              ) : (
                <div className="open-book-state">
                  <BookOpen size={32} aria-hidden="true" />
                  <button className="primary" onClick={() => w.input.current?.click()}>
                    Open a book
                  </button>
                  <span>EPUB · PDF · TXT · Markdown</span>
                  <small>or drop a file here</small>
                  {import.meta.env.VITE_HOSTED === '1' && (
                    <div className="hosted-welcome">
                      <strong>Hosted beta</strong>
                      <span>Books stay in this browser until you remove them.</span>
                      <small>Use books you’re allowed to process.</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {narrow && !w.mobileOpen && (w.busy || w.active) && (
            <div className="preview-activity">
              <RenderActivity
                job={w.active ? w.job : undefined}
                activity={w.active ? undefined : w.activity}
                onCancel={w.active ? () => void w.cancel() : undefined}
              />
            </div>
          )}
          {findOpen && w.preview && (
            <div className="find-bar" role="search" aria-label="Find in PDF">
              <input
                ref={findInput}
                type="search"
                aria-label="Find in PDF"
                placeholder="Find in book…"
                value={w.docPrefs?.search || ''}
                onChange={(e) => w.doc && w.prefs.document(w.doc.id, { search: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setFindCommand({ serial: Date.now(), previous: e.shiftKey });
                }}
              />
              <span aria-live="polite">{find.pending ? '…' : `${find.current} / ${find.total}`}</span>
              <IconButton
                label="Previous match"
                disabled={!find.total}
                onClick={() => setFindCommand({ serial: Date.now(), previous: true })}
              >
                <ChevronLeft size={15} />
              </IconButton>
              <IconButton
                label="Next match"
                disabled={!find.total}
                onClick={() => setFindCommand({ serial: Date.now(), previous: false })}
              >
                <ChevronRight size={15} />
              </IconButton>
              <IconButton label="Close find" onClick={() => setFindOpen(false)}>
                <X size={15} />
              </IconButton>
            </div>
          )}
          {w.preview?.result?.booklet && (
            <div className="booklet-preview-tabs segments" aria-label="Booklet preview mode">
              <button aria-pressed={bookletView === 'reading'} onClick={() => setBookletView('reading')}>
                Reading
              </button>
              <button aria-pressed={bookletView === 'print'} onClick={() => setBookletView('print')}>
                Print sheets
              </button>
            </div>
          )}
          {w.preview && (
            <footer className="statusbar">
              <div className="paper-counts">
                <span>
                  {w.preview?.result
                    ? `${w.preview.result.sheets} ${w.preview.result.sheets === 1 ? 'sheet' : 'sheets'} · ${w.preview.result.booklet ? `${w.preview.result.booklet.pageCount} pages · ${w.preview.result.booklet.signatures} ${w.preview.result.booklet.signatures === 1 ? 'signature' : 'signatures'}` : `${w.preview.result.pages} sides`}`
                    : ''}
                </span>
                {w.difference !== undefined && (
                  <span className="paper-comparison">
                    {w.difference === 0
                      ? 'Same sides'
                      : `${Math.abs(w.difference)} ${w.difference < 0 ? 'fewer' : 'more'} ${Math.abs(w.difference) === 1 ? 'side' : 'sides'}`}{' '}
                    than {modeLabels[w.mode === 'book' ? 'classic' : 'book']}
                  </span>
                )}
              </div>
              <div className="page-controls">
                <Navigation
                  unit={readingBooklet ? 'page' : 'side'}
                  spreads={readingBooklet}
                  value={page}
                  total={
                    readingBooklet
                      ? w.preview?.result?.booklet?.pageCount || 0
                      : w.preview?.result?.pages || 0
                  }
                  onChange={(value) =>
                    w.selectCell(
                      readingBooklet
                        ? Math.min(value - 1, w.preview!.result!.cells.length - 1)
                        : w.preview?.result?.cells.find((c) => c.page === value - 1)?.index || 0,
                    )
                  }
                />
                {w.preview && (
                  <span className="sheet-location">
                    {readingBooklet
                      ? `Page ${page} · ${w.preview.result?.booklet?.signatures} ${w.preview.result?.booklet?.signatures === 1 ? 'signature' : 'signatures'}`
                      : printedLocation(page - 1)}
                  </span>
                )}
              </div>
              <div className="zoom-control">
                <IconButton
                  label="Find in book"
                  disabled={!w.preview}
                  onClick={() => {
                    setFindOpen(!findOpen);
                    requestAnimationFrame(() => findInput.current?.select());
                  }}
                >
                  <Search size={15} />
                </IconButton>
                <IconButton
                  label="Zoom out"
                  disabled={!w.preview || w.actualZoom <= 0.25}
                  onClick={() =>
                    w.prefs.patch({ zoomMode: 'custom', zoom: Math.max(0.25, w.actualZoom - 0.25) })
                  }
                >
                  <Minus size={15} />
                </IconButton>
                <button
                  aria-label={w.prefs.zoomMode === 'fit' ? 'Actual size (100%)' : 'Fit to width'}
                  title={w.prefs.zoomMode === 'fit' ? 'Actual size (100%)' : 'Fit to width'}
                  disabled={!w.preview}
                  onClick={() =>
                    w.prefs.patch({ zoomMode: w.prefs.zoomMode === 'fit' ? 'custom' : 'fit', zoom: 1 })
                  }
                >
                  {Math.round(w.actualZoom * 100)}%
                </button>
                <IconButton
                  label="Zoom in"
                  disabled={!w.preview || w.actualZoom >= 5}
                  onClick={() =>
                    w.prefs.patch({ zoomMode: 'custom', zoom: Math.min(5, w.actualZoom + 0.25) })
                  }
                >
                  <Plus size={15} />
                </IconButton>
              </div>
            </footer>
          )}
        </main>
      </div>
      {w.dragging && <div className="drop-overlay">Open book or import settings</div>}
      {(narrow ? !w.mobileOpen : !w.prefs.sidebarOpen) && w.error && (
        <button className="activity-badge" onClick={toggleSidebar}>
          {w.error ? 'Action needed' : w.job?.phase || 'Processing'}
        </button>
      )}
    </div>
  );
}
