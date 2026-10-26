import type React from 'react';

type AmbientVariant = 'hero' | 'section' | 'deep';

interface AmbientGlowProps {
  variant?: AmbientVariant;
  className?: string;
}

/**
 * Ambient light field behind a section.
 *
 * Deliberately cheap: plain radial gradients (no blur filter, no backdrop
 * filter, no canvas) on an inert, `pointer-events: none` layer, so nothing here
 * can intercept a click and the browser only has one paint plus an optional
 * slow transform. Intensity stays far below the contrast budget of the text on
 * top of it, and `prefers-reduced-motion` freezes the drift in index.css.
 */
const AmbientGlow: React.FC<AmbientGlowProps> = ({ variant = 'section', className = '' }) => {
  if (variant === 'hero') {
    return (
      <div className={`ev-ambient ${className}`} aria-hidden="true">
        <span className="ev-glow ev-glow--drift left-[-18%] top-[-40%] h-[46rem] w-[46rem] opacity-90" />
        <span className="ev-glow--deep right-[-12%] top-[10%] h-[34rem] w-[34rem] opacity-70" />
        <span className="ev-glow bottom-[-30%] left-[28%] h-[26rem] w-[26rem] opacity-40" />
      </div>
    );
  }

  if (variant === 'deep') {
    return (
      <div className={`ev-ambient ${className}`} aria-hidden="true">
        <span className="ev-glow--deep ev-glow--drift right-[-20%] top-[-30%] h-[40rem] w-[40rem] opacity-80" />
        <span className="ev-glow bottom-[-34%] left-[-10%] h-[32rem] w-[32rem] opacity-50" />
      </div>
    );
  }

  return (
    <div className={`ev-ambient ${className}`} aria-hidden="true">
      <span className="ev-glow ev-glow--drift left-[-14%] top-[-24%] h-[30rem] w-[30rem] opacity-70" />
      <span className="ev-glow--deep right-[-16%] bottom-[-36%] h-[32rem] w-[32rem] opacity-60" />
    </div>
  );
};

export default AmbientGlow;
