import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { IconButton } from './ui';

export function Navigation({
  value,
  total,
  onChange,
  unit = 'side',
  spreads = false,
}: {
  unit?: 'side' | 'page';
  spreads?: boolean;
  value: number;
  total: number;
  onChange: (value: number) => void;
}) {
  const spreadStart = value > 1 && value % 2 ? value - 1 : value;
  const previous = spreads ? Math.max(1, spreadStart - 2) : value - 1;
  const next = spreads ? Math.min(total, value === 1 ? 2 : spreadStart + 2) : value + 1;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const number = Number(draft);
    const next =
      draft.trim() && Number.isFinite(number) ? Math.max(1, Math.min(total, Math.trunc(number))) : value;
    setDraft(String(next));
    onChange(next);
  };
  return (
    <nav className="navigation" aria-label="Preview navigation">
      <IconButton label={`First ${unit}`} disabled={!total || value <= 1} onClick={() => onChange(1)}>
        <ChevronsLeft size={17} />
      </IconButton>
      <IconButton label="Previous" disabled={!total || value <= 1} onClick={() => onChange(previous)}>
        <ChevronLeft size={17} />
      </IconButton>
      {total ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
          className="jump-control"
        >
          <input
            aria-label={unit === 'page' ? 'Booklet page' : 'Printed side'}
            title={`Jump to ${unit}`}
            inputMode="numeric"
            value={draft}
            style={{ width: `${Math.max(2, String(total).length) + 1}ch` }}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setDraft(String(value));
            }}
          />
          <span>/ {total}</span>
        </form>
      ) : (
        <span>—</span>
      )}
      <IconButton label="Next" disabled={!total || value >= total} onClick={() => onChange(next)}>
        <ChevronRight size={17} />
      </IconButton>
      <IconButton label={`Last ${unit}`} disabled={!total || value >= total} onClick={() => onChange(total)}>
        <ChevronsRight size={17} />
      </IconButton>
    </nav>
  );
}
