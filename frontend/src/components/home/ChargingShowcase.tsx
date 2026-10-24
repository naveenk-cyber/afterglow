import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Image as ImageIcon, MousePointer2, Zap } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const ChargingScene = React.lazy(() => import('../three/ChargingScene'));

function supportsWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

/** Keeps a WebGL failure inside this section instead of the whole page. */
class SceneBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneFallback({ message }: { message: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-deep">
      <img
        src="/assets/hero-charging.jpg"
        alt="Electric vehicle charging connector plugged into a car"
        className="h-full w-full object-cover opacity-80"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" />
      <p className="absolute bottom-4 left-4 right-4 max-w-sm text-xs leading-relaxed text-deep-ink-muted">
        {message}
      </p>
    </div>
  );
}

/**
 * Interactive charging showcase.
 *
 * The 3D bundle is a separate lazy chunk that only mounts once the section is
 * near the viewport. Devices without WebGL, and visitors who prefer reduced
 * motion, get the existing charging photograph instead of an animated canvas.
 */
const ChargingShowcase: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [webgl] = useState(supportsWebGL);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [photoMode, setPhotoMode] = useState(false);
  const [charging, setCharging] = useState(true);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const usePhoto = photoMode || !webgl;

  return (
    <section ref={sectionRef} aria-labelledby="showcase-heading">
      <SectionHeading
        id="showcase-heading"
        eyebrow="Charging, visualised"
        title="Watch the handshake, not just the plug"
        description="A charging session is a conversation between car, cable and charger. This illustrative scene shows the connection and the energy flowing through it."
        action={
          <Badge tone={charging ? 'brand' : 'neutral'} dot>
            {charging ? 'Charging view' : 'Idle view'}
          </Badge>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="relative h-[320px] overflow-hidden rounded-panel border border-line bg-deep sm:h-[440px]">
          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
            <Badge tone="deep">Illustrative 3D</Badge>
            {prefersReducedMotion && <Badge tone="deep">Reduced motion</Badge>}
          </div>

          {usePhoto ? (
            <SceneFallback
              message={
                photoMode
                  ? 'Photo view enabled. Switch back to the 3D scene to orbit the model.'
                  : 'This device or browser does not expose WebGL, so the charging photograph is shown instead.'
              }
            />
          ) : visible ? (
            <SceneBoundary
              fallback={<SceneFallback message="The 3D scene could not start, so a photograph is shown instead." />}
            >
              <Suspense
                fallback={<SceneFallback message="Preparing the interactive scene…" />}
              >
                <ChargingScene
                  charging={charging}
                  animate={!prefersReducedMotion}
                  autoRotate={!prefersReducedMotion}
                />
              </Suspense>
            </SceneBoundary>
          ) : (
            <SceneFallback message="Preparing the interactive scene…" />
          )}

          {!usePhoto && (
            <p className="pointer-events-none absolute bottom-3 left-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] text-deep-ink-muted">
              <MousePointer2 className="h-3 w-3" aria-hidden="true" />
              Drag to orbit · scroll to zoom
            </p>
          )}
        </div>

        <div className="flex flex-col justify-between gap-5 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
          <div>
            <h3 className="ev-card-title text-ink">Control the connection</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Toggle the charging state to see the cable pulse and the charger display change. The
              vehicle is a stylised model — not a specific production car — and no real charger is
              connected.
            </p>

            <div
              role="group"
              aria-label="Charging state"
              className="mt-4 inline-flex rounded-full border border-line bg-surface-muted p-1"
            >
              <button
                type="button"
                onClick={() => setCharging(true)}
                aria-pressed={charging}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  charging ? 'bg-brand text-on-accent' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Charging
              </button>
              <button
                type="button"
                onClick={() => setCharging(false)}
                aria-pressed={!charging}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  !charging ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Idle
              </button>
            </div>

            <ul className="mt-5 space-y-2.5 text-[0.8125rem] leading-relaxed text-ink-muted">
              <li className="flex gap-2.5">
                <Box className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                Procedural geometry, loaded as a separate chunk only when it scrolls into view.
              </li>
              <li className="flex gap-2.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                Motion stops for reduced-motion preferences; unsupported devices fall back to a
                photograph.
              </li>
              <li className="flex gap-2.5">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                No external models, textures, audio or remote assets are downloaded.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setPhotoMode((value) => !value)}>
              {photoMode ? 'Use 3D view' : 'Use photo view'}
            </Button>
            <Link
              to="/search"
              className="text-xs font-medium text-brand underline-offset-2 hover:underline"
            >
              Find a real station
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChargingShowcase;
