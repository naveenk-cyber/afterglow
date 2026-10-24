import type React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  /** Extra hint shown under the label, e.g. what the filter excludes. */
  hint?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Explicit accessible name when the visible label includes a hint. */
  ariaLabel?: string;
}

/**
 * Single checkbox control for the whole app.
 *
 * The native input is still there (and still keyboard operable) but is
 * visually replaced by a 16px lime-filled square, because the platform control
 * renders as a light-grey square on the near-black canvas and read as a
 * disabled field in the finder toolbar.
 */
const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  children,
  hint,
  disabled = false,
  className = '',
  id,
  ariaLabel,
}) => (
  <label
    className={`group inline-flex cursor-pointer select-none items-start gap-2.5 text-sm text-ink-muted ${
      disabled ? 'cursor-not-allowed opacity-50' : ''
    } ${className}`}
  >
    <input
      id={id}
      type="checkbox"
      className="peer sr-only"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span
      aria-hidden="true"
      className="mt-[2px] grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-line-strong bg-surface-muted text-transparent transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-accent peer-focus-visible:ring-2 peer-focus-visible:ring-brand/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-canvas"
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
    <span className="min-w-0">
      <span className="block leading-snug">{children}</span>
      {hint && <span className="mt-0.5 block text-xs leading-relaxed text-ink-subtle">{hint}</span>}
    </span>
  </label>
);

export default Checkbox;
