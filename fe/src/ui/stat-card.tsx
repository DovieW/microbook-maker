import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, icon: Icon, label, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-ui border border-panel-border/70 bg-panel-elevated/90 p-4 text-paper-warm shadow-inset',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-7 w-7 text-brass-bright" strokeWidth={1.5} />}
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-ink-muted">{label}</div>
          <div className="font-display text-3xl font-semibold leading-none text-paper-warm">{value}</div>
        </div>
      </div>
    </div>
  ),
);
StatCard.displayName = 'StatCard';
