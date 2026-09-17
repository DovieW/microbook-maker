import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bold, Heading2, Italic, Link, List, Plus, X } from 'lucide-react';
import { Dropdown, IconButton } from './ui';
import type { Workspace } from './LayoutControls';

export function AddTextDialog({ w }: { w: Workspace }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [position, setPosition] = useState('1');
  const [headingStyle, setHeadingStyle] = useState<'none' | 'compact' | 'chapter' | 'part'>('none');
  const [saving, setSaving] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const format = (before: string, after = before, linePrefix = false) => {
    const input = editor.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = body.slice(start, end);
    let next: string;
    let selectionStart: number;
    let selectionEnd: number;
    if (linePrefix) {
      const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineEnd = body.indexOf('\n', end) < 0 ? body.length : body.indexOf('\n', end);
      const lines = body
        .slice(lineStart, lineEnd)
        .split('\n')
        .map((line) => before + line)
        .join('\n');
      next = body.slice(0, lineStart) + lines + body.slice(lineEnd);
      selectionStart = lineStart;
      selectionEnd = lineStart + lines.length;
    } else {
      next = body.slice(0, start) + before + selected + after + body.slice(end);
      selectionStart = start + before.length;
      selectionEnd = selectionStart + selected.length;
    }
    setBody(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(selectionStart, selectionEnd);
    });
  };
  const reset = () => {
    setTitle('');
    setBody('');
    setPosition('1');
    setHeadingStyle('none');
    setSaving(false);
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <IconButton
          className="content-add-button primary"
          label="Add text"
          disabled={!!w.kept || w.busy || w.active}
        >
          <Plus size={16} />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="content-dialog-overlay" />
        <Dialog.Content className="content-dialog" aria-describedby="custom-text-description">
          <header>
            <div>
              <Dialog.Title>Add text content</Dialog.Title>
              <Dialog.Description id="custom-text-description">
                Add a section that can be included and reordered with the rest of the book.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </header>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await w.addText(
                  title,
                  body,
                  validPosition(position, w.doc?.sections.length || 0),
                  headingStyle,
                );
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              <span>Section title</span>
              <input
                autoFocus
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <PositionField value={position} max={(w.doc?.sections.length || 0) + 1} onChange={setPosition} />
            <label className="dialog-select-field">
              <span>Title in book</span>
              <Dropdown
                label="Title in book"
                value={headingStyle}
                onChange={(value) => setHeadingStyle(value as 'none' | 'compact' | 'chapter' | 'part')}
                options={[
                  ['none', 'Do not show'],
                  ['compact', 'Compact heading'],
                  ['chapter', 'Chapter heading'],
                  ['part', 'Part heading'],
                ]}
              />
            </label>
            <div className="text-editor-label">
              <span>Text</span>
              <span className="muted">Simple formatting</span>
            </div>
            <div className="text-format-toolbar" role="toolbar" aria-label="Text formatting">
              <FormatButton label="Bold" onClick={() => format('**')}>
                <Bold size={15} />
              </FormatButton>
              <FormatButton label="Italic" onClick={() => format('*')}>
                <Italic size={15} />
              </FormatButton>
              <FormatButton label="Heading" onClick={() => format('## ', '', true)}>
                <Heading2 size={15} />
              </FormatButton>
              <FormatButton label="Bulleted list" onClick={() => format('- ', '', true)}>
                <List size={15} />
              </FormatButton>
              <FormatButton label="Link" onClick={() => format('[', '](https://)')}>
                <Link size={15} />
              </FormatButton>
            </div>
            <textarea
              ref={editor}
              aria-label="Text"
              required
              maxLength={100000}
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write an introduction, note, colophon, reading guide…"
            />
            <footer>
              <Dialog.Close disabled={saving}>Cancel</Dialog.Close>
              <button className="primary" disabled={saving || !title.trim() || !body.trim()}>
                {saving ? 'Adding…' : 'Add to book'}
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FormatButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

const validPosition = (value: string, count: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, count + 1)) : 1;
};

function PositionField({
  value,
  max,
  onChange,
}: {
  value: string;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="dialog-position-field">
      <span>Initial position</span>
      <input
        aria-label="Initial position"
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(String(validPosition(value, max - 1)))}
      />
    </label>
  );
}

export function ImageContentDialog({
  w,
  blockId,
  defaultAlt = '',
}: {
  w: Workspace;
  blockId?: string;
  defaultAlt?: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [title, setTitle] = useState('');
  const [alt, setAlt] = useState(defaultAlt);
  const [position, setPosition] = useState('1');
  const [saving, setSaving] = useState(false);
  const replacement = !!blockId;
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const reset = () => {
    setFile(undefined);
    setTitle('');
    setAlt(defaultAlt);
    setPosition('1');
    setSaving(false);
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <Dialog.Trigger asChild>
        {replacement ? (
          <button className="image-edit-button" disabled={!!w.kept || w.busy || w.active}>
            Replace image
          </button>
        ) : (
          <IconButton
            className="content-add-button primary"
            label="Add image"
            disabled={!!w.kept || w.busy || w.active}
          >
            <Plus size={16} />
          </IconButton>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="content-dialog-overlay" />
        <Dialog.Content
          className="content-dialog image-content-dialog"
          aria-describedby="custom-image-description"
        >
          <header>
            <div>
              <Dialog.Title>{replacement ? 'Replace image' : 'Add image'}</Dialog.Title>
              <Dialog.Description id="custom-image-description">
                {replacement
                  ? 'The original stays available so you can restore it later.'
                  : 'The image becomes a section that you can position from Contents.'}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </header>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!file) return;
              setSaving(true);
              try {
                if (blockId) await w.replaceDocumentImage(blockId, file, alt);
                else await w.addImage(file, title, alt, validPosition(position, w.doc?.sections.length || 0));
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="image-file-field">
              <span>Image file</span>
              <input
                autoFocus
                required
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  setFile(selected);
                  if (selected && !replacement && !title)
                    setTitle(selected.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
                }}
              />
            </label>
            {preview && <img className="custom-image-preview" src={preview} alt="Selected image preview" />}
            {!replacement && (
              <>
                <label>
                  <span>Section title</span>
                  <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <PositionField
                  value={position}
                  max={(w.doc?.sections.length || 0) + 1}
                  onChange={setPosition}
                />
              </>
            )}
            <label>
              <span>
                Image description <small>Optional</small>
              </span>
              <input maxLength={500} value={alt} onChange={(e) => setAlt(e.target.value)} />
            </label>
            <footer>
              <Dialog.Close disabled={saving}>Cancel</Dialog.Close>
              <button className="primary" disabled={saving || !file || (!replacement && !title.trim())}>
                {saving ? 'Saving…' : replacement ? 'Replace image' : 'Add to book'}
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
