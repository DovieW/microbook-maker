import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        neutral: 'border-panel-border/70 bg-panel-elevated text-ink-muted',
        brass: 'border-brass/60 bg-brass/15 text-brass-bright',
        success: 'border-success/50 bg-success/15 text-success',
        warning: 'border-warning/50 bg-warning/15 text-warning',
        danger: 'border-danger/50 bg-danger/15 text-danger',
        paper: 'border-ink/20 bg-paper-warm text-ink',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';
