import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Battery,
  CalendarDays,
  Clock,
  MapPin,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Scale,
  Timer,
  Zap,
} from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ButtonLink from '../components/ui/ButtonLink';
import EmptyState from '../components/ui/EmptyState';
import { RowsSkeleton } from '../components/ui/Skeleton';
import { bookingService } from '../services/api';
import { formatDate, formatPrice } from '../utils/helpers';

/** One simulated minute per tick, so a 45-minute session is watchable. */
const TICK_MS = 600;

const SessionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const sessionQuery = useQuery({
    queryKey: ['session', id],
    queryFn: () => bookingService.getSession(id as string),
    enabled: Boolean(id),
    retry: false,
  });
  const session = sessionQuery.data;

  const targetMinutes = session?.durationMinutes ?? 45;
  // Prefer the connector actually used for the session. Falling back to the
  // station's peak power would overstate a slow-session estimate.
  const sessionConnector = session?.station?.connectorTypes.find(
    (connector) => connector.type === session.connectorType,
  );
  const maxPower =
    sessionConnector?.maxPower ??
    session?.station?.connectorTypes.reduce((max, connector) => Math.max(max, connector.maxPower), 0) ??
    0;
  const energyTarget =
    session && session.energyKwh > 0
      ? session.energyKwh
      : Number((Math.min(maxPower, 150) * (targetMinutes / 60) * 0.6).toFixed(1));
  const pricePerKwh = session?.station?.pricing.perKwh ?? 0;

  const [running, setRunning] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setElapsedMinutes((current) => {
        const next = Math.min(current + 1, targetMinutes);
        if (next >= targetMinutes) setRunning(false);
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running, targetMinutes]);

  // Route changes should not carry a running timer into another session.
  useEffect(() => {
    setRunning(false);
    setElapsedMinutes(0);
  }, [id]);

  if (sessionQuery.isPending) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-10 sm:px-6 lg:px-8">
        <RowsSkeleton rows={5} />
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={Zap}
          title="Session not available"
          description={
            sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : 'This session does not exist or belongs to another account.'
          }
          action={
            <>
              <Button variant="primary" onClick={() => sessionQuery.refetch()}>
                Try again
              </Button>
              <ButtonLink to="/dashboard">Back to dashboard</ButtonLink>
              <ButtonLink to="/search" variant="ghost">
                Find stations
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  const progress = Math.min(100, Math.round((elapsedMinutes / targetMinutes) * 100));
  const simulated = elapsedMinutes > 0;
  const deliveredEnergy = Number(((progress / 100) * energyTarget).toFixed(1));
  const simulatedCost = Number((deliveredEnergy * pricePerKwh).toFixed(2));
  const reachedEnd = elapsedMinutes >= targetMinutes;

  return (
    <div>
      <PageHero
        eyebrow="Charging session"
        title={session.station?.name ?? 'Charging session'}
        description={`${formatDate(session.startedAt, 'datetime')} · ${
          session.durationMinutes === null ? 'in progress' : `${session.durationMinutes} minutes`
        } · ${session.connectorType}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning" dot>
            Simulated session
          </Badge>
          <Badge tone={session.status === 'completed' ? 'success' : 'brand'}>
            {session.status === 'completed' ? 'Completed' : 'Active'}
          </Badge>
          <span className="text-sm text-deep-ink-muted">
            Stored with your account. Simulated — not recorded from a vehicle.
          </span>
        </div>
      </PageHero>

      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Session' },
            ]}
          />
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="space-y-6">
            <section
              className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6"
              aria-labelledby="summary-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="summary-heading" className="ev-title text-ink">
                  Session summary
                </h2>
                {session.station && (
                  <ButtonLink to={`/station/${session.station.id}`} variant="ghost" size="sm">
                    Station details
                  </ButtonLink>
                )}
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  {
                    label: 'Duration',
                    value: session.durationMinutes === null ? 'In progress' : `${session.durationMinutes} min`,
                    icon: Clock,
                  },
                  {
                    label: 'Energy',
                    value:
                      session.status === 'completed' ? `${session.energyKwh} kWh` : 'Still charging',
                    icon: Battery,
                  },
                  {
                    label: 'Cost',
                    value:
                      session.status === 'completed' ? formatPrice(session.cost) : 'Not charged yet',
                    icon: Zap,
                  },
                  {
                    label: 'Connector',
                    value: `${session.connectorType} · ${maxPower} kW`,
                    icon: Scale,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-card border border-line bg-surface-muted p-3.5">
                    <dt className="flex items-center gap-1.5 text-xs text-ink-subtle">
                      <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
                Costs use the price stored with the station record. Energy, duration and cost are
                simulated estimates, not meter readings.
              </p>
            </section>

            <section
              className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6"
              aria-labelledby="simulation-heading"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="simulation-heading" className="ev-title text-ink">
                    Session simulation
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    A clearly labelled UI simulation — no charger is connected, controlled or
                    reserved. Each tick advances one simulated minute.
                  </p>
                </div>
                <Badge tone="warning">Simulation</Badge>
              </div>

              <div className="mt-5 rounded-card border border-line bg-surface-muted p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="ev-figure text-[2.4rem] leading-none text-ink">
                    {String(elapsedMinutes).padStart(2, '0')}
                    <span className="ml-1 font-sans text-sm font-medium text-ink-subtle">min</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    {elapsedMinutes} of {targetMinutes} simulated minutes
                  </p>
                </div>

                <div
                  className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label="Simulated charging progress"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <dt className="text-xs text-ink-subtle">Delivered</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink">{deliveredEnergy} kWh</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-subtle">Simulated cost</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink">
                      {formatPrice(simulatedCost)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-subtle">Progress</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-ink">{progress}%</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => setRunning((current) => !current)}
                    disabled={reachedEnd}
                    leftIcon={
                      running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />
                    }
                  >
                    {running ? 'Pause' : reachedEnd ? 'Complete' : simulated ? 'Resume' : 'Start'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setRunning(false);
                      setElapsedMinutes(0);
                    }}
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                  >
                    Reset
                  </Button>
                  <span aria-live="polite" className="text-xs text-ink-subtle">
                    {reachedEnd
                      ? 'Simulation complete — nothing was charged.'
                      : running
                        ? 'Simulation running.'
                        : simulated
                          ? 'Simulation paused.'
                          : 'Simulation not started.'}
                  </span>
                </div>

                <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-ink" aria-hidden="true" />
                  This timer is a UI demonstration only. It does not talk to a charge point and
                  cannot start, stop or bill a physical session.
                </p>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {session.station ? (
            <section className="rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="ev-card-title text-ink">Station</h2>
              <Link
                to={`/station/${session.station.id}`}
                className="mt-2 block text-sm font-semibold text-ink underline-offset-2 hover:text-brand hover:underline"
              >
                {session.station.name}
              </Link>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {session.station.address}
              </p>
              <p className="mt-2 text-xs text-ink-subtle">
                {session.station.operator || 'Operator not listed'} ·{' '}
                {session.station.operatingHours.isOpen24Hours ? 'Open 24 hours' : 'Hours vary'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink
                  to={`https://www.openstreetmap.org/?mlat=${session.station.latitude}&mlon=${session.station.longitude}#map=16/${session.station.latitude}/${session.station.longitude}`}
                  variant="ghost"
                  size="sm"
                  leftIcon={<Navigation className="h-3.5 w-3.5" />}
                >
                  Directions
                </ButtonLink>
                <ButtonLink
                  to={`/compare?ids=${session.station.id}`}
                  variant="ghost"
                  size="sm"
                  leftIcon={<Scale className="h-3.5 w-3.5" />}
                >
                  Compare
                </ButtonLink>
              </div>
            </section>
            ) : (
              <p className="rounded-card border border-dashed border-line bg-surface-muted px-4 py-3 text-xs leading-relaxed text-ink-subtle">
                The station record for this session is no longer in the catalogue.
              </p>
            )}

            <section className="rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="ev-card-title flex items-center gap-2 text-ink">
                <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
                Timing
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Started</dt>
                  <dd className="text-right text-ink">
                    {formatDate(session.startedAt, 'datetime')}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Ended</dt>
                  <dd className="text-right text-ink">
                    {session.endedAt ? formatDate(session.endedAt, 'datetime') : 'In progress'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-ink-muted">
                    <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                    Duration
                  </dt>
                  <dd className="text-ink">
                    {session.durationMinutes === null ? 'In progress' : `${session.durationMinutes} min`}
                  </dd>
                </div>
              </dl>
            </section>

            <p className="rounded-card border border-line bg-surface-muted px-4 py-3 text-xs leading-relaxed text-ink-subtle">
              This record belongs to your account and is visible only to you. It is a simulated
              charging session — it never controlled or billed a physical charger.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailPage;
