import type React from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Sticky header height plus breathing room, used to clear the header when a
 * hash target is scrolled into view. Mirrors `scroll-padding-top` in index.css.
 */
const HEADER_OFFSET = 84;

/** Scroll immediately, ignoring the global `scroll-behavior: smooth`. */
function jumpTo(top: number) {
  window.scrollTo({ top, left: 0, behavior: 'instant' as ScrollBehavior });
}

/**
 * Route change scroll handling.
 *
 * React Router swaps the page but leaves the document scroll offset alone, so a
 * link clicked at the bottom of one route opened the next route at the bottom
 * too — the footer "Contact" link landed on the Contact page's footer. Nothing
 * in the app ever reset it.
 *
 * Behaviour:
 * - PUSH/REPLACE: start at the top, or at the hash target when there is one.
 * - POP (back/forward): restore the offset the user left that history entry at.
 * - Query-string-only changes (search filters) never scroll: the user is
 *   editing a form, not navigating.
 */
const ScrollManager: React.FC = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const previous = useRef<{ pathname: string; hash: string } | null>(null);

  // Remember where each history entry was left. Recorded synchronously: a
  // throttled write cancelled by the next navigation would drop the last
  // position, which is exactly the offset back/forward needs to restore.
  useEffect(() => {
    const key = location.key;
    const onScroll = () => positions.current.set(key, window.scrollY);

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.key]);

  useLayoutEffect(() => {
    const isFirstRun = previous.current === null;
    const pathChanged = isFirstRun || previous.current!.pathname !== location.pathname;
    const hashChanged = isFirstRun || previous.current!.hash !== location.hash;
    previous.current = { pathname: location.pathname, hash: location.hash };

    // Filter changes rewrite the query string on the same route; the user is
    // editing a form, so the viewport must stay exactly where it is.
    if (!pathChanged && !hashChanged) return;

    // A first load without a hash belongs to the browser (reload, restored
    // position, or a deep link); there is nothing to correct.
    if (isFirstRun && !location.hash) return;

    if (navigationType === 'POP') {
      const saved = positions.current.get(location.key);
      if (saved != null) {
        // Restore immediately so the offset is right even if frames are
        // throttled, then re-apply once the destination has laid out: a short
        // destination clamps the first attempt, and the second one corrects it.
        jumpTo(saved);
        window.requestAnimationFrame(() => jumpTo(saved));
        return;
      }
    }

    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id);
      if (target) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        window.scrollTo({ top, left: 0, behavior: reduce ? 'instant' : 'smooth' });
        return;
      }
    }

    jumpTo(0);
    // Query-only updates keep the same pathname/hash and must not move the page.
  }, [location.key, location.pathname, location.hash, navigationType]);

  return null;
};

export default ScrollManager;
