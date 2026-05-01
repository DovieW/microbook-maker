import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-ui text-sm font-semibold transition duration-150 focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'bg-brass text-paper-warm shadow-brass hover:bg-brass-bright hover:text-ink active:translate-y-px',
        secondary:
          'border border-panel-border/70 bg-panel-elevated text-paper-warm hover:border-brass/70 hover:text-brass-bright',
        ghost:
          'text-ink-muted hover:bg-paper/10 hover:text-paper-warm dark:text-ink-muted',
        paper:
          'border border-ink/20 bg-paper text-ink shadow-inset hover:bg-paper-warm',
        danger:
          'bg-danger text-white hover:bg-danger/85',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-5 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
