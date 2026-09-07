import { useEffect, useState } from 'react';
import type { RenderJob } from '@microbook/core';

export function RenderActivity({
  job,
  activity,
  onCancel,
}: {
  job?: RenderJob;
  activity?: string;
  onCancel?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [since] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(
    0,
    Math.floor((now - (job ? Date.parse(job.startedAt || job.createdAt) : since)) / 1000),
  );
  const progress = job?.progress;
  const percentage = progress?.total
    ? Math.min(100, Math.floor((progress.completed / progress.total) * 100))
    : undefined;
  const phase = activity || (job?.status === 'queued' ? 'Waiting for renderer' : job?.phase) || 'Preparing';
  return (
    <div className="render-activity" role="status" aria-label="Processing">
      <div className="activity-row">
        <span>
          {phase}
          {percentage !== undefined ? ` · ${percentage}%` : ''}
        </span>
        <span className="activity-time">
          {elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`}
        </span>
        {onCancel && <button onClick={onCancel}>Cancel</button>}
      </div>
      {progress ? (
        <progress aria-label={`${phase} progress`} max={progress.total} value={progress.completed} />
      ) : <div className="preview-loading-track" aria-hidden="true"><span /></div>}
      {!!progress?.sides && <span className="activity-detail">Printed side {progress.sides}</span>}
    </div>
  );
}
