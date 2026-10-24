import type React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  /** Omit on the final crumb: the current page is not a link. */
  to?: string;
}

/** Accessible breadcrumb trail. The last item is marked `aria-current="page"`. */
const Breadcrumbs: React.FC<{ items: Crumb[]; className?: string }> = ({
  items,
  className = '',
}) => (
  <nav aria-label="Breadcrumb" className={className}>
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="rounded text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className="text-ink">
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 text-ink-subtle" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default Breadcrumbs;
