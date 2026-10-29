/**
 * Shared button styling.
 *
 * `Button` (a real `<button>`) and `ButtonLink` (a real `<a>` for navigation)
 * both build their classes here, so a link that looks like a button can never
 * drift from the button it stands in for — and we never nest an interactive
 * control inside another one.
 */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'destructive'
  | 'gradient'
  | 'glass';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

const BASE =
  'inline-flex items-center justify-center whitespace-nowrap font-semibold rounded-full ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-canvas disabled:opacity-45 disabled:cursor-not-allowed ' +
  'active:translate-y-px';

const VARIANTS: Record<ButtonVariant, string> = {
  // The one saturated action colour on the site.
  // The hover glow is the only place the accent is allowed to bloom.
  primary:
    'bg-brand text-on-accent shadow-[0_12px_30px_-12px_rgb(198_255_0/0.45)] ' +
    'hover:bg-brand-strong hover:shadow-[0_16px_38px_-12px_rgb(198_255_0/0.6)]',
  gradient:
    'bg-brand text-on-accent shadow-[0_12px_30px_-12px_rgb(198_255_0/0.45)] ' +
    'hover:bg-brand-strong hover:shadow-[0_16px_38px_-12px_rgb(198_255_0/0.6)]',
  // Quiet, elevated secondary.
  secondary: 'bg-surface-muted text-ink border border-line-strong hover:bg-line hover:border-line-hover',
  ghost: 'bg-transparent text-ink border border-line-strong hover:bg-surface-muted hover:border-brand/60',
  // Sits on the dark hero/footer bands: band tokens keep it a translucent white
  // lift in the dark theme and a tinted-ink lift once the bands turn light.
  glass: 'bg-band-fill-strong border border-band-line-xl text-ink hover:bg-band-line-xl',
  outline: 'bg-transparent border border-brand/55 text-brand hover:bg-brand-soft hover:border-brand',
  danger: 'bg-error text-on-error hover:brightness-95',
  destructive: 'bg-error-soft text-error-ink border border-error/35 hover:bg-error/20',
};

// Payoneer's buttons sit around 9px vertical padding with a wide horizontal
// rhythm. These keep the generous marketing CTAs and the denser toolbars on
// the same scale.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[0.8125rem] gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-7 text-[0.9375rem] gap-2',
  xl: 'h-14 px-8 text-base gap-2.5',
  icon: 'h-10 w-10 p-0',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
}
