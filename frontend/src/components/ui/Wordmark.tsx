import type React from 'react';

interface WordmarkProps {
  /** Size and colour utilities for the whole mark, e.g. `text-lg text-deep-ink`. */
  className?: string;
  /** Use the deep-navy accent instead of the surface one. */
  onDeep?: boolean;
}

/**
 * The Afterglow wordmark.
 *
 * One treatment everywhere it appears: "After" inherits the surrounding ink,
 * "glow" carries the emerald accent. Previously the header and the auth pages
 * rendered it as gradient text while the footer used two colours, so the same
 * logo looked like three different logos.
 */
const Wordmark: React.FC<WordmarkProps> = ({ className = '', onDeep = false }) => (
  <span className={`font-semibold leading-none tracking-[-0.02em] ${className}`}>
    After<span className={onDeep ? 'text-brand-on-deep' : 'text-brand'}>glow</span>
  </span>
);

export default Wordmark;
