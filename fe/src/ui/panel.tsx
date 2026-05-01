import * as React from 'react';
import { cn } from '../lib/cn';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'dark' | 'paper';
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, tone = 'dark', ...props }, ref) => (
    <section
      ref={ref}
      className={cn(
        'rounded-panel border shadow-panel',
        tone === 'paper'
          ? 'paper-grain border-brass/35 bg-paper text-ink'
          : 'border-panel-border/70 bg-panel/95 text-paper-warm',
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = 'Panel';

export const PanelHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-between border-b border-current/15 px-6 py-4', className)}
    {...props}
  />
));
PanelHeader.displayName = 'PanelHeader';

export const PanelTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('font-display text-lg font-semibold tracking-wide text-brass-bright', className)}
    {...props}
  />
));
PanelTitle.displayName = 'PanelTitle';

export const PanelBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6', className)} {...props} />
));
PanelBody.displayName = 'PanelBody';

export const SectionTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-xs font-bold uppercase tracking-[0.24em] text-brass-bright', className)}
    {...props}
  />
));
SectionTitle.displayName = 'SectionTitle';
