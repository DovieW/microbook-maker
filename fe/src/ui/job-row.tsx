import * as React from 'react';
import { Download, FileText } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Progress } from './progress';
import { cn } from '../lib/cn';

export type JobRowStatus = 'completed' | 'processing' | 'queued' | 'error';

const statusVariant: Record<JobRowStatus, 'success' | 'brass' | 'warning' | 'danger'> = {
  completed: 'success',
  processing: 'brass',
  queued: 'warning',
  error: 'danger',
};

export interface JobRowProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  status: JobRowStatus;
  progress?: number;
  onDownload?: () => void;
}

export const JobRow = React.forwardRef<HTMLDivElement, JobRowProps>(
  ({ className, title, subtitle, status, progress, onDownload, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border-b border-panel-border/45 px-4 py-4 last:border-b-0', className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-paper-warm" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-semibold leading-6 text-paper-warm">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-ink-muted">{subtitle}</div>}
          {typeof progress === 'number' && <Progress className="mt-3" value={progress} />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={statusVariant[status]}>{status}</Badge>
          {onDownload && status === 'completed' && (
            <Button variant="secondary" size="sm" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  ),
);
JobRow.displayName = 'JobRow';
