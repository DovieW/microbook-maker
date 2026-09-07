import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { LayoutControls, type Workspace } from './LayoutControls';
import { ImagesPane } from './ImagesPane';
import { ContentsPane } from './ContentsPane';
import { BooksPane } from './BooksPane';
import { RenderActivity } from './RenderActivity';
import type { SidebarTab } from './store';
export function WorkspaceSidebar({ w, narrow }: { w: Workspace; narrow: boolean }) {
  const tabs: [SidebarTab, string][] = [
    ...(w.doc ? [['layout', 'Layout'] as [SidebarTab, string]] : []),
    ...(w.doc && w.mode === 'book' && w.doc.sections.length > 1
      ? [['contents', 'Contents'] as [SidebarTab, string]]
      : []),
    ...(w.doc && w.mode === 'book' && w.doc.blocks.some((b) => b.kind === 'image')
      ? [['images', 'Images'] as [SidebarTab, string]]
      : []),
  ];
  const tab =
    w.prefs.sidebarTab === 'books'
      ? 'books'
      : tabs.some((t) => t[0] === w.prefs.sidebarTab)
        ? w.prefs.sidebarTab
        : w.doc
          ? 'layout'
          : 'books';
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (tab === 'books') void w.showLibrary();
  }, [tab, w.doc?.id, w.doc?.lastRenderId]);
  const contents = (
    <>
      {tab === 'books' ? (
        <div className="history-heading">
          <strong>History</strong>
          {w.doc && <button onClick={() => w.setTab('layout')}>Back to layout</button>}
        </div>
      ) : (
        <div className="sidebar-tabs" role="tablist" aria-label="Workspace tools">
          {tabs.map(([id, label], index) => (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`pane-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => w.setTab(id)}
              onKeyDown={(e) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const next =
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? tabs.length - 1
                      : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                w.setTab(tabs[next][0]);
                tabRefs.current[next]?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        className="sidebar-body"
        role="tabpanel"
        id={`pane-${tab}`}
        aria-label={tab === 'books' ? 'History' : tabs.find((t) => t[0] === tab)?.[1]}
        key={`${w.doc?.id}-${tab}`}
      >
        {tab === 'layout' && <LayoutControls w={w} />} {tab === 'contents' && <ContentsPane w={w} />}{' '}
        {tab === 'images' && <ImagesPane w={w} />} {tab === 'books' && <BooksPane w={w} />}
      </div>
      {(w.doc || w.error) && (
        <div className="sidebar-action">
          {w.kept ? (
            <>
              <span className="muted">Kept version</span>
              <button onClick={w.returnCurrent}>Return to current</button>
              <button className="primary" onClick={w.useKeptSettings}>
                Use these settings
              </button>
            </>
          ) : (
            <>
              {w.busy || w.active ? (
                <RenderActivity
                  job={w.active ? w.job : undefined}
                  activity={w.active ? undefined : w.activity}
                  onCancel={w.active ? () => void w.cancel() : undefined}
                />
              ) : (
                <>
                  {(w.error || w.job?.error) && <p role="alert">{w.error || w.job?.error}</p>}
                  {w.dirty ||
                  w.job?.status === 'failed' ||
                  w.job?.status === 'cancelled' ||
                  w.job?.status === 'interrupted' ? (
                    <div className="apply-actions">
                      <button disabled={!w.preview} onClick={w.revert}>
                        Revert changes
                      </button>
                      <button
                        className="primary"
                        disabled={!w.doc || !w.metadata}
                        onClick={() => w.doc && w.metadata && void w.apply(w.doc, w.draft, w.metadata)}
                      >
                        {w.error ||
                        w.job?.error ||
                        ['failed', 'cancelled', 'interrupted'].includes(w.job?.status || '')
                          ? 'Retry'
                          : 'Apply'}
                      </button>
                    </div>
                  ) : (
                    <button className="primary idle-apply" disabled>
                      Apply
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
  const panel = (
    <aside
      className="workspace-sidebar"
      style={{ width: w.prefs.sidebarWidth }}
      aria-label="Workspace sidebar"
    >
      {contents}
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuenow={w.prefs.sidebarWidth}
        aria-valuemin={280}
        aria-valuemax={440}
        tabIndex={0}
        onDoubleClick={() => w.prefs.patch({ sidebarWidth: 280 })}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) {
            e.preventDefault();
            w.prefs.patch({
              sidebarWidth:
                e.key === 'Home'
                  ? 280
                  : Math.max(280, Math.min(440, w.prefs.sidebarWidth + (e.key === 'ArrowRight' ? 10 : -10))),
            });
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            w.prefs.patch({ sidebarWidth: Math.max(280, Math.min(440, e.clientX)) });
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      />
    </aside>
  );
  if (!narrow) return panel;
  return (
    <Dialog.Root open={w.mobileOpen} onOpenChange={w.setMobileOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className="tools-drawer redesign"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            w.imageButton.current?.focus();
          }}
        >
          <div className="drawer-header">
            <Dialog.Title>MicroBook</Dialog.Title>
            <Dialog.Close aria-label="Close tools">
              <X size={18} />
            </Dialog.Close>
          </div>
          {contents}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
