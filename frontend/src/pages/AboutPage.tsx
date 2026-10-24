import React from 'react';
import {
  ArrowRight,
  BatteryCharging,
  CalendarCheck,
  Database,
  Gauge,
  Info,
  Lock,
  MapPin,
  PlugZap,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import SectionHeading from '../components/ui/SectionHeading';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import ButtonLink from '../components/ui/ButtonLink';
import Badge from '../components/ui/Badge';
import { useCatalogCounts } from '../hooks/useStationCatalog';

const CAPABILITIES = [
  {
    icon: Search,
    title: 'Discover',
    body: 'Search by city, postcode or station name, then narrow by connector standard, charging speed, availability, network and amenities. List and map views share the same results.',
    to: '/search',
    action: 'Open the finder',
  },
  {
    icon: Gauge,
    title: 'Compare',
    body: 'Put up to three stations side by side on peak power, connectors, price, session fee, amenities and opening hours — read from the same records the finder uses.',
    to: '/compare',
    action: 'Compare stations',
  },
  {
    icon: CalendarCheck,
    title: 'Plan and record',
    body: 'Create a booking against a station record, review it in your account and keep a wallet ledger of simulated charging sessions.',
    to: '/membership',
    action: 'See membership',
  },
];

const DATA_RULES = [
  {
    icon: Database,
    title: 'One catalogue, one source',
    body: 'Station records come from the Afterglow API and its SQLite database. The homepage counts, city list, featured stations and finder results are all derived from that same catalogue.',
  },
  {
    icon: Info,
    title: 'Availability is reported, not live',
    body: 'The connector counts on a station page are the values stored in its record. Nothing in this build polls an operator’s network, so treat “available” as a snapshot rather than a guarantee.',
  },
  {
    icon: ShieldCheck,
    title: 'No sponsored placement',
    body: 'Results are ordered by the sort you choose. There is no paid ranking, no promoted pin and no commission on a booking.',
  },
  {
    icon: Lock,
    title: 'Local choices stay local',
    body: 'Favourites, recently viewed stations and your theme preference live in this browser’s storage. There is no advertising tracker or third-party analytics script.',
  },
];

const AboutPage: React.FC = () => {
  const { stations, connectorStandards, cities, source, isLoading } = useCatalogCounts();
  const isDemo = source === 'demo';

  const metrics = [
    { label: 'Stations in the catalogue', value: isLoading ? '—' : String(stations) },
    { label: 'Connector standards', value: isLoading ? '—' : String(connectorStandards) },
    { label: 'Cities represented', value: isLoading ? '—' : String(cities) },
  ];

  return (
    <div>
      <PageHero
        eyebrow="About Afterglow"
        title="A charging platform that is honest about its edges"
        description="Afterglow is a working full-stack product for finding, comparing and booking EV charging. It is not a charging network, and it does not pretend to have live operator data."
      />

      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'About' }]} />

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start" aria-labelledby="mission-heading">
          <div>
            <p className="ev-label">Why it exists</p>
            <h2 id="mission-heading" className="ev-title mt-2 text-ink">
              Charging should be a decision, not a gamble
            </h2>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-muted">
              Most range anxiety is really information anxiety: will the connector fit, is the
              charger fast enough, what will the session cost, and is the site open when you
              arrive? Afterglow brings those answers into one place before you leave.
            </p>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">
              The product is built around the station record: power, plug standards, price, hours,
              amenities and the connector counts reported for that site. Where a field is missing,
              the interface says so instead of filling the gap with a plausible number.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <ButtonLink to="/search" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Find a station
              </ButtonLink>
              <ButtonLink to="/signup" variant="ghost" size="md">
                Create an account
              </ButtonLink>
            </div>
          </div>

          <dl className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <dt className="ev-label">Measured right now</dt>
              <Badge tone={isDemo ? 'warning' : 'success'} dot>
                {isDemo ? 'Sample catalogue' : 'API-backed'}
              </Badge>
            </div>
            <div className="mt-4 divide-y divide-line">
              {metrics.map((metric) => (
                <div key={metric.label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <dt className="text-sm text-ink-muted">{metric.label}</dt>
                  <dd className="ev-figure text-[1.7rem] text-ink">{metric.value}</dd>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
              {isDemo
                ? 'The API is unreachable, so these figures describe the bundled sample catalogue. The interface labels every surface that falls back to it.'
                : 'These figures are counted from the live station catalogue, not from a marketing spreadsheet.'}
            </p>
          </dl>
        </section>

        <section className="mt-12" aria-labelledby="capabilities-heading">
          <SectionHeading
            id="capabilities-heading"
            eyebrow="What you can do"
            title="Three jobs, end to end"
            description="Each capability below is wired to the backend that exists in this build. None of it is a mock-up screen."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-card"
              >
                <span className="ev-medallion h-9 w-9">
                  <capability.icon className="h-4 w-4 text-brand-soft-ink" aria-hidden="true" />
                </span>
                <h3 className="ev-card-title mt-3 text-ink">{capability.title}</h3>
                <p className="mt-1.5 flex-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                  {capability.body}
                </p>
                <ButtonLink
                  to={capability.to}
                  variant="ghost"
                  size="sm"
                  className="mt-4 self-start"
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  {capability.action}
                </ButtonLink>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mt-12 rounded-panel border border-line bg-surface-muted p-6 sm:p-8"
          aria-labelledby="data-heading"
        >
          <SectionHeading
            id="data-heading"
            eyebrow="Data and trust"
            title="How the information is handled"
            description="Four rules the interface follows everywhere, including on the station pages and in the finder."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {DATA_RULES.map((rule) => (
              <div key={rule.title} className="rounded-card border border-line bg-surface p-4">
                <h3 className="ev-card-title flex items-center gap-2 text-ink">
                  <rule.icon className="h-4 w-4 text-brand" aria-hidden="true" />
                  {rule.title}
                </h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">{rule.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 lg:grid-cols-2" aria-labelledby="simulated-heading">
          <div className="rounded-card border border-warning/25 bg-warning-soft/40 p-5 shadow-card">
            <h2 id="simulated-heading" className="ev-card-title flex items-center gap-2 text-ink">
              <BatteryCharging className="h-4 w-4 text-warning-ink" aria-hidden="true" />
              What is simulated
            </h2>
            <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-ink-muted">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                Bookings are recorded in the project database and checked for time conflicts, but no
                operator is notified and no physical connector is held.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                Wallet top-ups and charging sessions are ledger entries in demo mode. No card is
                charged and no payment processor is connected.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                Membership pricing is illustrative. Upgrade actions stay disabled until billing is
                genuinely configured.
              </li>
            </ul>
          </div>

          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="ev-card-title flex items-center gap-2 text-ink">
              <Wallet className="h-4 w-4 text-brand" aria-hidden="true" />
              How the build is put together
            </h2>
            <dl className="mt-3 space-y-2.5 text-[0.8125rem] leading-relaxed">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-ink-subtle">Interface</dt>
                <dd className="text-ink-muted">React, TypeScript, Vite and Tailwind CSS</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-ink-subtle">API</dt>
                <dd className="text-ink-muted">Node.js and Express with JWT sessions</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-ink-subtle">Storage</dt>
                <dd className="text-ink-muted">SQLite in development, seeded with sample stations</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-ink-subtle">Maps</dt>
                <dd className="text-ink-muted">Leaflet with OpenStreetMap tiles — no tracking key required</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <ButtonLink to="/contact" variant="outline" size="sm" leftIcon={<PlugZap className="h-3.5 w-3.5" />}>
                Ask about the data
              </ButtonLink>
              <ButtonLink to="/membership" variant="ghost" size="sm">
                Compare plans
              </ButtonLink>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="coverage-heading">
          <div className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="ev-label">Coverage</p>
              <h2 id="coverage-heading" className="ev-title mt-2 max-w-lg text-ink">
                The directory grows with the catalogue
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
                Cities and counts on the homepage are generated from station records, so this page
                never advertises coverage the finder cannot serve.
              </p>
            </div>
            <ButtonLink to="/search" size="lg" rightIcon={<MapPin className="h-4 w-4" />}>
              Browse by city
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
