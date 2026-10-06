import { blankRecording, parseRecording, type Recording } from './model';
const DRAFT_KEY = 'microbook-folding-draft-v1';
const METHODS_KEY = 'microbook-folding-methods-v1';
export type SavedMethod = { id: string; recording: Recording };
export function loadRecordings(): { draft: Recording; methods: SavedMethod[]; error: string } {
  let draft = blankRecording(),
    methods: SavedMethod[] = [];
  const errors: string[] = [];
  try {
    const text = localStorage.getItem(DRAFT_KEY);
    if (text) draft = parseRecording(text);
  } catch {
    errors.push('The previous draft could not be read. You can import a recording to recover it.');
  }
  try {
    const text = localStorage.getItem(METHODS_KEY);
    if (text) {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw Error();
      methods = data.map((m) => {
        if (typeof m.id !== 'string') throw Error();
        return { id: m.id, recording: parseRecording(JSON.stringify(m.recording)) };
      });
    }
  } catch {
    errors.push('Saved methods could not be read. Existing browser data has not been removed.');
  }
  return { draft, methods, error: errors.join(' ') };
}
export function saveDraft(recording: Recording) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(recording));
}
export function saveMethods(methods: SavedMethod[]) {
  localStorage.setItem(METHODS_KEY, JSON.stringify(methods));
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function filename(title: string) {
  return (
    title
      .replace(/[^a-z0-9 _-]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'folding-method'
  );
}
