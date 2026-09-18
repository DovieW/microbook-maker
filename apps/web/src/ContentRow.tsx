import { useRef, useState, useEffect, type ReactNode } from 'react';

export type ContentDrag = { token: string; target: string } | null;

export function ContentRowHeader({
  position,
  title,
  location,
  label,
  expanded,
  disabled,
  onOpen,
  thumbnail,
  children,
}: {
  position?: ReactNode;
  title: string;
  location: string;
  label?: string;
  expanded: boolean;
  disabled?: boolean;
  onOpen: () => void;
  thumbnail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`content-row-header${thumbnail ? ' has-thumbnail' : ''}`}>
      {position}
      <button
        className="contents-jump"
        aria-label={label}
        aria-expanded={expanded}
        disabled={disabled}
        onClick={onOpen}
      >
        <span>{title}</span>
        <small>{location}</small>
      </button>
      {thumbnail}
      {children}
    </div>
  );
}

export function ContentPosition({
  token,
  title,
  position,
  max,
  disabled,
  setDrag,
  targetPosition,
  move,
}: {
  token: string;
  title: string;
  position: number;
  max: number;
  disabled: boolean;
  setDrag: (drag: ContentDrag) => void;
  targetPosition: (token: string) => number;
  move: (position: number) => void;
}) {
  const pointer = useRef<{ id: number; x: number; y: number; target: string; moving: boolean } | null>(null);
  const [text, setText] = useState(String(position));
  useEffect(() => setText(String(position)), [position]);
  const commit = () => {
    const value = Number(text);
    if (Number.isInteger(value) && value >= 1 && value <= max && value !== position) move(value);
    else setText(String(position));
  };
  const reset = () => {
    pointer.current = null;
    setDrag(null);
  };
  return (
    <div className="contents-position">
      <button
        className="contents-drag"
        aria-label={`Move ${title}; use arrow keys to reorder`}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            move(position + (event.key === 'ArrowUp' ? -1 : 1));
          }
          if (event.key === 'Escape') reset();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            target: token,
            moving: false,
          };
        }}
        onPointerMove={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          if (!start.moving && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4) return;
          start.moving = true;
          const rows =
            event.currentTarget
              .closest('.contents-list')
              ?.querySelectorAll<HTMLElement>('[data-content-token]') || [];
          let distance = Infinity;
          for (const row of rows) {
            const header = row.querySelector('.content-row-header') || row;
            const rect = header.getBoundingClientRect();
            const next = Math.abs(event.clientY - (rect.top + rect.bottom) / 2);
            if (next < distance) {
              distance = next;
              start.target = row.dataset.contentToken!;
            }
          }
          setDrag({ token, target: start.target });
          const body = event.currentTarget.closest('.sidebar-body');
          if (body) {
            const rect = body.getBoundingClientRect();
            if (event.clientY < rect.top + 40) body.scrollTop -= 16;
            if (event.clientY > rect.bottom - 40) body.scrollTop += 16;
          }
        }}
        onPointerUp={() => {
          const start = pointer.current;
          if (start?.moving && start.target !== token) move(targetPosition(start.target));
          reset();
        }}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
      >
        ⋮⋮
      </button>
      <input
        className="contents-position-input"
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        aria-label={`Position of ${title}`}
        disabled={disabled}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') setText(String(position));
        }}
      />
    </div>
  );
}
