import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Zap } from 'lucide-react';
import Button from '../ui/Button';
import ButtonLink from '../ui/ButtonLink';
import Wordmark from '../ui/Wordmark';

const EXPLORE = [
  { name: 'Find stations', href: '/search' },
  { name: 'Compare stations', href: '/compare' },
  { name: 'Membership', href: '/membership' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
];

const ACCOUNT = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Bookings', href: '/bookings' },
  { name: 'Wallet', href: '/wallet' },
  { name: 'Profile', href: '/profile' },
];

type BrandIconProps = { className?: string };

const FacebookIcon = ({ className }: BrandIconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1Z" />
  </svg>
);

const XIcon = ({ className }: BrandIconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.5 3h3l-6.6 7.6L21.8 21h-5.9l-4.3-5.6L6.4 21h-3l7-8.1L2.6 3h6l3.9 5.1L17.5 3Zm-1 16h1.7L7.6 4.7H5.8L16.5 19Z" />
  </svg>
);

const InstagramIcon = ({ className }: BrandIconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const LinkedInIcon = ({ className }: BrandIconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.5 8.5H3.4V21h3.1V8.5ZM5 3a1.9 1.9 0 1 0 0 3.8A1.9 1.9 0 0 0 5 3Zm6.2 5.5H8.2V21h3v-6.6c0-1.8.8-2.7 2.1-2.7 1.2 0 1.8.8 1.8 2.7V21h3.1v-7.3c0-3.1-1.6-4.6-3.9-4.6-1.7 0-2.6.9-3 1.6V8.5Z" />
  </svg>
);

const SOCIALS = [
  { name: 'Facebook', href: 'https://facebook.com/afterglow', icon: FacebookIcon },
  { name: 'X', href: 'https://twitter.com/afterglow', icon: XIcon },
  { name: 'Instagram', href: 'https://instagram.com/afterglow', icon: InstagramIcon },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/afterglow', icon: LinkedInIcon },
];

const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubscribe = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(
      email.trim()
        ? 'Thanks — this demo records the address on this page only. No email is sent.'
        : 'Add an email address first.',
    );
  };

  return (
    <footer className="mt-16 border-t border-line bg-deep">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Closing call to action */}
        <div className="grid gap-5 border-b border-white/10 py-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="ev-label">Ready when you are</p>
            <h2 className="ev-title mt-2 max-w-xl text-deep-ink">
              Your next charge is one search away.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-deep-ink-muted">
              Compare connectors, power and price before you plug in — then keep every session in
              one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink to="/search" variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Find a station
            </ButtonLink>
            <ButtonLink to="/membership" variant="glass" size="lg">
              See membership
            </ButtonLink>
          </div>
        </div>

        <div className="grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr] lg:gap-10">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Afterglow home">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-on-accent">
                <Zap className="h-4 w-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              </span>
              <Wordmark className="text-[1.2rem] text-deep-ink" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-deep-ink-muted">
              Afterglow helps EV drivers find, compare and book charging sessions — without
              guesswork at the plug.
            </p>

            <div className="mt-6 flex gap-2">
              {SOCIALS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Afterglow on ${social.name}`}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-deep-ink-muted transition-colors hover:border-brand/60 hover:text-deep-ink"
                >
                  <social.icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Explore">
            <h3 className="text-sm font-semibold text-deep-ink">Explore</h3>
            <ul className="mt-4 space-y-2.5">
              {EXPLORE.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-deep-ink-muted transition-colors hover:text-deep-ink"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h3 className="text-sm font-semibold text-deep-ink">Account</h3>
            <ul className="mt-4 space-y-2.5">
              {ACCOUNT.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-deep-ink-muted transition-colors hover:text-deep-ink"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-semibold text-deep-ink">Charging notes, occasionally</h3>
            <p className="mt-3 text-sm leading-relaxed text-deep-ink-muted">
              New stations, connector guides and product updates. No spam.
            </p>
            <form onSubmit={handleSubscribe} className="mt-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="footer-email" className="sr-only">
                  Email address
                </label>
                <div className="relative flex-1">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-deep-ink-muted/70"
                    aria-hidden="true"
                  />
                  <input
                    id="footer-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="h-10 w-full rounded-control border border-white/15 bg-white/[0.04] pl-9 pr-4 text-sm text-deep-ink placeholder:text-deep-ink-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                  />
                </div>
                <Button type="submit" variant="primary" size="md" className="sm:px-5">
                  Subscribe
                </Button>
              </div>
              {message && (
                <p role="status" className="mt-2 text-xs leading-relaxed text-deep-ink-muted">
                  {message}
                </p>
              )}
            </form>

            <p className="mt-5 text-sm text-deep-ink-muted">
              <a
                href="mailto:support@afterglow.app"
                className="transition-colors hover:text-deep-ink"
              >
                support@afterglow.app
              </a>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-deep-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Afterglow. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
            Demo build — station, booking and wallet data are simulated.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
