import { Check } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import './motion-preview.css';

export function ApplyButton({
  successSerial,
  children = 'Apply',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { successSerial: number }) {
  const complete = successSerial > 0;

  return (
    <button {...props} aria-label={typeof children === 'string' ? children : props['aria-label']}>
      <span className={`apply-feedback${complete ? ' is-complete' : ''}`} aria-hidden="true">
        {complete ? <Check size={18} /> : children}
      </span>
      {complete && (
        <span className="sr-only" role="status">
          Applied
        </span>
      )}
    </button>
  );
}
