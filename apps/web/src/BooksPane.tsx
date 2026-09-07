import { useState } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { modeLabels, type LibraryRender } from '@microbook/core';
import { Dropdown } from './ui';
import type { Workspace } from './LayoutControls';
export function BooksPane({ w }: { w: Workspace }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const books = w.library
    .filter((b) =>
      `${b.metadata.title} ${b.metadata.author} ${b.originalName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'title'
        ? a.metadata.title.localeCompare(b.metadata.title)
        : (w.prefs.documents[b.id]?.openedAt || Date.parse(b.createdAt)) -
          (w.prefs.documents[a.id]?.openedAt || Date.parse(a.createdAt)),
    );
  const label = (r: LibraryRender) =>
    r.savedLabel ||
    `${modeLabels[r.settings.mode]} · ${r.settings.fontSizePx} px · ${r.createdAt?.slice(0, 10) || 'Earlier version'}`;
  return (
    <div className="books-pane">
      {import.meta.env.VITE_HOSTED === '1' && <p className="hosted-notice">Temporary workspace. Books and PDFs stay in this browser and expire after 24 hours. Expired data is removed when the app is open or next opened. Cloudflare processes each print document without saving it in a Library. Keep versions does not extend expiry. Only process books you are authorized to use.</p>}
      {w.preview && (
        <button
          className="keep-current"
          disabled={w.dirty || !!w.preview.saved || w.busy || w.active}
          title="Preserve this PDF and its settings as a named version"
          onClick={() => void w.updateVersion(w.preview!.id, { saved: true })}
        >
          {w.preview.saved ? 'Version kept' : 'Keep version'}
        </button>
      )}
      <div className="books-actions">
        <input
          type="search"
          aria-label="Find book"
          placeholder="Find book…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => w.input.current?.click()}>
          <Plus size={15} />
          Import
        </button>
      </div>
      <Dropdown
        label="Sort books"
        value={sort}
        onChange={setSort}
        options={[
          ['recent', 'Recently opened'],
          ['title', 'Title'],
        ]}
      />
      {w.libraryLoading && <p role="status">Loading books…</p>}
      {w.libraryError && (
        <div role="alert">
          <p>{w.libraryError}</p>
          <button onClick={() => void w.showLibrary()}>Retry</button>
        </div>
      )}
      {!w.libraryLoading && !w.libraryError && !books.length && (
        <p className="muted">{query ? 'No matching books' : 'No books yet'}</p>
      )}
      {books.map((book) => {
        const latest =
          book.renders.find((r) => r.id === book.lastRenderId && r.status === 'completed') ||
          book.renders.find((r) => r.status === 'completed');
        return (
          <article className={`book-row${book.id === w.doc?.id ? ' current' : ''}`} key={book.id}>
            <div className="book-row-main">
              <button className="book-open" onClick={() => void w.openDocument(book.id)}>
                {latest && <img src={`/api/renders/${latest.id}/thumbnail`} alt="" loading="lazy" />}
                <span>
                  <strong>{book.metadata.title}</strong>
                  <small>{book.metadata.author || book.format.toUpperCase()}</small>
                </span>
              </button>
              <details className="overflow-menu">
                <summary aria-label={`Book actions for ${book.metadata.title}`}>
                  <MoreHorizontal size={16} />
                </summary>
                <div>
                  <small>{book.originalName}</small>
                  <small>Imported {new Date(book.createdAt).toLocaleDateString()}</small>
                  <button
                    className="danger"
                    disabled={book.renders.some((r) => ['running', 'queued'].includes(r.status))}
                    onClick={() => void w.removeDocument(book.id)}
                  >
                    Remove book
                  </button>
                </div>
              </details>
            </div>
            <div className="book-layouts">
              {(['classic', 'book'] as const).map((mode) => {
                const r =
                  book.renders.find((r) => r.id === book.lastRenderIds?.[mode]) ||
                  book.renders.find((r) => r.settings.mode === mode && r.status === 'completed');
                return (
                  r && (
                    <button key={mode} onClick={() => void w.openDocument(book.id, undefined, mode)}>
                      {modeLabels[mode]} · {r.result?.sheets} {r.result?.sheets === 1 ? 'sheet' : 'sheets'}
                    </button>
                  )
                );
              })}
            </div>
            {book.renders.some((r) => r.saved) && (
              <details className="kept-versions">
                <summary>Kept versions</summary>
                {book.renders
                  .filter((r) => r.saved)
                  .map((r) => (
                    <div className="kept-row" key={r.id}>
                      <button onClick={() => void w.openDocument(book.id, r.id)}>{label(r)}</button>
                      <details>
                        <summary aria-label={`Version actions for ${label(r)}`}>
                          <MoreHorizontal size={14} />
                        </summary>
                        <div>
                          <input
                            aria-label="Version name"
                            defaultValue={label(r)}
                            maxLength={200}
                            onBlur={(e) => {
                              if (e.target.value.trim() && e.target.value.trim() !== label(r))
                                void w.updateVersion(r.id, { label: e.target.value.trim() });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                          />
                          <button onClick={() => void w.updateVersion(r.id, { saved: false })}>
                            Stop keeping version
                          </button>
                        </div>
                      </details>
                    </div>
                  ))}
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
