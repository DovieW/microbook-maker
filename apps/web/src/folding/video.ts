import { applyFold, flatPaper, INITIAL_VIEW, type Paper, type Recording } from './model';
import { PaperScene } from './scene';

export function videoMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function')
    return undefined;
  return [
    'video/mp4;codecs=avc1.42001E',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type));
}
/** Foreground time only; abort also wakes up an animation in a hidden tab. */
export function animate(
  duration: number,
  frame: (progress: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let elapsed = 0,
      last = performance.now(),
      raf = 0;
    const finish = (error?: unknown) => {
      cancelAnimationFrame(raf);
      signal.removeEventListener('abort', abort);
      document.removeEventListener('visibilitychange', visible);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const visible = () => {
      last = performance.now();
    };
    const tick = (now: number) => {
      if (signal.aborted) {
        abort();
        return;
      }
      if (!document.hidden) elapsed += Math.min(now - last, 100);
      last = now;
      try {
        frame(duration ? Math.min(1, elapsed / duration) : 1);
      } catch (error) {
        finish(error);
        return;
      }
      if (elapsed >= duration) finish();
      else raf = requestAnimationFrame(tick);
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    document.addEventListener('visibilitychange', visible);
    raf = requestAnimationFrame(tick);
  });
}
export async function recordVideo(
  recording: Recording,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<{ blob: Blob; extension: string }> {
  const mimeType = videoMimeType();
  if (!mimeType)
    throw Error(
      'Video export is unavailable in this browser. Export the recording instead, or use a browser with canvas video recording.',
    );
  const source = document.createElement('canvas'),
    output = document.createElement('canvas');
  output.width = 1280;
  output.height = 720;
  const ctx = output.getContext('2d')!;
  const scene = new PaperScene(source);
  scene.renderer.setPixelRatio(1);
  scene.resize(1280, 580);
  scene.setInteractive(false);
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined;
  const chunks: Blob[] = [];
  let recordError: Error | undefined;
  const visibility = () => {
    if (document.hidden && recorder?.state === 'recording') recorder.pause();
    else if (!document.hidden && recorder?.state === 'paused') recorder.resume();
  };
  function compose(title: string, note: string) {
    ctx.fillStyle = '#0b141e';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.drawImage(source, 0, 0, 1280, 580);
    ctx.fillStyle = '#83d3bd';
    ctx.font = '600 23px system-ui';
    ctx.fillText(title, 36, 614, 1208);
    ctx.font = '22px system-ui';
    ctx.fillStyle = '#e0e8ee';
    const words = note.split(/\s+/);
    let line = '',
      y = 650;
    for (const word of words) {
      if (ctx.measureText(`${line} ${word}`).width > 1200) {
        ctx.fillText(line, 36, y);
        line = word;
        y += 28;
        if (y > 678) {
          ctx.fillText('…', 1230, 678);
          return;
        }
      } else line += `${line ? ' ' : ''}${word}`;
    }
    ctx.fillText(line, 36, y, 1200);
  }
  let paper: Paper = flatPaper();
  const holds = recording.steps.map((s) => Math.min(4000, Math.max(1400, s.note.length * 28)));
  const total = 1000 + recording.steps.reduce((sum, s, i) => sum + (s.fold ? 1100 : 0) + holds[i], 0);
  let elapsed = 0;
  const wait = async (ms: number, draw: (p: number) => void) => {
    await animate(
      ms,
      (p) => {
        if (recordError) throw recordError;
        draw(p);
        onProgress((elapsed + p * ms) / total);
      },
      signal,
    );
    elapsed += ms;
  };
  try {
    scene.setView(INITIAL_VIEW);
    scene.setPaper(paper, undefined, 0, false);
    compose(recording.title, 'Letter paper · 4 × 4 cells · Step-by-step folding');
    // Capture only after the first complete frame exists, avoiding a black poster frame.
    stream = output.captureStream(30);
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => {
      recordError = Error('The browser could not encode this video. Try exporting the recording instead.');
    };
    const stopped = new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
    });
    document.addEventListener('visibilitychange', visibility);
    recorder.start(250);
    visibility();
    await wait(1000, () => compose(recording.title, 'Letter paper · 4 × 4 cells · Step-by-step folding'));
    for (let i = 0; i < recording.steps.length; i++) {
      const step = recording.steps[i];
      scene.setView(step.view);
      const caption = `${recording.title} · Step ${i + 1} of ${recording.steps.length}`;
      if (step.fold) {
        await wait(1100, (p) => {
          scene.setPaper(paper, step.fold, p, false);
          compose(caption, step.note || 'Fold the highlighted packet.');
        });
        paper = applyFold(paper, step.fold);
      }
      scene.setPaper(paper, undefined, 0, false);
      compose(caption, step.note || 'Inspect the paper before continuing.');
      await wait(holds[i], () => compose(caption, step.note || 'Inspect the paper before continuing.'));
    }
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    if (recordError) throw recordError;
    if (!chunks.length) throw Error('The browser returned an empty video. Export the recording instead.');
    return {
      blob: new Blob(chunks, { type: recorder.mimeType || mimeType }),
      extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm',
    };
  } finally {
    document.removeEventListener('visibilitychange', visibility);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    scene.dispose();
  }
}
