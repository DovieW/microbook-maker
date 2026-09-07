import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './ui';

export function Navigation({
  value,
  total,
  onChange,
}: {
  value: number;
  total: number;
  onChange: (value: number) => void;
}) {
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
      <IconButton label="Previous" disabled={!total || value <= 1} onClick={() => onChange(value - 1)}>
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
            aria-label="Printed side"
            title="Jump to printed side"
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
      <IconButton label="Next" disabled={!total || value >= total} onClick={() => onChange(value + 1)}>
        <ChevronRight size={17} />
      </IconButton>
    </nav>
  );
}
