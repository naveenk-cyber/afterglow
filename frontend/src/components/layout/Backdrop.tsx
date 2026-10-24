import type React from 'react';

type BackdropVariant = 'hero' | 'band' | 'deep';

interface BackdropProps {
  variant?: BackdropVariant;
  className?: string;
}

/**
 * Decorative layer behind a section.
 *
 * Adapted from the reference theme's backdrop vocabulary — a blurred gradient
 * bubble in one corner plus concentric halo rings that rotate very slowly — but
 * rebuilt from Afterglow's tokens, so it picks up the emerald accent and flips
 * with the theme. Everything here is `aria-hidden` and non-interactive, and the
 * reduced-motion block in `index.css` stops the rotation.
 */
const Backdrop: React.FC<BackdropProps> = ({ variant = 'band', className = '' }) => {
  if (variant === 'hero') {
    return (
      <div className={`ev-backdrop ${className}`} aria-hidden="true">
        <span className="ev-bubble -top-[8rem] -right-[10rem]" />
        <span className="ev-halo-ring w-[36rem] -top-[14rem] -right-[11rem]" />
        <span className="ev-halo-ring ev-halo-ring--slow w-[20rem] -bottom-[10rem] -left-[7rem]" />
      </div>
    );
  }

  if (variant === 'deep') {
    return (
      <div className={`ev-backdrop ${className}`} aria-hidden="true">
        <span className="ev-halo-glow w-[40rem] -top-[18rem] -right-[10rem]" />
        <span className="ev-halo-ring ev-halo-ring--slow w-[34rem] -bottom-[16rem] -left-[10rem]" />
      </div>
    );
  }

  return (
    <div className={`ev-backdrop ${className}`} aria-hidden="true">
      <span className="ev-bubble -bottom-[16rem] -left-[14rem]" />
      <span className="ev-halo-ring w-[30rem] -top-[13rem] -right-[8rem]" />
    </div>
  );
};

export default Backdrop;
