import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_NAME } from '../utils/constants';

/**
 * Human-readable titles for every top-level route. Keeping the list here (and
 * not in each page) means a new screen picks up a title by adding one line.
 * Patterns use `react-router` syntax; the first match wins.
 */
const ROUTE_TITLES: { path: string; title: string }[] = [
  { path: '/', title: 'Find EV charging stations near you' },
  { path: '/search', title: 'Search charging stations' },
  { path: '/station/:id', title: 'Station details' },
  { path: '/compare', title: 'Compare charging stations' },
  { path: '/bookings', title: 'My bookings' },
  { path: '/sessions/:id', title: 'Charging session' },
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/wallet', title: 'Wallet' },
  { path: '/profile', title: 'Profile and vehicles' },
  { path: '/membership', title: 'Membership plans' },
  { path: '/about', title: 'About Afterglow' },
  { path: '/contact', title: 'Contact' },
  { path: '/login', title: 'Sign in' },
  { path: '/signup', title: 'Create your account' },
  { path: '/forgot-password', title: 'Reset your password' },
  { path: '/reset-password', title: 'Choose a new password' },
  { path: '/auth/callback', title: 'Signing in with Google' },
];

/** Split a path pattern into literal segments and `:param` placeholders. */
function matchesRoute(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(':') || part === pathParts[index]);
}

/** Keep `document.title` in sync with the active route. */
export function useDocumentTitle(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = ROUTE_TITLES.find((route) => matchesRoute(route.path, pathname));
    document.title = match ? `${match.title} · ${APP_NAME}` : `Page not found · ${APP_NAME}`;
  }, [pathname]);
}
