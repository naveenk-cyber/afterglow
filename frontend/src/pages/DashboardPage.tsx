import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Battery,
  CalendarDays,
  Car,
  DollarSign,
  Gauge,
  Heart,
  MapPin,
  Settings,
  Sparkles,
  Star,
  Timer,
  Zap,
} from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Badge from '../components/ui/Badge';
import ButtonLink from '../components/ui/ButtonLink';
import EmptyState from '../components/ui/EmptyState';
import { RowsSkeleton } from '../components/ui/Skeleton';
import StationMap from '../components/common/StationMap';
import { AreaChart, BarsChart, DonutChart } from '../components/charts/Charts';
import { useAuth } from '../hooks/useAuth';
import { useStationCatalog } from '../hooks/useStationCatalog';
import { userService } from '../services/api';
import type { SeriesPoint } from '../data/sampleSessions';
import type { UserAnalytics } from '../types';
import { formatDate, formatPrice } from '../utils/helpers';

type RangeDays = 7 | 30 | 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(iso: string) {
  const date = new Date(iso);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Bucket the API's daily aggregates for the chart width. The API owns the date
 * filtering; this only groups its real rows so a 90-day range stays readable
 * on a phone. Empty buckets are genuine zeroes, not fabricated sessions.
 */
function buildSeries(analytics: UserAnalytics, days: RangeDays) {
  const bucketDays = days === 90 ? 7 : days === 30 ? 2 : 1;
  const bucketCount = Math.ceil(days / bucketDays);
  const rangeEnd = analytics.rangeEnd ?? new Date().toISOString();
  const end = utcDayStart(rangeEnd) + DAY_MS;
  const start = end - bucketCount * bucketDays * DAY_MS;

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = start + index * bucketDays * DAY_MS;
    return {
      start: bucketStart,
      label: dayLabel(bucketStart),
      sessions: 0,
      energy: 0,
      spend: 0,
    };
  });

  for (const row of analytics.dailyUsage ?? []) {
    const timestamp = Date.parse(`${row.date}T00:00:00Z`);
    const index = Math.floor((timestamp - start) / (bucketDays * DAY_MS));
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.sessions += row.sessions;
    bucket.energy += row.energyConsumed;
    bucket.spend += row.cost;
  }

  const toSeries = (pick: (bucket: (typeof buckets)[number]) => number): SeriesPoint[] =>
    buckets.map((bucket) => ({
      label: bucket.label,
      value: Math.round(pick(bucket) * 10) / 10,
      date: new Date(bucket.start).toISOString(),
    }));

  return {
    activity: toSeries((bucket) => bucket.sessions),
    energy: toSeries((bucket) => bucket.energy),
    spendSeries: toSeries((bucket) => bucket.spend),
  };
}

/** Last six calendar months, including months with no stored sessions. */
function monthlySpend(analytics: UserAnalytics) {
  const stored = new Map((analytics.monthlyUsage ?? []).map((row) => [row.month, row.cost]));
  const cursor = new Date(analytics.rangeEnd ?? Date.now());
  const buckets: { label: string; value: number }[] = [];

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      label: date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }),
      value: Math.round((stored.get(key) ?? 0) * 100) / 100,
    });
  }

  return buckets;
}

const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const CONNECTOR_COLORS = [
  'var(--color-brand)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-ink-muted)',
  'var(--color-error)',
];

const percent = (current: number, previous: number) => {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

const Delta: React.FC<{ value: number | null; label: string }> = ({ value, label }) => {
  if (value === null) {
    return <span className="text-xs text-ink-subtle">No previous period to compare</span>;
  }
  const Icon = value === 0 ? ArrowRight : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value > 0 ? '+' : ''}
      {value}% {label}
    </span>
  );
};

interface KpiProps {
  label: string;
  value: string;
  icon: typeof Zap;
  delta: number | null;
  deltaLabel: string;
  hint: string;
}

const Kpi: React.FC<KpiProps> = ({ label, value, icon: Icon, delta, deltaLabel, hint }) => (
  <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[0.8125rem] font-medium text-ink-muted">{label}</p>
      <span className="ev-medallion h-8 w-8 shrink-0">
        <Icon className="h-4 w-4 text-brand-soft-ink" aria-hidden="true" />
      </span>
    </div>
    <p className="ev-figure mt-2 text-[1.85rem] leading-none text-ink">{value}</p>
    <p className="mt-2">
      <Delta value={delta} label={deltaLabel} />
    </p>
    <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{hint}</p>
  </div>
);

const EMPTY_SERIES = { activity: [], energy: [], spendSeries: [] };

const DashboardPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { data } = useStationCatalog();
  const [range, setRange] = useState<RangeDays>(30);

  const analyticsQuery = useQuery({
    queryKey: ['analytics', range],
    queryFn: () => userService.getAnalytics(range),
    enabled: Boolean(user),
  });
  const analytics = analyticsQuery.data;

  const catalog = useMemo(() => data?.stations ?? [], [data]);
  const series = useMemo(
    () => (analytics ? buildSeries(analytics, range) : EMPTY_SERIES),
    [analytics, range],
  );
  const months = useMemo(() => (analytics ? monthlySpend(analytics) : []), [analytics]);

  const current = {
    sessions: analytics?.totalSessions ?? 0,
    energyKwh: analytics?.totalEnergyConsumed ?? 0,
    spend: analytics?.totalCost ?? 0,
    avgDuration: analytics?.averageDurationMinutes ?? 0,
    perWeek: analytics?.sessionsPerWeek ?? 0,
    connectors: analytics?.connectorUsage ?? [],
    ...series,
  };
  const previous = {
    sessions: analytics?.previousPeriod?.totalSessions ?? 0,
    energyKwh: analytics?.previousPeriod?.totalEnergyConsumed ?? 0,
    spend: analytics?.previousPeriod?.totalCost ?? 0,
    avgDuration: analytics?.previousPeriod?.averageDurationMinutes ?? 0,
    perWeek: analytics?.previousPeriod?.sessionsPerWeek ?? 0,
  };

  const upcoming = analytics?.upcomingBookings ?? [];
  const recent = (analytics?.recentSessions ?? []).slice(0, 6);
  const lastMonth = months[months.length - 1]?.value ?? 0;
  const favouriteStations = analytics?.favoriteStations ?? [];

  const nearby = catalog.slice(0, 5);
  const mapCenter = nearby[0]
    ? { latitude: nearby[0].latitude, longitude: nearby[0].longitude }
    : undefined;

  const connectorSlices = current.connectors.slice(0, 5).map((entry, index) => ({
    label: entry.label,
    value: entry.value,
    color: CONNECTOR_COLORS[index % CONNECTOR_COLORS.length],
  }));

  const isLoading = authLoading || analyticsQuery.isPending;

  return (
    <div>
      <PageHero eyebrow="Analytics" title={`Welcome back, ${user?.name ?? 'driver'}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone="brand" dot>
            Your account data
          </Badge>
          <p className="max-w-2xl text-sm leading-relaxed text-deep-ink-muted">
            Every figure is computed from bookings and simulated charging sessions stored in your
            account. Energy and cost are estimates, not meter readings.
          </p>
        </div>
      </PageHero>

      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Dashboard' }]} />
          <div
            role="group"
            aria-label="Analytics date range"
            className="inline-flex rounded-full border border-line bg-surface p-1"
          >
            {RANGES.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setRange(option.days)}
                aria-pressed={range === option.days}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  range === option.days
                    ? 'bg-brand text-on-accent'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <RowsSkeleton rows={4} className="mt-6" />
        ) : analyticsQuery.isError || !analytics ? (
          <div
            role="alert"
            className="mt-6 rounded-card border border-error/30 bg-error-soft px-4 py-4 text-sm text-error-ink"
          >
            <p>
              We could not load your analytics.{' '}
              {analyticsQuery.error instanceof Error ? analyticsQuery.error.message : ''}
            </p>
            <button
              type="button"
              onClick={() => analyticsQuery.refetch()}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi
                label="Charging sessions"
                value={String(current.sessions)}
                icon={Zap}
                delta={percent(current.sessions, previous.sessions)}
                deltaLabel={`vs previous ${range} days`}
                hint="Completed simulated sessions in this range."
              />
              <Kpi
                label="Energy consumed"
                value={`${current.energyKwh.toLocaleString()} kWh`}
                icon={Battery}
                delta={percent(current.energyKwh, previous.energyKwh)}
                deltaLabel="vs previous period"
                hint="Sum of delivered energy in the range."
              />
              <Kpi
                label="Charging spend"
                value={formatPrice(current.spend)}
                icon={DollarSign}
                delta={percent(current.spend, previous.spend)}
                deltaLabel="vs previous period"
                hint="Computed from each station's price record."
              />
              <Kpi
                label="Average duration"
                value={`${current.avgDuration} min`}
                icon={Timer}
                delta={percent(current.avgDuration, previous.avgDuration)}
                deltaLabel="vs previous period"
                hint="Mean session length, not idle time."
              />
              <Kpi
                label="Charging frequency"
                value={`${current.perWeek}/wk`}
                icon={Gauge}
                delta={percent(current.perWeek, previous.perWeek)}
                deltaLabel="vs previous period"
                hint="Sessions per week across the range."
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <section
                className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5 lg:col-span-2"
                aria-labelledby="activity-heading"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 id="activity-heading" className="ev-card-title text-ink">
                      Charging activity
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      Sessions per {range === 7 ? 'day' : range === 30 ? 'two days' : 'week'}
                    </p>
                  </div>
                  <Badge tone="warning">Simulated</Badge>
                </div>
                <div className="mt-4">
                  <AreaChart data={current.activity} unit="sessions" height={180} />
                </div>
              </section>

              <section
                className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
                aria-labelledby="connectors-heading"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="connectors-heading" className="ev-card-title text-ink">
                    Connector usage
                  </h2>                  <Badge tone="warning">Simulated</Badge>
                </div>

                <div className="mt-4">
                  <DonutChart data={connectorSlices} totalLabel="sessions" />
                </div>
              </section>

              <section
                className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
                aria-labelledby="energy-heading"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="energy-heading" className="ev-card-title text-ink">
                    Energy delivered
                  </h2>
                  <span className="text-xs text-ink-subtle">kWh</span>
                </div>
                <div className="mt-4">
                  <BarsChart
                    data={current.energy}
                    unit="kWh"
                    height={170}
                    valueFormat={(value) => `${value.toLocaleString()} kWh`}
                  />
                </div>
              </section>

              <section
                className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
                aria-labelledby="spend-heading"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="spend-heading" className="ev-card-title text-ink">
                    Charging spend
                  </h2>
                  <span className="text-xs text-ink-subtle">USD</span>
                </div>
                <div className="mt-4">
                  <BarsChart
                    data={current.spendSeries}
                    unit="spend"
                    height={170}
                    accent="var(--color-success)"
                    valueFormat={(value) => formatPrice(value)}
                  />
                </div>
              </section>

              <section
                className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
                aria-labelledby="monthly-heading"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="monthly-heading" className="ev-card-title text-ink">
                    Monthly spend
                  </h2>
                  <span className="text-xs text-ink-subtle">Last 6 months</span>
                </div>
                <p className="ev-figure mt-2 text-[1.6rem] text-ink">{formatPrice(lastMonth)}</p>
                <p className="text-xs text-ink-subtle">this month, from stored sessions</p>
                <ul className="mt-3 divide-y divide-line">
                  {[...months].reverse().map((month) => (
                    <li key={month.label} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="text-ink-muted">{month.label}</span>
                      <span className="font-medium text-ink">{formatPrice(month.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.65fr_1fr] lg:items-start">
              <div className="min-w-0 space-y-6">
                <section aria-labelledby="recent-heading">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 id="recent-heading" className="ev-title text-ink">
                        Recent sessions
                      </h2>
                      <p className="mt-1 text-sm text-ink-muted">
                        Charging sessions stored in your account, most recent first.
                      </p>
                    </div>
                    <Badge tone="warning">Simulated</Badge>
                  </div>

                  {recent.length === 0 ? (
                    <EmptyState
                      className="mt-4"
                      icon={Zap}
                      title="No sessions in this range"
                      description="Try a longer date range, or open the finder to plan a charging stop."
                      action={<ButtonLink to="/search">Find stations</ButtonLink>}
                    />
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface shadow-card">
                      <table className="w-full min-w-[40rem] border-collapse text-left">
                        <caption className="sr-only">
                          Your simulated charging sessions, most recent first
                        </caption>
                        <thead>
                          <tr className="border-b border-line bg-surface-muted text-[0.7rem] uppercase tracking-[0.1em] text-ink-subtle">
                            <th scope="col" className="px-4 py-2.5 font-semibold">
                              Station
                            </th>
                            <th scope="col" className="px-4 py-2.5 font-semibold">
                              Date
                            </th>
                            <th scope="col" className="px-4 py-2.5 font-semibold">
                              Duration
                            </th>
                            <th scope="col" className="px-4 py-2.5 font-semibold">
                              Energy
                            </th>
                            <th scope="col" className="px-4 py-2.5 font-semibold">
                              Cost
                            </th>
                            <th scope="col" className="px-4 py-2.5 font-semibold">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {recent.map((session) => (
                            <tr key={session.id} className="border-b border-line/70 last:border-0">
                              <td className="px-4 py-3">
                                <Link
                                  to={`/sessions/${session.id}`}
                                  className="text-sm font-medium text-ink underline-offset-2 hover:text-brand hover:underline"
                                >
                                  {session.station?.name ?? 'Station unavailable'}
                                </Link>
                                <p className="mt-0.5 text-xs text-ink-subtle">
                                  {session.station
                                    ? session.station.city || session.station.address
                                    : 'Station record unavailable'}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">
                                {formatDate(session.startedAt, 'date')}
                              </td>
                              <td className="px-4 py-3 text-xs text-ink-muted">
                                {session.durationMinutes === null ? 'Active' : `${session.durationMinutes} min`}
                              </td>
                              <td className="px-4 py-3 text-xs text-ink-muted">
                                {session.energyKwh} kWh
                              </td>
                              <td className="px-4 py-3 text-xs text-ink">
                                {formatPrice(session.cost)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={session.status === 'active' ? 'brand' : 'success'}>
                                  {session.status === 'active' ? 'Active' : 'Completed'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="mt-2 text-xs text-ink-subtle">
                    Session details are read-only summaries unless you start a labelled simulation
                    on the session page.
                  </p>
                </section>

                <section aria-labelledby="upcoming-heading">
                  <div className="flex items-end justify-between gap-3">
                    <h2 id="upcoming-heading" className="ev-title text-ink">
                      Upcoming
                    </h2>
                    <ButtonLink to="/bookings" variant="ghost" size="sm">
                      All bookings
                    </ButtonLink>
                  </div>
                  {upcoming.length === 0 && (
                    <p className="mt-4 rounded-card border border-dashed border-line bg-surface-muted px-4 py-5 text-sm leading-relaxed text-ink-muted">
                      No upcoming bookings.{' '}
                      <Link
                        to="/search"
                        className="font-medium text-ink underline underline-offset-2 hover:text-brand"
                      >
                        Find a station
                      </Link>
                      {' '}to plan your next simulated stop.
                    </p>
                  )}

                  {upcoming.length > 0 && (
                    <ul className="mt-4 space-y-3">
                      {upcoming.map((booking) => (
                        <li
                          key={booking.id}
                          className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="warning">Simulated reservation</Badge>
                              <Badge tone="brand">{booking.status}</Badge>
                              <span className="text-xs text-ink-subtle">
                                {formatDate(booking.startTime, 'datetime')}
                              </span>
                            </div>
                            <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                              {booking.station?.name ?? 'Station unavailable'}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {booking.duration} min · {booking.connectorType} ·{' '}
                              {booking.station
                                ? booking.station.city || booking.station.address
                                : 'Station record unavailable'}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <ButtonLink
                              to={`/station/${booking.stationId}`}
                              variant="ghost"
                              size="sm"
                            >
                              View station
                            </ButtonLink>
                            <ButtonLink to="/bookings" variant="outline" size="sm">
                              Manage
                            </ButtonLink>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <aside className="min-w-0 space-y-4" aria-label="Account shortcuts">
                <section
                  className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
                  aria-labelledby="nearby-map-heading"
                >
                  <div className="flex items-center justify-between gap-2 p-4 pb-3">
                    <div>
                      <h2 id="nearby-map-heading" className="ev-card-title text-ink">
                        Nearby stations
                      </h2>
                      <p className="text-xs text-ink-subtle">
                        Five catalogue records · seeded demo coordinates
                      </p>
                    </div>
                    <ButtonLink to="/search?view=map" variant="ghost" size="sm">
                      Map
                    </ButtonLink>
                  </div>
                  {nearby.length > 0 ? (
                    <StationMap
                      stations={nearby}
                      center={mapCenter}
                      height="210px"
                      compact
                      emptyMessage="No station coordinates to plot."
                    />
                  ) : (
                    <p className="px-4 pb-4 text-sm text-ink-muted">
                      The catalogue is empty, so there is nothing to plot.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 p-4">
                    <ButtonLink to="/search" variant="primary" size="sm" fullWidth>
                      <MapPin className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Search stations
                    </ButtonLink>
                  </div>
                </section>

                <section
                  className="rounded-card border border-line bg-surface p-4 shadow-card"
                  aria-labelledby="favourites-heading"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 id="favourites-heading" className="ev-card-title text-ink">
                      Saved stations
                    </h2>
                    <Heart className="h-4 w-4 text-brand" aria-hidden="true" />
                  </div>

                  {favouriteStations.length === 0 ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      Nothing saved yet. Use the heart on a station card to keep it here.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-line">
                      {favouriteStations.slice(0, 4).map((station) => (
                        <li key={station.id}>
                          <Link
                            to={`/station/${station.id}`}
                            className="flex items-start justify-between gap-3 py-2.5 text-sm transition-colors hover:text-brand"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-ink">
                                {station.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-ink-subtle">
                                {station.city || station.address}
                              </span>
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                              <Star className="h-3 w-3 text-star" aria-hidden="true" />
                              {station.reviewCount > 0 ? station.rating.toFixed(1) : 'New'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ButtonLink to="/search" variant="ghost" size="sm" className="mt-2">
                    Browse all stations
                  </ButtonLink>
                </section>

                <section className="rounded-card border border-line bg-surface p-4 shadow-card" aria-labelledby="shortcuts-heading">
                  <h2 id="shortcuts-heading" className="ev-card-title text-ink">
                    Quick actions
                  </h2>
                  <div className="mt-3 space-y-2">
                    <ButtonLink to="/search" variant="ghost" size="sm" fullWidth className="justify-start">
                      <MapPin className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Find nearby stations
                    </ButtonLink>
                    <ButtonLink to="/bookings" variant="ghost" size="sm" fullWidth className="justify-start">
                      <CalendarDays className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Review bookings
                    </ButtonLink>
                    <ButtonLink to="/profile" variant="ghost" size="sm" fullWidth className="justify-start">
                      <Car className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Manage vehicles
                    </ButtonLink>
                    <ButtonLink to="/profile" variant="ghost" size="sm" fullWidth className="justify-start">
                      <Settings className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Account settings
                    </ButtonLink>
                  </div>
                </section>

                <section className="rounded-card border border-line bg-surface-muted p-4">
                  <h2 className="ev-card-title flex items-center gap-2 text-ink">
                    <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
                    {user?.membershipLevel ?? 'Free'} plan
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                    Membership pricing is illustrative; billing is not connected in this build.
                  </p>
                  <ButtonLink to="/membership" variant="outline" size="sm" className="mt-3">
                    Compare plans
                  </ButtonLink>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
