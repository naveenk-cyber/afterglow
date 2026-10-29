import type React from 'react';
import Backdrop from './Backdrop';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Extra content below the copy: disclosures, plan state, calls to action. */
  children?: React.ReactNode;
  /** Narrower text column for content-heavy pages. */
  align?: 'left' | 'center';
}

/**
 * Page header for everything that is not the homepage.
 *
 * Replaces the per-page gradient banners that each used a different hue. It
 * shares the deep navy band and the emerald accent with the homepage hero, so
 * the product reads as one system from page to page.
 */
const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  title,
  description,
  children,
  align = 'left',
}) => (
  <section className="relative overflow-hidden border-b border-line bg-deep text-deep-ink">
    <div className={`ev-grid ${align === 'center' ? 'ev-grid--center' : ''}`} aria-hidden="true" />
    <Backdrop variant="hero" />

    <div
      className={`relative mx-auto max-w-[1280px] px-4 py-9 sm:px-6 sm:py-11 lg:px-8 ${
        align === 'center' ? 'text-center' : ''
      }`}
    >
      {eyebrow && (
        <p
          className={`inline-flex items-center gap-2 rounded-full border border-deep-line bg-band-fill px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-brand-on-deep ${
            align === 'center' ? 'mx-auto' : ''
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand-on-deep" aria-hidden="true" />
          {eyebrow}
        </p>
      )}

      <h1
        className={`ev-title mt-4 max-w-3xl text-deep-ink ${align === 'center' ? 'mx-auto' : ''}`}
      >
        {title}
      </h1>

      {description && (
        <p
          className={`mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-deep-ink-muted ${
            align === 'center' ? 'mx-auto' : ''
          }`}
        >
          {description}
        </p>
      )}

      {children && <div className="mt-5">{children}</div>}
    </div>
  </section>
);

export default PageHero;
