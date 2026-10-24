import type React from 'react';

/**
 * Loading placeholders that mirror the real card geometry, so the results grid
 * does not jump when data arrives. The pulse stops for reduced-motion users via
 * the global motion block in `index.css`.
 */
export const StationCardSkeleton: React.FC = () => (
  <div
    className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    aria-hidden="true"
  >
    <div className="aspect-[16/10] w-full animate-pulse bg-surface-muted" />
    <div className="space-y-3 p-4">
      <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-surface-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-sunken" />
      <div className="flex gap-2 pt-1">
        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-surface-muted" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-surface-muted" />
      </div>
      <div className="h-6 w-full animate-pulse rounded-control bg-surface-sunken" />
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-muted" />
    </div>
  </div>
);

export const RowsSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`} aria-busy="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className="h-16 animate-pulse rounded-control border border-line bg-surface-muted"
        aria-hidden="true"
      />
    ))}
  </div>
);
