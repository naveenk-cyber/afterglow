import type React from 'react';

/**
 * Small status/label pill.
 *
 * Tones map onto the token palette only, so a badge looks the same in the
 * station finder, the booking list and the wallet — and the same in both
 * themes, because the tones resolve through `--success`, `--warning`, …
 */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'deep';

/**
 * Each tone pairs a soft fill with its matching ink. Writing the saturated
 * status colour directly on the tint measured below 4.5:1 at this size.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted border-line',
  brand: 'bg-brand-soft text-brand-soft-ink border-brand/25',
  success: 'bg-success-soft text-success-ink border-success/30',
  warning: 'bg-warning-soft text-warning-ink border-warning/30',
  danger: 'bg-error-soft text-error-ink border-error/30',
  deep: 'bg-band-fill-strong text-deep-ink border-deep-line',
};

interface BadgeProps {
  tone?: BadgeTone;
  /** Leading dot, used for availability states. */
  dot?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  dot = false,
  icon,
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}
  >
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
    {icon && (
      <span className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" aria-hidden="true">
        {icon}
      </span>
    )}
    {children}
  </span>
);

export default Badge;
