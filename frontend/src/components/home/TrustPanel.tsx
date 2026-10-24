import type React from 'react';
import { Link } from 'react-router-dom';
import { Database, HeartHandshake, Lock, Wrench } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import Badge from '../ui/Badge';

interface TrustPanelProps {
  /** True when the UI is showing the bundled sample catalogue. */
  isDemo?: boolean;
}

const PILLARS = [
  {
    icon: Database,
    title: 'Where the data comes from',
    body: 'Station records are served by the Afterglow API from its own SQLite database. Pricing, power and availability are the values in that record — they are not scraped or invented.',
  },
  {
    icon: Wrench,
    title: 'What works end to end',
    body: 'Search, server-side filters, map and list views, station details, reviews, bookings with conflict checks, profile, vehicles and a ledger-backed demo wallet.',
  },
  {
    icon: HeartHandshake,
    title: 'What is simulated',
    body: 'Bookings and wallet activity are simulated and labelled as such. No connector is physically reserved, no operator is notified, and no payment is processed.',
  },
  {
    icon: Lock,
    title: 'What stays on your device',
    body: 'Favourites and recently viewed stations live in this browser’s local storage. There is no card data, no third-party analytics and no advertising tracker.',
  },
];

/**
 * Trust and transparency.
 *
 * The product deliberately refuses to claim live-network status it cannot
 * support. This section states the data path, the simulated surfaces and the
 * privacy posture in the same place, so the demo boundaries are not buried in
 * a footer disclaimer.
 */
const TrustPanel: React.FC<TrustPanelProps> = ({ isDemo = false }) => (
  <section aria-labelledby="trust-heading">
    <SectionHeading
      eyebrow="Trust and transparency"
      title="Clear about what this product can and cannot do"
      description="Afterglow is a working full-stack build, not a live charging network. These are the boundaries."
      action={
        <Badge tone={isDemo ? 'warning' : 'success'} dot>
          {isDemo ? 'Sample catalogue active' : 'API-backed catalogue'}
        </Badge>
      }
      id="trust-heading"
    />

    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      {PILLARS.map((pillar) => (
        <div key={pillar.title} className="rounded-card border border-line bg-surface p-5 shadow-card">
          <span className="ev-medallion h-9 w-9">
            <pillar.icon className="h-4 w-4 text-brand-soft-ink" aria-hidden="true" />
          </span>
          <h3 className="ev-card-title mt-3 text-ink">{pillar.title}</h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">{pillar.body}</p>
        </div>
      ))}
    </div>

    <div className="mt-4 flex flex-col gap-2 rounded-card border border-line bg-surface-muted px-5 py-4 text-xs leading-relaxed text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
      <p>
        {isDemo
          ? 'The API is unreachable right now, so the finder is showing the bundled sample catalogue. Every surface that uses it says so.'
          : 'The API is answering, so station records come from the project database rather than bundled samples.'}
      </p>
      <p className="shrink-0 text-ink-muted">
        Full detail:{' '}
        <Link to="/about" className="underline underline-offset-2 hover:text-ink">
          About the data
        </Link>
      </p>
    </div>
  </section>
);

export default TrustPanel;
