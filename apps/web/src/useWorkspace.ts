import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activeJob,
  newRichFeatures,
  sourceLocation,
  cellAtLocation,
  type SourceLocation,
  effectiveSettings,
  settingsSchema,
  type BookDocument,
  type Metadata,
  type Mode,
  type RenderJob,
  type RenderSettings,
  type LibraryDocument,
} from '@microbook/core';
import { usePreferences, type ReadingPosition, type SidebarTab } from './store';
import { useOutput, type OutputAction } from './useOutput';
import { api, post, type DocumentDetail } from './api';
import { imageLocations } from './imageLocations';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
export function useWorkspace() {
  const prefs = usePreferences();
  const input = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<BookDocument>();
  const documentRef = useRef(doc);
  documentRef.current = doc;
  const [mobileOpen, setMobileOpen] = useState(false);
  const imagesOpen = prefs.sidebarTab === 'images';
  const setImagesOpen = (open: boolean) => {
    if (open) {
      prefs.patch({ sidebarTab: 'images', sidebarOpen: true });
      if (matchMedia('(max-width:959px)').matches) setMobileOpen(true);
    }
  };
  const [kept, setKept] = useState<RenderJob>();
  const [keptCell, setKeptCell] = useState(0);
  const [jump, setJump] = useState<{ id: string; page: number; x: number; y: number; serial: number }>();
  const output = useOutput();
  const outputRef = useRef(output);
  outputRef.current = output;
  const imageButton = useRef<HTMLButtonElement>(null);
  const [previews, setPreviews] = useState<Partial<Record<Mode, RenderJob>>>({});
  const [job, setJob] = useState<RenderJob>();
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState('');
  const [error, setError] = useState('');
  const [applyError, setApplyError] = useState(false);
  const [library, setLibrary] = useState<LibraryDocument[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const libraryRequest = useRef<AbortController | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [actualZoom, setActualZoom] = useState(1);
  const generation = useRef(0);
  const exportNext = useRef<{ id: string; action: OutputAction } | undefined>(undefined);
  const location = useRef<SourceLocation>({ cell: 0 });
  const currentJob = useRef<string | undefined>(undefined);
  const docPrefs = doc ? prefs.documents[doc.id] : undefined;
  const mode = kept?.settings.mode || docPrefs?.mode || 'book';
  const currentPreview = previews[mode];
  const preview = kept || currentPreview;
  const draft = docPrefs?.drafts[mode] || prefs.settings[mode];
  const metadata = kept?.metadata || docPrefs?.metadata || doc?.metadata;
  const cell = Math.min(
    kept ? keptCell : (docPrefs?.cells?.[mode] ?? docPrefs?.cell ?? 0),
    (preview?.result?.cells.length || 1) - 1,
  );
  const dirty =
    !!doc &&
    !kept &&
    (!preview ||
      !equal(effectiveSettings(draft), effectiveSettings(preview.settings)) ||
      !equal(metadata, preview.metadata));
  const availableFingerprint = (doc as DocumentDetail | undefined)?.rendererFingerprint;
  const updateAvailable =
    !!preview && !kept && !!availableFingerprint && !equal(preview.result?.fingerprint, availableFingerprint);
  const active = activeJob(job);
  const other = preview && doc?.renderStats?.[preview.settings.mode === 'book' ? 'classic' : 'book'];
  const difference = other && preview?.result ? preview.result.pages - other.pages : undefined;
  const imageEntries = useMemo(
    () => (doc ? imageLocations(doc, preview?.result, kept?.settings || draft) : []),
    [doc, preview, draft, kept],
  );
  const selectImage = (id: string) => {
    if (doc) prefs.document(doc.id, { selectedImageId: id });
  };
  const jumpImage = (id: string) => {
    if (!doc) return;
    const entry = imageLocations(doc, preview?.result, draft, true).find((i) => i.block.id === id);
    const target = entry?.cell || entry?.context;
    if (target) goTo(target.index, entry?.region);
    prefs.document(doc.id, {
      selectedImageId: id,
      ...(!kept ? { sourceBlock: id } : {}),
    });
  };
  const openImages = (id?: string) => {
    if (!doc) return;
    if (id) selectImage(id);
    else if (
      !imageLocations(doc, preview?.result, draft, true).some((i) => i.block.id === docPrefs?.selectedImageId)
    ) {
      const initial =
        imageEntries.find((i) => i.cell?.page === preview?.result?.cells[cell]?.page) ||
        imageEntries[0] ||
        imageLocations(doc, preview?.result, draft, true)[0];
      if (initial) prefs.document(doc.id, { selectedImageId: initial.block.id });
    }
    setImagesOpen(true);
  };
  function goTo(index: number, region?: { page: number; x: number; y: number }) {
    const target = preview?.result?.cells[index];
    if (!target || !preview) return;
    if (kept) setKeptCell(index);
    else if (doc)
      prefs.document(doc.id, {
        cell: index,
        cells: { ...docPrefs?.cells, [mode]: index },
        sourceBlock: target.blockIds[0],
        reading: {
          ...docPrefs?.reading,
          [mode]: {
            page: (region?.page ?? target.page) + 1,
            left: region?.x ?? target.x,
            top: 792 - (region?.y ?? target.y),
          },
        },
      });
    setJump({
      id: preview.id,
      page: (region?.page ?? target.page) + 1,
      x: region?.x ?? target.x,
      y: region?.y ?? target.y,
      serial: Date.now(),
    });
    setMobileOpen(false);
  }
  const selectCell = (index: number) => goTo(index);
  const onReading = (id: string, position: ReadingPosition) => {
    if (preview?.id !== id || !doc) return;
    const cell =
      preview.result?.cells.find(
        (c) =>
          c.page === position.page - 1 &&
          position.left >= c.x &&
          position.left < c.x + c.width &&
          792 - position.top >= c.y &&
          792 - position.top < c.y + c.height,
      ) || preview.result?.cells.find((c) => c.page === position.page - 1);
    if (kept) {
      if (cell) setKeptCell(cell.index);
      return;
    }
    prefs.document(doc.id, {
      reading: { ...docPrefs?.reading, [mode]: position },
      ...(cell ? { cells: { ...docPrefs?.cells, [mode]: cell.index }, cell: cell.index } : {}),
    });
  };
  const accept = useCallback(async (next: RenderJob, sequence: number) => {
    if (generation.current !== sequence || currentJob.current !== next.id || !next.result) return;
    const state = usePreferences.getState();
    const stored = state.documents[next.documentId];
    const nextMode = next.settings.mode;
    const previousId = stored?.previewIds?.[nextMode];
    const selected =
      documentRef.current?.id === next.documentId && stored?.selectedImageId === location.current.block
        ? imageLocations(documentRef.current, next.result, next.settings, true).find(
            (i) => i.block.id === stored.selectedImageId,
          )
        : undefined;
    const target =
      (selected?.cell || selected?.context)?.index ?? cellAtLocation(next.result.cells, location.current);
    const targetCell = next.result.cells[target];
    state.document(next.documentId, {
      reading: {
        ...stored?.reading,
        [nextMode]: targetCell
          ? {
              page: targetCell.page + 1,
              left: selected?.region?.x ?? targetCell.x,
              top: 792 - (selected?.region?.y ?? targetCell.y),
            }
          : undefined,
      },
      previewIds: { ...stored?.previewIds, [nextMode]: next.id },
      cells: { ...stored?.cells, [nextMode]: target },
      pendingId: undefined,
      ...(stored?.mode === nextMode ? { previewId: next.id, cell: target } : {}),
    });
    setPreviews((previews) => ({ ...previews, [nextMode]: next }));
    if (targetCell)
      setJump({
        id: next.id,
        page: targetCell.page + 1,
        x: selected?.region?.x ?? targetCell.x,
        y: selected?.region?.y ?? targetCell.y,
        serial: Date.now(),
      });
    setJob(undefined);
    currentJob.current = undefined;
    setError('');
    setDoc((document) =>
      document?.id === next.documentId
        ? {
            ...document,
            lastRenderId: next.id,
            lastRenderIds: { ...document.lastRenderIds, [nextMode]: next.id },
            renderStats: {
              ...document.renderStats,
              [next.settings.mode]: {
                settings: next.settings,
                metadata: next.metadata,
                pages: next.result!.pages,
                sheets: next.result!.sheets,
                cells: next.result!.cells.length,
              },
            },
          }
        : document,
    );
    if (previousId && previousId !== next.id) void post(`/api/renders/${previousId}/release`).catch(() => {});
    if (exportNext.current?.id === next.id && stored?.mode === nextMode) {
      const action = exportNext.current.action;
      exportNext.current = undefined;
      try {
        await outputRef.current.perform(next, action);
      } catch (error) {
        setError(message(error));
      }
    }
  }, []);
  const apply = useCallback(
    async (document: BookDocument, settings: RenderSettings, meta: Metadata, shouldExport?: OutputAction) => {
      outputRef.current.cancel();
      const sequence = ++generation.current;
      setError('');
      setApplyError(false);
      setBusy(true);
      setActivity('Submitting render');
      exportNext.current = undefined;
      location.current =
        previews[settings.mode]?.documentId === document.id
          ? sourceLocation(
              previews[settings.mode]?.result?.cells[
                usePreferences.getState().documents[document.id]?.cells?.[settings.mode] ?? cell
              ],
              settings.mode === mode
                ? usePreferences.getState().documents[document.id]?.sourceBlock
                : undefined,
            )
          : sourceLocation(preview?.documentId === document.id ? preview.result?.cells[cell] : undefined);
      try {
        if (!equal(meta, document.metadata)) {
          const updated = await api<BookDocument>(`/api/documents/${document.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ metadata: meta }),
          });
          if (generation.current !== sequence) return;
          setDoc(updated);
        }
        const next = await post<RenderJob>(`/api/documents/${document.id}/renders`, {
          settings: structuredClone(settings),
        });
        if (generation.current !== sequence) return;
        currentJob.current = next.id;
        if (shouldExport) exportNext.current = { id: next.id, action: shouldExport };
        usePreferences.getState().document(document.id, { pendingId: next.id });
        setJob(next);
        if (next.status === 'completed') await accept(next, sequence);
      } catch (error) {
        if (generation.current === sequence) {
          setError(message(error));
          setApplyError(true);
        }
      } finally {
        if (generation.current === sequence) {
          setBusy(false);
          setActivity('');
        }
      }
    },
    [accept, previews, preview, cell, mode, imagesOpen],
  );
  async function openDocument(id: string, savedId?: string, preferredMode?: Mode) {
    output.cancel();
    setKept(undefined);
    setMobileOpen(false);
    const sequence = ++generation.current;
    currentJob.current = undefined;
    exportNext.current = undefined;
    setBusy(true);
    setActivity('Opening book');
    setError('');
    setJob(undefined);
    setPreviews({});
    try {
      const document = await api<DocumentDetail>(`/api/documents/${id}`);
      if (generation.current !== sequence) return;
      setDoc(document);
      const state = usePreferences.getState();
      const stored = state.documents[id];
      const keptId = savedId;
      const saved = document.renders.find((r) => r.id === keptId && r.status === 'completed');
      setKept(saved);
      setKeptCell(0);
      const available: Partial<Record<Mode, RenderJob>> = {};
      for (const target of ['classic', 'book'] as const) {
        const completed = document.renders
          .filter((r) => r.settings.mode === target && r.status === 'completed' && r.result)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        available[target] =
          completed.find((r) => r.id === stored?.previewIds?.[target]) ||
          completed.find((r) => r.id === stored?.previewId) ||
          completed.find((r) => r.id === document.lastRenderIds?.[target]) ||
          completed[0];
      }
      const mode =
        preferredMode ||
        stored?.mode ||
        state.explicitMode ||
        (document.format === 'epub' ? 'book' : 'classic');
      const completed = available[mode];
      const drafts = { ...stored?.drafts };
      for (const target of ['classic', 'book'] as const)
        drafts[target] = settingsSchema.parse(
          drafts[target] || available[target]?.settings || state.settings[target],
        );
      state.document(id, {
        mode,
        drafts,
        metadata: stored?.metadata || document.metadata,
        openedAt: Date.now(),
        keptId: saved?.id,
        previewId: completed?.id,
        previewIds: { classic: available.classic?.id, book: available.book?.id },
        cells: { ...stored?.cells, [mode]: stored?.cells?.[mode] ?? stored?.cell ?? 0 },
      });
      state.patch({ lastDocumentId: id });
      setPreviews(available);
      const pending = !savedId && document.renders.find((r) => r.id === stored?.pendingId);
      if (pending) {
        currentJob.current = pending.id;
        setJob(pending);
        location.current = sourceLocation(
          available[pending.settings.mode]?.result?.cells[
            stored?.cells?.[pending.settings.mode] ?? stored?.cell ?? 0
          ],
          pending.settings.mode === mode ? stored?.sourceBlock : undefined,
        );
        if (pending.status === 'completed') await accept(pending, sequence);
      } else if (!completed && !saved) {
        setBusy(false);
        await apply(
          document,
          usePreferences.getState().documents[id].drafts[mode] || state.settings[mode],
          document.metadata,
        );
      }
    } catch (error) {
      if (generation.current === sequence) setError(message(error));
    } finally {
      if (generation.current === sequence) {
        setBusy(false);
        setActivity('');
      }
    }
  }
  useEffect(() => {
    const id = usePreferences.getState().lastDocumentId;
    if (id) void openDocument(id, usePreferences.getState().documents[id]?.keptId);
  }, []);
  useEffect(() => {
    if (!job || !activeJob(job)) return;
    const sequence = generation.current;
    const id = job.id;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api<RenderJob>(`/api/renders/${id}`);
        if (stopped || generation.current !== sequence || currentJob.current !== id) return;
        setJob(next);
        if (next.status === 'completed') {
          await accept(next, sequence);
          return;
        }
        if (!activeJob(next)) {
          exportNext.current = undefined;
          usePreferences.getState().document(next.documentId, { pendingId: next.id });
          return;
        }
        setError('');
      } catch (error) {
        if (!stopped) setError(message(error));
      }
      if (!stopped) timer = setTimeout(poll, 650);
    };
    timer = setTimeout(poll, 350);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job?.id, job?.status, accept]);
  useEffect(() => {
    const renew = () =>
      [...Object.values(previews), kept, output.fallback].forEach((preview) => {
        if (preview) void post(`/api/renders/${preview.id}/lease`).catch(() => {});
      });
    renew();
    const interval = setInterval(renew, 120_000);
    return () => clearInterval(interval);
  }, [previews, kept, output.fallback]);
  async function importFile(file?: File) {
    if (!file) return;
    output.cancel();
    setKept(undefined);
    exportNext.current = undefined;
    const sequence = ++generation.current;
    currentJob.current = undefined;
    setBusy(true);
    setActivity('Importing book');
    setError('');
    setJob(undefined);
    try {
      const data = new FormData();
      data.append('file', file);
      const document = await api<BookDocument>('/api/documents', {
        method: 'POST',
        body: data,
      });
      if (generation.current !== sequence) return;
      setDoc(document);
      setPreviews({});
      const state = usePreferences.getState();
      const mode = state.explicitMode || (document.format === 'epub' ? 'book' : 'classic');
      const bookSettings = {
        ...state.settings.book,
        rich: newRichFeatures(),
        imageOutput: { mode: 'laser' as const, strength: 'gentle' as const },
        imageOutputOverrides: {},
      };
      const initialSettings = mode === 'book' ? bookSettings : state.settings[mode];
      state.document(document.id, {
        mode,
        drafts: { book: bookSettings, [mode]: initialSettings },
        metadata: document.metadata,
        cell: 0,
      });
      state.patch({ lastDocumentId: document.id, sidebarTab: 'layout' });
      setMobileOpen(false);
      await apply(document, initialSettings, document.metadata);
    } catch (error) {
      if (generation.current === sequence) setError(message(error));
    } finally {
      if (generation.current === sequence) {
        setBusy(false);
        setActivity('');
      }
      if (input.current) input.current.value = '';
    }
  }
  const edit = (value: Partial<RenderSettings>) => {
    const next = settingsSchema.safeParse({ ...draft, ...value });
    if (doc && next.success) prefs.edit(doc.id, next.data);
  };
  const switchMode = (mode: Mode) => {
    if (
      !doc ||
      (mode === docPrefs?.mode && !kept) ||
      busy ||
      (active && !previews[mode] && job?.settings.mode !== mode)
    )
      return;
    setKept(undefined);
    output.cancel();
    exportNext.current = undefined;
    const cached = previews[mode];
    prefs.patch({ explicitMode: mode });
    prefs.document(doc.id, {
      mode,
      keptId: undefined,
      previewId: cached?.id,
      cell: docPrefs?.cells?.[mode] || 0,
      sourceBlock: undefined,
    });
    // Draft edits stay unapplied. Generate only when this mode has no preview yet.
    if (!cached && !active && metadata)
      void apply(doc, docPrefs?.drafts[mode] || prefs.settings[mode], metadata);
  };
  async function cancel() {
    if (!job) return;
    ++generation.current;
    output.cancel();
    currentJob.current = undefined;
    exportNext.current = undefined;
    try {
      const next = await post<RenderJob>(`/api/renders/${job.id}/cancel`);
      setJob(next);
      prefs.document(job.documentId, { pendingId: undefined });
    } catch (error) {
      setError(message(error));
    }
  }
  async function showLibrary() {
    libraryRequest.current?.abort();
    const controller = new AbortController();
    libraryRequest.current = controller;
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const items = await api<LibraryDocument[]>('/api/documents', { signal: controller.signal });
      if (!controller.signal.aborted) setLibrary(items);
    } catch (error) {
      if (!controller.signal.aborted) setLibraryError(message(error));
    } finally {
      if (!controller.signal.aborted) setLibraryLoading(false);
    }
  }
  async function removeDocument(id: string) {
    try {
      await api(`/api/documents/${id}`, { method: 'DELETE' });
      setLibrary((items) => items.filter((d) => d.id !== id));
      if (doc?.id === id) {
        ++generation.current;
        currentJob.current = undefined;
        exportNext.current = undefined;
        output.cancel();
        setKept(undefined);
        setDoc(undefined);
        setPreviews({});
        setJob(undefined);
        prefs.patch({ lastDocumentId: undefined });
      }
    } catch (error) {
      setError(message(error));
    }
  }
  const doOutput = async (action: OutputAction) => {
    if (!doc || !metadata || !preview) return;
    if (dirty) await apply(doc, draft, metadata, action);
    else
      try {
        await output.perform(preview, action);
      } catch (e) {
        setError(message(e));
      }
  };
  const returnCurrent = () => {
    output.cancel();
    setKept(undefined);
    if (doc) prefs.document(doc.id, { keptId: undefined });
  };
  const useKeptSettings = () => {
    if (!doc || !kept) return;
    const snapshot = kept;
    returnCurrent();
    prefs.edit(doc.id, settingsSchema.parse(snapshot.settings));
    prefs.document(doc.id, { metadata: snapshot.metadata, mode: snapshot.settings.mode });
    prefs.patch({ sidebarTab: 'layout' });
  };
  const revert = () => {
    if (!doc || !currentPreview) return;
    prefs.edit(doc.id, settingsSchema.parse(currentPreview.settings));
    prefs.document(doc.id, { metadata: currentPreview.metadata });
    setError('');
    setJob(undefined);
    prefs.document(doc.id, { pendingId: undefined });
  };
  const updateVersion = async (id: string, change: { saved?: boolean; label?: string }) => {
    try {
      const updated = await api<RenderJob>(`/api/renders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(change),
      });
      setPreviews((p) =>
        Object.fromEntries(Object.entries(p).map(([m, r]) => [m, r?.id === id ? updated : r])),
      );
      setKept((k) => (k?.id === id ? updated : k));
      await showLibrary();
    } catch (e) {
      setError(message(e));
    }
  };
  const setTab = (tab: SidebarTab) => {
    prefs.patch({ sidebarTab: tab, sidebarOpen: true });
    if (tab === 'images') openImages();
  };
  useEffect(() => {
    if (!usePreferences.getState().lastDocumentId) {
      prefs.patch({ sidebarTab: 'books' });
    }
  }, []);
  return {
    prefs,
    input,
    doc,
    docPrefs,
    mode,
    preview,
    previews,
    kept,
    cell,
    draft,
    metadata,
    dirty,
    updateAvailable,
    busy,
    active,
    activity,
    job,
    error,
    setError,
    applyError,
    imageEntries,
    jump,
    goTo,
    onReading,
    selectCell,
    openImages,
    selectImage,
    jumpImage,
    mobileOpen,
    setMobileOpen,
    imageButton,
    setTab,
    actualZoom,
    setActualZoom,
    dragging,
    setDragging,
    importFile,
    apply,
    cancel,
    edit,
    switchMode,
    revert,
    library,
    libraryLoading,
    libraryError,
    showLibrary,
    removeDocument,
    openDocument,
    doOutput,
    returnCurrent,
    useKeptSettings,
    updateVersion,
    output,
    difference,
  };
}
