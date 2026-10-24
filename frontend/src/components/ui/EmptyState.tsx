import type { LucideIcon } from 'lucide-react';
import type React from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary recovery action, e.g. clearing filters or retrying. */
  action?: React.ReactNode;
  /** Secondary hint rendered below the action. */
  footNote?: React.ReactNode;
  className?: string;
}

/**
 * One empty/zero-state pattern for the whole app.
 *
 * Search results, favourites, compare and dashboard lists all use this so a
 * "nothing here yet" moment always offers a way forward instead of a bare
 * sentence in the middle of the page.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  footNote,
  className = '',
}) => (
  <div
    className={`rounded-card border border-line bg-surface p-8 text-center shadow-card sm:p-10 ${className}`}
  >
    {Icon && (
      <span className="ev-medallion mx-auto mb-4 h-11 w-11">
        <Icon className="h-5 w-5 text-brand-soft-ink" aria-hidden="true" />
      </span>
    )}
    <h2 className="ev-card-title text-ink">{title}</h2>
    {description && (
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
    )}
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    {footNote && <p className="mt-4 text-xs leading-relaxed text-ink-subtle">{footNote}</p>}
  </div>
);

export default EmptyState;
