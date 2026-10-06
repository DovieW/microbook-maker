import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Undo2,
  Redo2,
  Download,
  Upload,
  Video,
  Plus,
  Bookmark,
  RotateCcw,
  RotateCw,
  Camera,
  Move,
  Layers,
  LoaderCircle,
  FlipHorizontal2,
  SlidersHorizontal,
  ListOrdered,
  MoreHorizontal,
  X,
  Repeat2,
} from 'lucide-react';
import { IconButton } from '../ui';
import {
  applyFold,
  blankRecording,
  bounds,
  choices,
  creases,
  exampleRecording,
  exposed,
  INITIAL_VIEW,
  parseRecording,
  replay,
  type Axis,
  type Fold,
  type Recording,
} from './model';
import { PaperScene, type PaperInteraction } from './scene';
import { pickFlap, type PickedFold } from './interaction';
import {
  downloadBlob,
  filename,
  loadRecordings,
  saveDraft,
  saveMethods,
  type SavedMethod,
} from './recordings';
import { animate, recordVideo, videoMimeType } from './video';
import './folding.css';

type Snapshot = { recording: Recording; cursor: number };
export function FoldingSimulator({ onClose }: { onClose: () => void }) {
  const [loaded] = useState(loadRecordings);
  const [recording, setRecording] = useState(loaded.draft);
  const [cursor, setCursor] = useState(loaded.draft.steps.length);
  const [methods, setMethods] = useState<SavedMethod[]>(loaded.methods);
  const [methodId, setMethodId] = useState('');
  const [error, setError] = useState(loaded.error);
  const [message, setMessage] = useState('');
  const [graphicsError, setGraphicsError] = useState('');
  const [busy, setBusy] = useState<'play' | 'fold' | 'video' | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [crease, setCrease] = useState('');
  const [packet, setPacket] = useState(-1);
  const [panel, setPanel] = useState<'steps' | 'advanced' | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [spreadLayers, setSpreadLayers] = useState(false);
  const [methodsOpen, setMethodsOpen] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [angle, setAngle] = useState(0);
  const [note, setNote] = useState('');
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [redo, setRedo] = useState<Snapshot[]>([]);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const scene = useRef<PaperScene | null>(null),
    file = useRef<HTMLInputElement>(null),
    back = useRef<HTMLButtonElement>(null);
  const abort = useRef<AbortController | null>(null);
  const interactionRef = useRef<PaperInteraction>(null!);
  const skipFirstSave = useRef(true);
  const paper = useMemo(() => replay(recording, cursor), [recording, cursor]);
  const axes = useMemo(() => creases(paper), [paper]);
  const [axis, lineText] = crease.split(':');
  const line = Number(lineText);
  const packets = useMemo(() => (axis ? choices(paper, axis as Axis, line) : []), [paper, axis, line]);
  const choice = packets[packet];
  const actualDirection = choice?.directions.includes(direction) ? direction : choice?.directions[0] || 1;
  const fold: Fold | undefined = choice
    ? { axis: axis as Axis, line, moving: choice.moving, hinges: choice.hinges, direction: actualDirection }
    : undefined;
  const shape = bounds(paper);
  const selectedStep = recording.steps[cursor - 1];
  const canVideo = videoMimeType();
  const clearSelection = () => {
    setCrease('');
    setAngle(0);
    setPacket(-1);
    setNote('');
  };
  const chooseCrease = (key: string) => {
    if (busy) return;
    setCrease(key);
    setPacket(-1);
    setAngle(0);
    const [a, l] = key.split(':');
    if (a) {
      const options = choices(paper, a as Axis, Number(l));
      // At a folded edge both flaps occupy the same side. Lift the exposed one immediately.
      if (options.length && options.every((c) => c.side === options[0].side)) {
        const facing = scene.current?.facing() || 1;
        const ids = facing === 1 ? [...paper.order].reverse() : paper.order;
        const id = ids.find((id) => options.some((c) => c.moving.includes(id)));
        const picked = id === undefined ? undefined : pickFlap(paper, a as Axis, Number(l), id, facing);
        if (picked) {
          setPacket(options.findIndex((c) => c.moving.join(',') === picked.fold.moving.join(',')));
          setDirection(picked.fold.direction);
        }
      }
    }
  };
  function pickPanel(id: number, commit: boolean): PickedFold | undefined {
    if (!axis || busy) return;
    if (fold?.moving.includes(id)) return { fold, directions: choice!.directions };
    const picked = pickFlap(paper, axis as Axis, line, id, scene.current?.facing() || 1);
    if (picked && commit) {
      setPacket(packets.findIndex((c) => c.moving.join(',') === picked.fold.moving.join(',')));
      setDirection(picked.fold.direction);
      setAngle(0);
    }
    return picked;
  }
  function sidePick(side: number): PickedFold | undefined {
    const facing = scene.current?.facing() || 1,
      ids = facing === 1 ? [...paper.order].reverse() : paper.order;
    const id = ids.find(
      (id) =>
        Math.sign(paper.panels[id][axis as Axis] - line) === side &&
        packets.some((c) => c.moving.includes(id)),
    );
    return id === undefined ? undefined : pickFlap(paper, axis as Axis, line, id, facing);
  }
  function selectSide(side: number) {
    const picked = sidePick(side);
    if (picked) {
      setPacket(packets.findIndex((c) => c.moving.join(',') === picked.fold.moving.join(',')));
      setDirection(picked.fold.direction);
      setAngle(0);
    }
  }
  interactionRef.current = {
    selectCrease: (a, l) => chooseCrease(`${a}:${l}`),
    pickPanel,
    preview: (angle, direction) => {
      setAngle(angle);
      setDirection(direction);
    },
  };
  const unfolded = fold
    ? (() => {
        const b = bounds(applyFold(paper, fold));
        return (
          (b.right - b.left) * (b.top - b.bottom) > (shape.right - shape.left) * (shape.top - shape.bottom)
        );
      })()
    : false;
  const otherLayers = choice
    ? packets.map((c, i) => ({ c, i })).filter(({ c }) => c.side === choice.side)
    : [];
  useEffect(() => {
    if (!canvasElement) return;
    let view: PaperScene;
    try {
      view = new PaperScene(canvasElement, undefined, setGraphicsError);
      scene.current = view;
      view.setInteraction({
        selectCrease: (a, l) => interactionRef.current.selectCrease(a, l),
        pickPanel: (id, c) => interactionRef.current.pickPanel(id, c),
        preview: (a, d) => interactionRef.current.preview(a, d),
      });
      view.setView(recording.steps[cursor - 1]?.view || INITIAL_VIEW);
      view.setPaper(paper, fold, angle / 180);
    } catch {
      setGraphicsError(
        '3D graphics could not start. Enable WebGL in your browser, then close and reopen the simulator. Your recordings are still available.',
      );
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      view.resize(width, height);
    });
    observer.observe(canvasElement);
    return () => {
      abort.current?.abort();
      observer.disconnect();
      view.dispose();
      scene.current = null;
    };
  }, [canvasElement]);
  useEffect(() => {
    scene.current?.setPanMode(panMode);
  }, [panMode, canvasElement]);
  useEffect(() => {
    scene.current?.setSpreadLayers(spreadLayers);
  }, [spreadLayers, canvasElement]);
  useEffect(() => {
    scene.current?.setInteraction(
      {
        selectCrease: (a, l) => interactionRef.current.selectCrease(a, l),
        pickPanel: (id, c) => interactionRef.current.pickPanel(id, c),
        preview: (a, d) => interactionRef.current.preview(a, d),
      },
      axis ? { axis: axis as Axis, line } : undefined,
    );
    scene.current?.setInteractive(!busy && !graphicsError);
    if (!busy) scene.current?.setPaper(paper, fold, angle / 180);
  }, [paper, crease, packet, actualDirection, angle, busy, graphicsError]);
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        saveDraft(recording);
      } catch {
        setError('Your browser could not save this draft. Export the recording to keep it.');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [recording]);
  const latest = useRef(recording);
  latest.current = recording;
  const changed = useRef(false);
  useEffect(() => {
    const flush = () => {
      if (changed.current)
        try {
          saveDraft(latest.current);
        } catch {
          /* already surfaced during autosave */
        }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, []);
  function change(next: Recording, nextCursor = cursor) {
    setUndo((prev) => [...prev.slice(-49), { recording, cursor }]);
    setRedo([]);
    setRecording(next);
    setCursor(nextCursor);
    changed.current = true;
    setMessage('');
  }
  function seek(index: number) {
    if (busy) return;
    setCursor(index);
    clearSelection();
    scene.current?.setView(index ? recording.steps[index - 1].view : INITIAL_VIEW);
  }
  function undoEdit() {
    const previous = undo.at(-1);
    if (!previous) return;
    setRedo((prev) => [...prev, { recording, cursor }]);
    setUndo((prev) => prev.slice(0, -1));
    setRecording(previous.recording);
    setCursor(previous.cursor);
    scene.current?.setView(previous.recording.steps[previous.cursor - 1]?.view || INITIAL_VIEW);
    changed.current = true;
    clearSelection();
  }
  function redoEdit() {
    const next = redo.at(-1);
    if (!next) return;
    setUndo((prev) => [...prev, { recording, cursor }]);
    setRedo((prev) => prev.slice(0, -1));
    setRecording(next.recording);
    setCursor(next.cursor);
    scene.current?.setView(next.recording.steps[next.cursor - 1]?.view || INITIAL_VIEW);
    changed.current = true;
    clearSelection();
  }
  function open(next: Recording, id = '') {
    abort.current?.abort();
    change(next, next.steps.length);
    setMethodId(id);
    setMethodsOpen(false);
    clearSelection();
    scene.current?.setView(next.steps.at(-1)?.view || INITIAL_VIEW);
    setError('');
  }
  function addView() {
    if (!scene.current) return;
    const step = { view: scene.current.getView(), note: note || 'View the paper from this angle.' };
    change({ ...recording, steps: [...recording.steps.slice(0, cursor), step] }, cursor + 1);
    clearSelection();
  }
  function rotatePaper(direction: 1 | -1) {
    if (!scene.current || busy || cursor >= 500) return;
    scene.current.rotate(direction);
    const step = {
      view: scene.current.getView(),
      note: `Rotate paper ${direction === 1 ? 'left' : 'right'} 90°.`,
    };
    change({ ...recording, steps: [...recording.steps.slice(0, cursor), step] }, cursor + 1);
  }
  async function confirmFold() {
    if (!fold || !scene.current) return;
    if (matchMedia('(max-width:620px)').matches) setPanel(null);
    const selected = fold;
    const view = scene.current.getView();
    const control = new AbortController();
    abort.current = control;
    setBusy('fold');
    setError('');
    try {
      const start = angle / 180;
      await animate(
        matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650 * (1 - start),
        (p) => scene.current?.setPaper(paper, selected, start + (1 - start) * p),
        control.signal,
      );
      change(
        { ...recording, steps: [...recording.steps.slice(0, cursor), { fold: selected, view, note }] },
        cursor + 1,
      );
      clearSelection();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(null);
      abort.current = null;
    }
  }
  async function play() {
    if (!scene.current || !recording.steps.length) return;
    clearSelection();
    if (matchMedia('(max-width:620px)').matches) setPanel(null);
    const control = new AbortController();
    abort.current = control;
    setBusy('play');
    scene.current.setInteractive(false);
    const start = cursor >= recording.steps.length ? 0 : cursor;
    let state = replay(recording, start);
    setCursor(start);
    try {
      for (let i = start; i < recording.steps.length; i++) {
        const step = recording.steps[i];
        scene.current?.setView(step.view);
        if (step.fold) {
          await animate(
            matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1100,
            (p) => scene.current?.setPaper(state, step.fold, p, false),
            control.signal,
          );
          state = applyFold(state, step.fold);
        }
        scene.current?.setPaper(state, undefined, 0, false);
        setCursor(i + 1);
        await animate(Math.min(4000, Math.max(1300, step.note.length * 28)), () => {}, control.signal);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(null);
      abort.current = null;
      scene.current?.setInteractive(true);
    }
  }
  async function exportVideo() {
    const control = new AbortController();
    abort.current = control;
    setBusy('video');
    setMethodsOpen(false);
    setError('');
    setVideoProgress(0);
    try {
      const { blob, extension } = await recordVideo(recording, control.signal, (p) =>
        setVideoProgress(Math.round(p * 100)),
      );
      downloadBlob(blob, `${filename(recording.title)}.${extension}`);
      setMessage('Video exported.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(null);
      abort.current = null;
    }
  }
  async function importFile(selected?: File) {
    if (!selected || busy) return;
    try {
      if (selected.size > 2_000_000) throw Error('This recording is too large.');
      const parsed = parseRecording(await selected.text());
      open(parsed);
      setMessage('Recording imported. Previous draft is available with Undo.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveMethod() {
    const id = methodId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = [...methods.filter((m) => m.id !== id), { id, recording: structuredClone(recording) }];
    try {
      saveMethods(next);
      setMethods(next);
      setMethodId(id);
      setMessage('Method saved in this browser.');
      setMethodsOpen(false);
    } catch {
      setError('Your browser could not save this method. Export a recording to keep it.');
    }
  }
  function layerLabel(ids: number[]) {
    const counts = new Map<string, number>();
    ids.forEach((id) => {
      const p = paper.panels[id],
        key = `${p.x},${p.y}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const layers = Math.max(...counts.values());
    const minimum = Math.min(...counts.values());
    const count = minimum === layers ? String(layers) : `${minimum}–${layers}`;
    const side = Math.sign(paper.panels[ids[0]][axis as Axis] - line);
    const wholeSide =
      paper.panels.filter((p) => Math.sign(p[axis as Axis] - line) === side).length === ids.length;
    return wholeSide
      ? `Whole side · ${count} ${layers === 1 ? 'layer' : 'layers'}`
      : layers === 1
        ? 'Single flap'
        : `${count} layers together`;
  }
  function close() {
    abort.current?.abort();
    onClose();
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fold-overlay" />
        <Dialog.Content
          className="fold-workspace"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            back.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (crease) {
              e.preventDefault();
              clearSelection();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => e.stopPropagation()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void importFile(e.dataTransfer.files[0]);
          }}
        >
          <header className="fold-header">
            <button ref={back} onClick={close}>
              <ArrowLeft size={18} />
              Back
            </button>
            <div className="fold-heading">
              <Dialog.Title>Folding simulator</Dialog.Title>
              <span>{recording.title}</span>
            </div>
            <div className="fold-main-actions">
              <IconButton label="Undo edit" disabled={!undo.length || !!busy} onClick={undoEdit}>
                <Undo2 size={18} />
              </IconButton>
              <IconButton label="Redo edit" disabled={!redo.length || !!busy} onClick={redoEdit}>
                <Redo2 size={18} />
              </IconButton>
              <IconButton
                label="Rotate left 90°"
                disabled={!!busy || !!graphicsError || cursor >= 500}
                onClick={() => rotatePaper(1)}
              >
                <RotateCcw size={18} />
              </IconButton>
              <IconButton
                label="Rotate right 90°"
                disabled={!!busy || !!graphicsError || cursor >= 500}
                onClick={() => rotatePaper(-1)}
              >
                <RotateCw size={18} />
              </IconButton>
              <button
                aria-label="Turn over"
                title="Turn over"
                disabled={!!busy || !!graphicsError}
                onClick={() => scene.current?.turnOver()}
              >
                <FlipHorizontal2 size={18} />
                <span>Turn over</span>
              </button>
            </div>
            <div className="fold-secondary-actions">
              <button
                aria-label="Recorded steps"
                aria-expanded={panel === 'steps'}
                onClick={() => setPanel(panel === 'steps' ? null : 'steps')}
              >
                <ListOrdered size={18} />
                <span>Steps</span>
                <small>{recording.steps.length}</small>
              </button>
              <IconButton
                label="Advanced folding controls"
                aria-expanded={panel === 'advanced'}
                onClick={() => setPanel(panel === 'advanced' ? null : 'advanced')}
              >
                <SlidersHorizontal size={18} />
              </IconButton>
              <button aria-label="Methods and exports" onClick={() => setMethodsOpen(true)}>
                <MoreHorizontal size={20} />
              </button>
            </div>
          </header>
          <input
            ref={file}
            className="sr-only"
            type="file"
            accept=".json"
            aria-label="Import folding recording"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Dialog.Root open={methodsOpen} onOpenChange={setMethodsOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fold-menu-overlay" />
              <Dialog.Content
                className="fold-method-menu"
                aria-describedby={undefined}
                onEscapeKeyDown={(e) => e.stopPropagation()}
              >
                <div className="fold-section-title">
                  <Dialog.Title>Methods</Dialog.Title>
                  <Dialog.Close asChild>
                    <IconButton label="Close methods">
                      <X size={18} />
                    </IconButton>
                  </Dialog.Close>
                </div>
                <label>
                  Method name
                  <input
                    aria-label="Method title"
                    value={recording.title}
                    maxLength={120}
                    disabled={!!busy}
                    onChange={(e) => change({ ...recording, title: e.target.value })}
                  />
                </label>
                <label>
                  Saved methods
                  <select
                    aria-label="Saved methods"
                    value={methodId}
                    disabled={!!busy}
                    onChange={(e) => {
                      const method = methods.find((m) => m.id === e.target.value);
                      if (method) open(structuredClone(method.recording), method.id);
                    }}
                  >
                    <option value="">Choose a method…</option>
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.recording.title || 'Untitled method'}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={!!busy} onClick={saveMethod}>
                  <Bookmark size={17} />
                  Save method
                </button>
                <button disabled={!!busy} onClick={() => open(blankRecording())}>
                  <Plus size={17} />
                  New method
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => {
                    open(exampleRecording());
                    setPanel('steps');
                  }}
                >
                  <Play size={17} />
                  Try example
                </button>
                <hr />
                <button disabled={!!busy} onClick={() => file.current?.click()}>
                  <Upload size={17} />
                  Import recording
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => {
                    downloadBlob(
                      new Blob([JSON.stringify(recording, null, 2)], { type: 'application/json' }),
                      `${filename(recording.title)}.microbook-fold.json`,
                    );
                    setMethodsOpen(false);
                  }}
                >
                  <Download size={17} />
                  Export recording
                </button>
                <button
                  disabled={!!busy || !canVideo || !recording.steps.length || !!graphicsError}
                  title={canVideo ? 'Export video' : 'Video export is unavailable in this browser'}
                  onClick={() => void exportVideo()}
                >
                  <Video size={17} />
                  Export video
                </button>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          {(error || message) && (
            <div className={`fold-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>
              {error || message}
              <button
                aria-label="Dismiss message"
                onClick={() => {
                  setError('');
                  setMessage('');
                }}
              >
                ×
              </button>
            </div>
          )}
          {busy === 'video' && (
            <div className="fold-video-progress" role="status">
              <LoaderCircle className="spin" size={16} />
              Exporting video · {videoProgress}%<progress max={100} value={videoProgress} />
              <button onClick={() => abort.current?.abort()}>Cancel export</button>
            </div>
          )}
          <div className={`fold-body ${panel ? 'has-panel' : ''}`}>
            <div className="fold-stage">
              <canvas
                ref={setCanvasElement}
                role="img"
                aria-label="Interactive paper. Select a crease, then drag a side to preview its fold. Drag the background to rotate the view. Shift-drag or enable Pan to move the paper."
              />
              <div className="fold-stage-top">
                <div className="fold-paper-status">
                  <strong>
                    {shape.right - shape.left} × {shape.top - shape.bottom}
                  </strong>
                  <span>Letter paper</span>
                </div>
                <div className="fold-camera-actions">
                  <button
                    aria-pressed={spreadLayers}
                    title="Exaggerate the gaps between folded layers"
                    disabled={!!busy || !!graphicsError}
                    onClick={() => setSpreadLayers(!spreadLayers)}
                  >
                    <Layers size={17} /> Spread layers
                  </button>
                  <button
                    aria-pressed={panMode}
                    title="Pan: drag to move the paper. You can also Shift-drag."
                    disabled={!!busy || !!graphicsError}
                    onClick={() => setPanMode(!panMode)}
                  >
                    <Move size={17} /> Pan
                  </button>
                  <IconButton
                    label="Reset view"
                    disabled={!!busy}
                    onClick={() => scene.current?.setView(INITIAL_VIEW)}
                  >
                    <RotateCcw size={17} />
                  </IconButton>
                </div>
              </div>
              {graphicsError && (
                <div className="fold-graphics-error" role="alert">
                  {graphicsError}
                </div>
              )}
              {!graphicsError && !busy && !panMode && panel !== 'advanced' && (
                <div className={`fold-paper-actions ${crease ? 'is-selecting' : ''}`}>
                  {!crease ? (
                    <span className="fold-action-prompt">Select a fold line</span>
                  ) : !choice ? (
                    <>
                      <span>Choose a side</span>
                      {[...new Set(packets.map((c) => c.side))].map((side) => (
                        <button
                          key={side}
                          onPointerEnter={() => scene.current?.peek(sidePick(side)?.fold)}
                          onPointerLeave={() => scene.current?.peek()}
                          onFocus={() => scene.current?.peek(sidePick(side)?.fold)}
                          onBlur={() => scene.current?.peek()}
                          onClick={() => selectSide(side)}
                        >
                          {axis === 'x'
                            ? side < 0
                              ? 'Left side'
                              : 'Right side'
                            : side < 0
                              ? 'Lower side'
                              : 'Upper side'}
                        </button>
                      ))}
                      {!packets.length && <span>No exposed flap here</span>}
                      <IconButton label="Cancel fold" onClick={clearSelection}>
                        <X size={17} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      {otherLayers.length > 1 && (
                        <div className="fold-layer-options" role="group" aria-label="Paper to move">
                          {otherLayers.map(({ c, i }) => {
                            const candidate = {
                              axis: axis as Axis,
                              line,
                              moving: c.moving,
                              hinges: c.hinges,
                              direction: c.directions.includes(actualDirection)
                                ? actualDirection
                                : c.directions[0],
                            };
                            return (
                              <button
                                key={i}
                                aria-pressed={packet === i}
                                title={`Move highlighted paper: ${c.moving.map((id) => `cell ${id + 1}`).join(', ')}`}
                                onPointerEnter={() => scene.current?.peek(candidate)}
                                onPointerLeave={() => scene.current?.peek()}
                                onFocus={() => scene.current?.peek(candidate)}
                                onBlur={() => scene.current?.peek()}
                                onClick={() => {
                                  setPacket(i);
                                  setDirection(candidate.direction);
                                  setAngle(0);
                                }}
                              >
                                {layerLabel(c.moving)}
                                {c.directions.length === 1
                                  ? c.directions.includes(scene.current?.facing() || 1)
                                    ? ' · near side'
                                    : ' · far side'
                                  : ''}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {choice.directions.length > 1 && (
                        <IconButton
                          label="Reverse fold direction"
                          onClick={() => setDirection(actualDirection === 1 ? -1 : 1)}
                        >
                          <Repeat2 size={18} />
                        </IconButton>
                      )}
                      <button className="primary" disabled={cursor >= 500} onClick={() => void confirmFold()}>
                        {unfolded ? 'Unfold' : 'Fold'}
                      </button>
                      <button onClick={clearSelection}>Cancel</button>
                    </>
                  )}
                </div>
              )}
              {busy === 'play' && (
                <div className="fold-paper-actions">
                  <span>
                    Step {cursor} of {recording.steps.length}
                  </span>
                  <button onClick={() => abort.current?.abort()}>
                    <Pause size={17} />
                    Pause
                  </button>
                </div>
              )}
            </div>
            {panel && (
              <aside
                className="fold-controls"
                aria-label={panel === 'steps' ? 'Recorded steps' : 'Advanced folding controls'}
              >
                <div className="fold-panel-heading">
                  <h3>{panel === 'steps' ? 'Recorded steps' : 'Advanced'}</h3>
                  <IconButton label="Close panel" onClick={() => setPanel(null)}>
                    <X size={17} />
                  </IconButton>
                </div>
                {panel === 'steps' ? (
                  <section className="fold-section fold-timeline">
                    <div className="fold-playback">
                      <IconButton
                        label="Previous step"
                        disabled={!cursor || !!busy}
                        onClick={() => seek(cursor - 1)}
                      >
                        <SkipBack size={18} />
                      </IconButton>
                      <button
                        className="fold-play"
                        disabled={!recording.steps.length || !!graphicsError || (!!busy && busy !== 'play')}
                        onClick={() => (busy === 'play' ? abort.current?.abort() : void play())}
                      >
                        {busy === 'play' ? <Pause size={18} /> : <Play size={18} />}{' '}
                        {busy === 'play' ? 'Pause playback' : 'Play'}
                      </button>
                      <IconButton
                        label="Next step"
                        disabled={cursor >= recording.steps.length || !!busy}
                        onClick={() => seek(cursor + 1)}
                      >
                        <SkipForward size={18} />
                      </IconButton>
                    </div>
                    <input
                      aria-label="Timeline position"
                      type="range"
                      min={0}
                      max={recording.steps.length || 1}
                      value={cursor}
                      disabled={!!busy || !recording.steps.length}
                      onChange={(e) => seek(Number(e.target.value))}
                    />
                    <ol>
                      <li>
                        <button
                          className={cursor === 0 ? 'is-current' : ''}
                          aria-current={cursor === 0 ? 'step' : undefined}
                          disabled={!!busy}
                          onClick={() => seek(0)}
                        >
                          <span>0</span>
                          <div>Unfolded sheet</div>
                        </button>
                      </li>
                      {recording.steps.map((step, i) => (
                        <li key={i}>
                          <button
                            className={cursor === i + 1 ? 'is-current' : ''}
                            aria-current={cursor === i + 1 ? 'step' : undefined}
                            disabled={!!busy}
                            onClick={() => seek(i + 1)}
                          >
                            <span>{i + 1}</span>
                            <div>
                              {step.fold ? 'Fold paper' : 'Turn the view'}
                              {step.note && <small>{step.note}</small>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ol>
                    {selectedStep && (
                      <label>
                        Step {cursor} note
                        <textarea
                          aria-label="Current step note"
                          disabled={!!busy}
                          value={selectedStep.note}
                          maxLength={2000}
                          rows={3}
                          onChange={(e) =>
                            change({
                              ...recording,
                              steps: recording.steps.map((s, i) =>
                                i === cursor - 1 ? { ...s, note: e.target.value } : s,
                              ),
                            })
                          }
                        />
                      </label>
                    )}
                    <label>
                      Next step note
                      <textarea
                        aria-label="Note for next step"
                        disabled={!!busy}
                        value={note}
                        maxLength={2000}
                        rows={2}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                    {cursor < recording.steps.length && (
                      <p className="fold-hint">
                        A new step replaces the later draft steps. Undo restores them.
                      </p>
                    )}
                    <button
                      className="fold-add-view"
                      disabled={!!busy || cursor >= 500 || !!graphicsError}
                      onClick={addView}
                    >
                      <Camera size={16} />
                      Add view without folding
                    </button>
                  </section>
                ) : (
                  <>
                    <section className="fold-section">
                      <fieldset disabled={!!busy || !!graphicsError}>
                        <label>
                          Crease
                          <select
                            aria-label="Crease"
                            value={crease}
                            onChange={(e) => chooseCrease(e.target.value)}
                          >
                            <option value="">Choose…</option>
                            {axes.map((c) => (
                              <option key={`${c.axis}:${c.line}`} value={`${c.axis}:${c.line}`}>
                                {c.axis === 'x' ? 'Vertical' : 'Horizontal'} · line {c.line}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!!crease && (
                          <label>
                            Flap or packet
                            <select
                              aria-label="Flap or packet"
                              value={packet}
                              onChange={(e) => {
                                setPacket(Number(e.target.value));
                                setAngle(0);
                              }}
                            >
                              <option value={-1}>Choose a side…</option>
                              {packets.map((c, i) => (
                                <option key={i} value={i}>
                                  {axis === 'x'
                                    ? c.side < 0
                                      ? 'Left'
                                      : 'Right'
                                    : c.side < 0
                                      ? 'Lower'
                                      : 'Upper'}{' '}
                                  · {c.moving.length} panels
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {choice && (
                          <>
                            <label>
                              Direction
                              <select
                                aria-label="Fold direction"
                                value={actualDirection}
                                onChange={(e) => {
                                  setDirection(Number(e.target.value) as 1 | -1);
                                  setAngle(0);
                                }}
                              >
                                <option value={1} disabled={!choice.directions.includes(1)}>
                                  Toward the original front
                                </option>
                                <option value={-1} disabled={!choice.directions.includes(-1)}>
                                  Toward the original back
                                </option>
                              </select>
                            </label>
                            <label className="fold-slider-label">
                              Preview angle <output>{angle}°</output>
                              <input
                                aria-label="Preview angle"
                                type="range"
                                min={0}
                                max={180}
                                value={angle}
                                onChange={(e) => setAngle(Number(e.target.value))}
                              />
                            </label>
                          </>
                        )}
                      </fieldset>
                      {choice && (
                        <div className="fold-confirm">
                          <button
                            className="primary"
                            disabled={!!busy || cursor >= 500}
                            onClick={() => void confirmFold()}
                          >
                            {unfolded ? 'Unfold' : 'Fold'}
                          </button>
                          <button disabled={!!busy} onClick={clearSelection}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </section>
                    <section className="fold-section fold-exposed">
                      <h3>Exposed cells</h3>
                      <p>
                        <strong>Front-facing</strong>
                        {exposed(paper).join(' · ')}
                      </p>
                      <p>
                        <strong>Back-facing</strong>
                        {exposed(paper, false).join(' · ')}
                      </p>
                    </section>
                    <p className="fold-limitation">
                      Grid folds on intact paper. Bending and paper stiffness are not simulated.
                    </p>
                  </>
                )}
              </aside>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
