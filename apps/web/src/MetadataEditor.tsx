import { useState } from 'react';
import { Search, LoaderCircle } from 'lucide-react';
import type { Metadata } from '@microbook/core';
import { api } from './api';
export function MetadataEditor({
  metadata,
  manualFields,
  onChange,
}: {
  metadata: Metadata;
  manualFields: string[];
  onChange: (metadata: Metadata, field?: string) => void;
}) {
  const [results, setResults] = useState<Partial<Metadata>[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function lookup() {
    setBusy(true);
    setError('');
    try {
      setResults(await api(`/api/metadata/lookup?title=${encodeURIComponent(metadata.title)}`));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="metadata-fields">
      {(['title', 'author', 'year', 'series', 'language'] as const).map((key) => (
        <div className="field stacked" key={key}>
          <label htmlFor={`meta-${key}`}>{key[0].toUpperCase() + key.slice(1)}</label>
          {key === 'title' ? (
            <textarea
              id={`meta-${key}`}
              rows={2}
              value={metadata[key]}
              onChange={(e) => onChange({ ...metadata, [key]: e.target.value }, key)}
            />
          ) : (
            <input
              id={`meta-${key}`}
              value={metadata[key]}
              onChange={(e) => onChange({ ...metadata, [key]: e.target.value }, key)}
            />
          )}
        </div>
      ))}
      <button className="full-button" disabled={busy || !metadata.title} onClick={() => void lookup()}>
        {busy ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />}
        Look up metadata
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {results && (
        <div className="lookup-results">
          {results.length ? (
            results.map((result, index) => (
              <div key={index}>
                <span>
                  <strong>{result.title}</strong>
                  <small>{[result.author, result.year].filter(Boolean).join(' · ')}</small>
                </span>
                <button
                  onClick={() => {
                    const next = { ...metadata };
                    for (const field of ['title', 'author', 'year'] as const)
                      if (!manualFields.includes(field) && !next[field] && result[field])
                        next[field] = result[field]!;
                    onChange(next);
                    setResults(undefined);
                  }}
                >
                  Use missing fields
                </button>
              </div>
            ))
          ) : (
            <p>No matches</p>
          )}
        </div>
      )}
    </div>
  );
}
