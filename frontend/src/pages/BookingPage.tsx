import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar, Clock, MapPin, Plus, Search, Zap } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { RowsSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { ApiError, bookingService, stationService } from '../services/api';
import type { Booking } from '../types';
import { formatDate, formatPrice } from '../utils/helpers';

const PAGE_SIZE = 20;
const DURATIONS = [30, 45, 60, 90, 120];

const STATUS_TONES = {
  pending: 'warning',
  confirmed: 'brand',
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
} as const;

const inputClass =
  'h-11 w-full rounded-control border border-line bg-surface-muted px-3.5 text-sm text-ink ' +
  'transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25';

/** Local date-time value accepted by <input type="datetime-local">. */
function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function estimateSession(maxPower: number, durationMinutes: number, pricePerKwh = 0, sessionFee = 0) {
  // Mirrors the backend's documented estimate: power × hours × 90% efficiency.
  const energy = Math.round(maxPower * (durationMinutes / 60) * 0.9 * 10) / 10;
  const cost = Math.round((energy * pricePerKwh + sessionFee) * 100) / 100;
  return { energy, cost };
}

const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const stationId = searchParams.get('stationId');
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [connectorType, setConnectorType] = useState('CCS');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', status, page],
    queryFn: () => bookingService.getBookings(status, page, PAGE_SIZE),
    enabled: isAuthenticated,
  });

  const stationQuery = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => stationService.getStationById(stationId as string),
    enabled: Boolean(stationId) && isAuthenticated,
    retry: false,
  });

  const station = stationQuery.data;

  useEffect(() => {
    if (!station) return;
    const firstConnector = station.connectorTypes[0];
    if (firstConnector && !station.connectorTypes.some((item) => item.type === connectorType)) {
      setConnectorType(firstConnector.type);
    }
  }, [station, connectorType]);

  const selectedConnector = station?.connectorTypes.find(
    (connector) => connector.type === connectorType,
  );
  const estimate = useMemo(
    () =>
      estimateSession(
        selectedConnector?.maxPower ?? 0,
        durationMinutes,
        station?.pricing.perKwh ?? 0,
        station?.pricing.sessionFee ?? 0,
      ),
    [
      selectedConnector?.maxPower,
      durationMinutes,
      station?.pricing.perKwh,
      station?.pricing.sessionFee,
    ],
  );

  const bookings = bookingsQuery.data?.bookings ?? [];
  const visibleBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const needle = searchQuery.trim().toLowerCase();
    return bookings.filter(
      (booking) =>
        booking.station?.name.toLowerCase().includes(needle) ||
        booking.station?.address.toLowerCase().includes(needle),
    );
  }, [bookings, searchQuery]);

  const summary = useMemo(
    () => ({
      total: bookingsQuery.data?.total ?? 0,
      completed: bookings.filter((booking) => booking.status === 'completed').length,
      upcoming: bookings.filter(
        (booking) =>
          ['pending', 'confirmed'].includes(booking.status) &&
          new Date(booking.startTime).getTime() > Date.now(),
      ).length,
      spent: bookings.reduce(
        (sum, booking) => (booking.status === 'completed' ? sum + booking.totalCost : sum),
        0,
      ),
    }),
    [bookings, bookingsQuery.data?.total],
  );

  const refreshBookings = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings'] });
    await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };

  const runAction = async (id: string, action: () => Promise<string>) => {
    setBusyId(id);
    setActionError('');
    setActionMessage('');
    try {
      const message = await action();
      setActionMessage(message);
      await refreshBookings();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'That action could not be completed. Try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const cancelBooking = (id: string) =>
    runAction(id, async () => {
      await bookingService.cancelBooking(id);
      return 'Booking cancelled.';
    });

  const startCharging = (id: string) =>
    runAction(id, async () => {
      await bookingService.startCharging(id);
      return 'Charging session started (simulated — no real hardware is involved).';
    });

  const stopCharging = (id: string) =>
    runAction(id, async () => {
      const result = await bookingService.stopCharging(id);
      const cost = Number(result.chargingCost ?? 0);
      return `Session ended. Estimated cost ${formatPrice(cost)} was deducted from your demo wallet.`;
    });

  const submitBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!station) return;
    setCreateError('');
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) {
      setCreateError('Choose a valid start time.');
      return;
    }
    if (start.getTime() < Date.now()) {
      setCreateError('Choose a start time in the future.');
      return;
    }
    if (!selectedConnector) {
      setCreateError('Choose a connector offered by this station.');
      return;
    }

    setIsCreating(true);
    try {
      await bookingService.createBooking({
        stationId: station.id,
        connectorType: selectedConnector.type,
        startTime: start.toISOString(),
        durationMinutes,
      });
      await refreshBookings();
      setActionMessage(
        'Booking saved in your account. This is a demo reservation — no real station was contacted.',
      );
      navigate('/bookings', { replace: true });
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'The booking could not be saved. Try again.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <RowsSkeleton rows={5} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <Calendar className="mx-auto h-12 w-12 text-ink-subtle" aria-hidden="true" />
        <h1 className="ev-title mt-4 text-ink">Sign in to manage bookings</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Bookings are tied to your Afterglow account so only you can view or change them.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate('/login')}>Sign in</Button>
          <Button variant="ghost" onClick={() => navigate('/search')}>
            Browse stations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="ev-title text-ink">My bookings</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              Plan, review and cancel charging sessions. Reservations are stored in your account
              and simulated — no connector is physically reserved.
            </p>
          </div>
          <Button onClick={() => navigate('/search')} leftIcon={<Plus className="h-4 w-4" />}>
            New booking
          </Button>
        </div>

        {actionMessage && (
          <p
            role="status"
            className="mt-4 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm text-success-ink"
          >
            {actionMessage}
          </p>
        )}
        {actionError && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-card border border-error/30 bg-error-soft px-4 py-3 text-sm text-error-ink"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {actionError}
          </p>
        )}

        {stationId && (
          <section className="mt-6 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="ev-title text-ink">New booking</h2>
              <Badge tone="warning" dot>
                Simulated reservation
              </Badge>
            </div>

            {stationQuery.isPending ? (
              <p className="mt-4 text-sm text-ink-muted">Loading station…</p>
            ) : stationQuery.isError || !station ? (
              <div
                role="alert"
                className="mt-4 rounded-control border border-error/30 bg-error-soft px-4 py-3 text-sm text-error-ink"
              >
                <p>
                  Could not load that station.{' '}
                  {stationQuery.error instanceof ApiError ? stationQuery.error.message : ''}
                </p>
                <button
                  type="button"
                  onClick={() => stationQuery.refetch()}
                  className="mt-2 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <form onSubmit={submitBooking} className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                  <div className="rounded-card border border-line bg-surface-muted p-4">
                    <p className="flex items-start gap-1.5 text-sm font-semibold text-ink">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      {station.name}
                    </p>
                    <p className="mt-1 pl-5 text-xs text-ink-muted">{station.address}</p>
                  </div>

                  <div>
                    <label
                      htmlFor="booking-connector"
                      className="mb-1.5 block text-sm font-medium text-ink"
                    >
                      Connector
                    </label>
                    <select
                      id="booking-connector"
                      value={connectorType}
                      onChange={(event) => setConnectorType(event.target.value)}
                      className={inputClass}
                    >
                      {station.connectorTypes.map((connector) => (
                        <option key={connector.id ?? connector.type} value={connector.type}>
                          {connector.type} · {connector.maxPower} kW ·{' '}
                          {connector.availableCount ?? connector.count} free
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="booking-start"
                      className="mb-1.5 block text-sm font-medium text-ink"
                    >
                      Start time
                    </label>
                    <input
                      id="booking-start"
                      type="datetime-local"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-duration"
                      className="mb-1.5 block text-sm font-medium text-ink"
                    >
                      Duration
                    </label>
                    <input
                      id="booking-duration"
                      type="range"
                      min={30}
                      max={120}
                      step={15}
                      value={durationMinutes}
                      aria-label={`Duration: ${durationMinutes} minutes`}
                      onChange={(event) => setDurationMinutes(Number(event.target.value))}
                      className="w-full accent-[color:var(--color-brand)]"
                    />
                    <div className="mt-1 flex justify-between text-[0.7rem] text-ink-subtle">
                      {DURATIONS.map((minutes) => (
                        <span key={minutes}>{minutes}m</span>
                      ))}
                    </div>
                  </div>
                </div>

                <aside className="rounded-card border border-line bg-surface-muted p-4 sm:p-5">
                  <h3 className="ev-card-title text-ink">Estimate</h3>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    Estimated {estimate.energy} kWh · {formatPrice(estimate.cost)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                    Estimate only — based on {selectedConnector?.maxPower ?? 0} kW, {durationMinutes}{' '}
                    minutes, 90% charging efficiency, and the station&apos;s stored price. Energy
                    and cost are not meter readings.
                  </p>
                  <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
                    This stores a reservation in the Afterglow database only. No real station is
                    contacted and no payment is taken now.
                  </p>

                  {createError && (
                    <p
                      role="alert"
                      className="mt-3 flex items-start gap-2 text-xs text-error-ink"
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {createError}
                    </p>
                  )}

                  <Button type="submit" className="mt-4" fullWidth isLoading={isCreating}>
                    Confirm booking
                  </Button>
                </aside>
              </form>
            )}
          </section>
        )}

        <div className="mt-6 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 md:max-w-md">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <label htmlFor="booking-search" className="sr-only">
                Search bookings
              </label>
              <input
                id="booking-search"
                type="search"
                placeholder="Search station or address"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>

            <div
              role="group"
              aria-label="Booking status"
              className="flex flex-wrap gap-1 rounded-control border border-line bg-surface-muted p-1"
            >
              {[
                { key: 'all', label: 'All' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatus(tab.key);
                    setPage(1);
                  }}
                  aria-pressed={status === tab.key}
                  className={`rounded-[7px] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                    status === tab.key
                      ? 'bg-surface text-brand shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {bookingsQuery.isPending ? (
          <RowsSkeleton rows={4} className="mt-6" />
        ) : bookingsQuery.isError ? (
          <div
            role="alert"
            className="mt-6 rounded-card border border-error/30 bg-error-soft px-4 py-3 text-sm text-error-ink"
          >
            <p>
              Could not load bookings.{' '}
              {bookingsQuery.error instanceof Error ? bookingsQuery.error.message : ''}
            </p>
            <button
              type="button"
              onClick={() => bookingsQuery.refetch()}
              className="mt-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-line bg-surface px-4 py-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-ink-subtle" aria-hidden="true" />
            <h2 className="ev-title mt-3 text-ink">
              {searchQuery ? 'No matching bookings' : 'No bookings yet'}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {searchQuery
                ? `Nothing matches “${searchQuery}”.`
                : 'Find a station to plan your first simulated charging stop.'}
            </p>
            <Link
              to="/search"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-on-accent hover:bg-brand-strong"
            >
              Find a station
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {visibleBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                busy={busyId === booking.id}
                onCancel={() => void cancelBooking(booking.id)}
                onStart={() => void startCharging(booking.id)}
                onStop={() => void stopCharging(booking.id)}
                onStation={() => navigate(`/station/${booking.stationId}`)}
              />
            ))}
          </ul>
        )}

        {bookingsQuery.data && bookingsQuery.data.hasMore && (
          <div className="mt-6 flex justify-center">
            <Button variant="ghost" onClick={() => setPage((current) => current + 1)}>
              Load more bookings
            </Button>
          </div>
        )}

        {bookings.length > 0 && (
          <section className="mt-8 rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="ev-card-title text-ink">Booking summary</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-center md:grid-cols-4">
              {[
                { label: 'On this page', value: String(summary.total) },
                { label: 'Completed', value: String(summary.completed) },
                { label: 'Upcoming', value: String(summary.upcoming) },
                { label: 'Completed spend', value: formatPrice(summary.spent) },
              ].map((item) => (
                <div key={item.label}>
                  <dd className="ev-figure text-xl text-ink">{item.value}</dd>
                  <dt className="mt-1 text-xs text-ink-muted">{item.label}</dt>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
};

interface BookingCardProps {
  booking: Booking;
  busy: boolean;
  onCancel: () => void;
  onStart: () => void;
  onStop: () => void;
  onStation: () => void;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  busy,
  onCancel,
  onStart,
  onStop,
  onStation,
}) => {
  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const canStart = booking.status === 'confirmed';
  const canStop = booking.status === 'active';
  const tone = STATUS_TONES[booking.status] ?? 'neutral';

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onStation}
            className="text-left text-base font-semibold text-ink underline-offset-2 hover:text-brand hover:underline"
          >
            {booking.station?.name ?? 'Station removed'}
          </button>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-muted">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {booking.station?.address ?? 'Address unavailable'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{booking.status}</Badge>
          {booking.simulated && <Badge tone="warning">simulated</Badge>}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="flex items-center gap-1.5 text-ink-muted">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">Date</dt>
          <dd>{formatDate(booking.startTime, 'date')}</dd>
        </div>
        <div className="flex items-center gap-1.5 text-ink-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">Time</dt>
          <dd>
            {formatDate(booking.startTime, 'time')} – {formatDate(booking.endTime, 'time')}
          </dd>
        </div>
        <div className="flex items-center gap-1.5 text-ink-muted">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">Connector and duration</dt>
          <dd>
            {booking.connectorType} · {booking.duration} min
          </dd>
        </div>
        <div className="text-right text-ink sm:text-left">
          <dt className="sr-only">Estimated cost</dt>
          <dd className="font-medium">{formatPrice(booking.totalCost)}</dd>
        </div>
      </dl>

      {typeof booking.energyDelivered === 'number' && (
        <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-muted">
          Delivered: <span className="font-medium text-ink">{booking.energyDelivered} kWh</span> ·
          simulated session
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onStation}>
          View station
        </Button>
        {canCancel && (
          <Button variant="destructive" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        {canStart && (
          <Button variant="secondary" size="sm" onClick={onStart} isLoading={busy}>
            Start charging
          </Button>
        )}
        {canStop && (
          <Button variant="secondary" size="sm" onClick={onStop} isLoading={busy}>
            Stop charging
          </Button>
        )}
      </div>
    </li>
  );
};

export default BookingPage;
