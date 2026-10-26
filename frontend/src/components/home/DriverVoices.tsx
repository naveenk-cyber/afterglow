import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, Info, MessageSquareQuote, PlugZap, Scale, Wallet } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';

interface Principle {
  icon: typeof Clock;
  label: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}

/**
 * What the product actually does, stated as capabilities.
 *
 * Afterglow has no customer testimonials: the only first-party text real users
 * have written is station reviews, which live on each station page. This
 * section therefore publishes capability statements — every one verifiable in
 * the app — instead of inventing quotes, ratings or customer counts.
 */
const PRINCIPLES: Principle[] = [
  {
    icon: Clock,
    label: 'Before you leave',
    title: 'Know the wait before the drive',
    body:
      'Free connectors out of the total installed, per connector standard, on every station record. No estimate is dressed up as live telemetry.',
    href: '/search',
    cta: 'Open the finder',
  },
  {
    icon: Scale,
    label: 'Side by side',
    title: 'Compare on the numbers that cost money',
    body:
      'Peak power, price per kWh, session fees and connector counts compared from the same catalogue — no scores, no sponsored placement.',
    href: '/compare',
    cta: 'Compare stations',
  },
  {
    icon: PlugZap,
    label: 'At the plug',
    title: 'Filter by the plug you actually own',
    body:
      'CCS, Tesla/NACS, CHAdeMO, J1772 and Type 2, with charging speed and availability filters applied server-side.',
    href: '/search?connector=CCS',
    cta: 'Filter by connector',
  },
  {
    icon: Wallet,
    label: 'After the session',
    title: 'One record instead of five apps',
    body:
      'Bookings, simulated sessions and wallet entries stay with your account, so the next trip starts from history rather than guesswork.',
    href: '/dashboard',
    cta: 'See the dashboard',
  },
];

const DriverVoices: React.FC = () => (
  <section aria-labelledby="driver-voices-heading" className="relative">
    <SectionHeading
      id="driver-voices-heading"
      eyebrow="Early access"
      title="Built for drivers who value their time"
      description="Afterglow is in early access. Rather than publish quotes nobody said, here is what the product does today — each card is a capability you can check yourself."
      action={
        <Link
          to="/search"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-strong"
        >
          Try it on a station
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
    />

    <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PRINCIPLES.map((principle) => (
        <li key={principle.title} className="h-full">
          <Link
            to={principle.href}
            className="ev-hover-glow group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-brand/20 bg-brand-soft text-brand-soft-ink">
                <principle.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink-muted">
                {principle.label}
              </span>
            </div>

            <h3 className="ev-card-title mt-4 text-ink">{principle.title}</h3>
            <p className="mt-2 flex-1 text-[0.85rem] leading-relaxed text-ink-muted">
              {principle.body}
            </p>

            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              {principle.cta}
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>

    <div className="mt-4 flex flex-col gap-3 rounded-card border border-line bg-surface-sunken p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        <span>
          <span className="font-semibold text-ink">No testimonials are published yet.</span> The only
          notes written by real users are station reviews; they appear with their author on the
          station page they belong to.
        </span>
      </p>
      <Link
        to="/search"
        className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand transition-colors hover:text-brand-strong"
      >
        <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
        Read or write a station note
      </Link>
    </div>
  </section>
);

export default DriverVoices;
