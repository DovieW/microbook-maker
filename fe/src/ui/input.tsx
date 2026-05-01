import * as React from 'react';
import { cn } from '../lib/cn';

export const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('grid gap-2', className)} {...props} />
));
Field.displayName = 'Field';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('text-xs font-semibold uppercase tracking-[0.16em] text-brass-bright', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  tone?: 'dark' | 'paper';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, tone = 'paper', ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-ui border px-3 text-sm transition placeholder:text-current/40 focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-45',
        tone === 'paper'
          ? 'border-ink/25 bg-paper-warm text-ink shadow-inset'
          : 'border-panel-border/70 bg-panel-elevated text-paper-warm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const HelpText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs leading-5 text-ink-muted', className)} {...props} />
));
HelpText.displayName = 'HelpText';
