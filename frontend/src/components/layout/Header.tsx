import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';
import ButtonLink from '../ui/ButtonLink';
import ThemeToggle from '../ui/ThemeToggle';
import Wordmark from '../ui/Wordmark';

const NAV_LINKS = [
  { name: 'Find stations', href: '/search' },
  { name: 'Compare', href: '/compare' },
  { name: 'Membership', href: '/membership' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

const ACCOUNT_LINKS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Bookings', href: '/bookings', icon: CalendarDays },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'Profile', href: '/profile', icon: User },
];

const Header: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  const handleLogout = async () => {
    setAccountOpen(false);
    await logout();
    navigate('/');
  };

  const initials = (user?.name || 'Driver')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-full focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Afterglow home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-on-accent shadow-[0_6px_18px_-10px_rgb(198_255_0/0.85)]">
            <Zap className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
          </span>
          <Wordmark className="text-[1.18rem] text-ink" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`relative rounded-full px-3.5 py-1.5 text-[0.875rem] font-medium transition-colors ${
                isActive(link.href)
                  ? 'text-ink'
                  : 'text-ink-muted hover:bg-band-fill hover:text-ink'
              }`}
            >
              {link.name}
              {isActive(link.href) && (
                <span
                  className="absolute inset-x-3.5 bottom-0 h-px bg-brand"
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {isAuthenticated && user ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-left transition-colors hover:border-line-strong"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-[0.7rem] font-bold text-brand-soft-ink">
                  {initials}
                </span>
                <span className="max-w-[8.5rem] truncate text-sm font-medium text-ink">
                  {user.name}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-ink-subtle transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-60 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-card-hover"
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-subtle">{user.email}</p>
                      <p className="mt-2 inline-flex rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-soft-ink">
                        {user.membershipLevel} plan
                      </p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    {ACCOUNT_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        role="menuitem"
                        className="flex items-center gap-2.5 rounded-control px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                      >
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        {item.name}
                      </Link>
                    ))}
                    <div className="my-1 h-px bg-line" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm text-error-ink transition-colors hover:bg-error-soft"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink to="/signup" variant="primary" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>

        {/* Below `lg` the nav collapses, so the theme switch moves into the
            bar next to the menu button instead of disappearing with it. */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-surface-muted"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-line bg-canvas lg:hidden"
          >
            <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6">
              <nav className="flex flex-col" aria-label="Mobile">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    className={`border-b border-line/70 py-3.5 text-[0.95rem] font-medium transition-colors ${
                      isActive(link.href) ? 'text-brand' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>

              {isAuthenticated && user ? (
                <div className="mt-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-soft-ink">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-subtle">
                        {user.membershipLevel} plan
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ACCOUNT_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink-muted"
                      >
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    className="mt-3"
                    leftIcon={<LogOut className="h-4 w-4" />}
                    onClick={handleLogout}
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <ButtonLink to="/login" variant="ghost" size="md" fullWidth>
                    Sign in
                  </ButtonLink>
                  <ButtonLink to="/signup" variant="primary" size="md" fullWidth>
                    Get started
                  </ButtonLink>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
