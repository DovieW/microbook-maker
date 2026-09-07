import type React from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
export function Dropdown({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger id={id} aria-label={label} className={`select-trigger ${className}`}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} collisionPadding={12} className="select-menu">
          <Select.ScrollUpButton className="select-scroll">
            <ChevronUp size={14} />
          </Select.ScrollUpButton>
          <Select.Viewport className="select-options">
            {options.map(([id, text]) => (
              <Select.Item value={id} key={id} className="select-option">
                <Select.ItemText>{text}</Select.ItemText>
                <Select.ItemIndicator className="select-check">
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll">
            <ChevronDown size={14} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      {...props}
      className={`icon-button ${props.className || ''}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
