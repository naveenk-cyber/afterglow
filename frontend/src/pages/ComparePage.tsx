import React, { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Info,
  PlugZap,
  Plus,
  Scale,
  Trash2,
  X,
} from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ButtonLink from '../components/ui/ButtonLink';
import Checkbox from '../components/ui/Checkbox';
import StationStatusBadge from '../components/station/StationStatusBadge';
import { RowsSkeleton } from '../components/ui/Skeleton';
import { useStationCatalog } from '../hooks/useStationCatalog';
import { formatPrice } from '../utils/helpers';
import type { ChargingStation } from '../types';

/** Three is the widest set that still reads as a table on a laptop. */
const MAX_COMPARE = 3;

const CELL = 'border-b border-line px-4 py-3 align-top';
const HEAD_CELL = 'sticky left-0 z-10 bg-surface px-4 py-3 text-left align-top';

interface CompareRow {
  key: string;
  label: string;
  /** Used to decide whether the row differs between stations. */
  value: (station: ChargingStation) => string;
  render: (station: ChargingStation) => React.ReactNode;
}

const peakPower = (station: ChargingStation) =>
  station.connectorTypes.reduce((max, connector) => Math.max(max, connector.maxPower), 0);

const connectorSummary = (station: ChargingStation) =>
  station.connectorTypes
    .map((connector) => `${connector.type} ${connector.maxPower}kW x${connector.count}`)
    .sort()
    .join('|');

const ROWS: CompareRow[] = [
  {
    key: 'operator',
    label: 'Operator',
    value: (station) => station.operator ?? 'Not listed',
    render: (station) => (
      <span className="text-sm text-ink-muted">{station.operator || 'Not listed'}</span>
    ),
  },
  {
    key: 'power',
    label: 'Peak power',
    value: (station) => String(peakPower(station)),
    render: (station) => (
      <span className="text-sm font-medium text-ink">
        {peakPower(station) > 0 ? `${peakPower(station)} kW` : 'Not listed'}
      </span>
    ),
  },
  {
    key: 'connectors',
    label: 'Connectors',
    value: connectorSummary,
    render: (station) =>
      station.connectorTypes.length === 0 ? (
        <span className="text-sm text-ink-subtle">None listed</span>
      ) : (
        <ul className="flex list-none flex-wrap gap-1.5 p-0">
          {[...station.connectorTypes]
            .sort((a, b) => b.maxPower - a.maxPower)
            .map((connector) => (
              <li
                key={connector.id ?? `${connector.type}-${connector.maxPower}`}
                className="inline-flex items-center gap-1 rounded-control border border-line bg-surface-muted px-2 py-1 text-xs text-ink"
              >
                <PlugZap className="h-3 w-3 text-brand" aria-hidden="true" />
                {connector.type}
                <span className="text-ink-subtle">
                  {connector.maxPower} kW · ×{connector.count}
                </span>
              </li>
            ))}
        </ul>
      ),
  },
  {
    key: 'price',
    label: 'Price per kWh',
    value: (station) => String(station.pricing.perKwh ?? 'varies'),
    render: (station) => (
      <span className="text-sm text-ink">
        {station.pricing.perKwh != null ? (
          <>
            {formatPrice(station.pricing.perKwh)}
            <span className="text-ink-subtle"> / kWh</span>
          </>
        ) : (
          <span className="text-ink-subtle">Varies by session</span>
        )}
      </span>
    ),
  },
  {
    key: 'sessionFee',
    label: 'Session fee',
    value: (station) => String(station.pricing.sessionFee ?? 'none'),
    render: (station) => (
      <span className="text-sm text-ink-muted">
        {station.pricing.sessionFee != null ? formatPrice(station.pricing.sessionFee) : 'None listed'}
      </span>
    ),
  },
  {
    key: 'availability',
    label: 'Availability',
    value: (station) =>
      `${station.availability.status}:${station.availability.availableConnectors}/${station.availability.totalConnectors}`,
    render: (station) => (
      <div className="space-y-1.5">
        <StationStatusBadge status={station.availability.status} />
        <p className="text-xs text-ink-subtle">
          {station.availability.availableConnectors} of {station.availability.totalConnectors}{' '}
          connectors listed free
        </p>
      </div>
    ),
  },
  {
    key: 'speed',
    label: 'Charging speed',
    value: (station) => station.chargingSpeed,
    render: (station) => <Badge tone="brand">{station.chargingSpeed}</Badge>,
  },
  {
    key: 'amenities',
    label: 'Amenities',
    value: (station) => [...station.amenities].sort().join('|'),
    render: (station) =>
      station.amenities.length === 0 ? (
        <span className="text-sm text-ink-subtle">Not listed</span>
      ) : (
        <ul className="flex list-none flex-wrap gap-1.5 p-0">
          {station.amenities.slice(0, 5).map((amenity) => (
            <li
              key={amenity}
              className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted"
            >
              {amenity}
            </li>
          ))}
          {station.amenities.length > 5 && (
            <li className="text-xs text-ink-subtle">+{station.amenities.length - 5} more</li>
          )}
        </ul>
      ),
  },
  {
    key: 'hours',
    label: 'Opening hours',
    value: (station) => (station.operatingHours.isOpen24Hours ? '24h' : 'varies'),
    render: (station) => (
      <span className="text-sm text-ink-muted">
        {station.operatingHours.isOpen24Hours ? 'Open 24 hours' : 'Hours vary — check operator'}
      </span>
    ),
  },
  {
    key: 'rating',
    label: 'Rating',
    value: (station) =>
      station.reviewCount > 0 ? `${station.rating}:${station.reviewCount}` : 'none',
    render: (station) => (
      <span className="text-sm text-ink-muted">
        {station.reviewCount > 0
          ? `${station.rating.toFixed(1)} from ${station.reviewCount} review${station.reviewCount === 1 ? '' : 's'}`
          : 'No reviews yet'}
      </span>
    ),
  },
  {
    key: 'data',
    label: 'Data source',
    value: (station) => station.dataSource ?? 'unknown',
    render: (station) => (
      <Badge tone={station.dataSource === 'sample' ? 'warning' : 'neutral'}>
        {station.dataSource === 'sample' ? 'Sample data' : 'Project database'}
      </Badge>
    ),
  },
];

const ComparePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending, isError, refetch } = useStationCatalog();
  const [differencesOnly, setDifferencesOnly] = React.useState(false);

  const catalog = useMemo(() => data?.stations ?? [], [data]);

  const selectedIds = useMemo(() => {
    const raw = searchParams.get('ids') ?? '';
    return [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))].slice(0, MAX_COMPARE);
  }, [searchParams]);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => catalog.find((station) => station.id === id))
        .filter((station): station is ChargingStation => Boolean(station)),
    [catalog, selectedIds],
  );

  const missingIds = catalog.length > 0 ? selectedIds.length - selected.length : 0;

  const writeIds = useCallback(
    (ids: string[]) => {
      const params = new URLSearchParams(searchParams);
      if (ids.length > 0) params.set('ids', ids.join(','));
      else params.delete('ids');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const addStation = (id: string) => {
    if (!id || selectedIds.includes(id) || selectedIds.length >= MAX_COMPARE) return;
    writeIds([...selectedIds, id]);
  };

  const removeStation = (id: string) => writeIds(selectedIds.filter((item) => item !== id));

  const available = catalog.filter((station) => !selectedIds.includes(station.id));

  const visibleRows = useMemo(() => {
    if (!differencesOnly || selected.length < 2) return ROWS;
    return ROWS.filter((row) => new Set(selected.map(row.value)).size > 1);
  }, [differencesOnly, selected]);

  return (
    <div>
      <PageHero
        eyebrow="Comparison"
        title="Compare stations on the facts"
        description="Pick up to three stations and compare power, connectors, price, availability and amenities from the same catalogue the finder uses."
      />

      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[{ label: 'Home', to: '/' }, { label: 'Find stations', to: '/search' }, { label: 'Compare' }]}
        />

        <div className="mt-5 flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <label
              htmlFor="compare-add"
              className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle"
            >
              Add a station
            </label>
            <select
              id="compare-add"
              value=""
              onChange={(event) => addStation(event.target.value)}
              disabled={isPending || selectedIds.length >= MAX_COMPARE || available.length === 0}
              className="h-10 w-full rounded-control border border-line bg-surface-muted px-3 text-sm text-ink transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {selectedIds.length >= MAX_COMPARE
                  ? 'Three stations selected'
                  : 'Choose a station…'}
              </option>
              {available.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                  {station.city ? ` — ${station.city}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Checkbox
              checked={differencesOnly}
              onChange={setDifferencesOnly}
              disabled={selected.length < 2}
            >
              Differences only
            </Checkbox>
            {selectedIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => writeIds([])}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {isError ? (
          <EmptyState
            className="mt-5"
            icon={Info}
            title="The catalogue did not load"
            description="Comparison needs station records. Retry, or browse the finder while the API reconnects."
            action={
              <>
                <Button onClick={() => refetch()}>Try again</Button>
                <ButtonLink to="/search" variant="ghost" size="md">
                  Open the finder
                </ButtonLink>
              </>
            }
          />
        ) : isPending ? (
          <RowsSkeleton rows={5} className="mt-5" />
        ) : selected.length === 0 ? (
          <EmptyState
            className="mt-5"
            icon={Scale}
            title="Nothing selected yet"
            description="Add two or three stations above, or start from the finder and compare from a station page. Values come from the station record, not a score."
            action={
              <ButtonLink to="/search" variant="primary" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Find stations
              </ButtonLink>
            }
            footNote={`You can compare up to ${MAX_COMPARE} stations at once.${missingIds > 0 ? ' Some selected stations are no longer in the catalogue.' : ''}`}
          />
        ) : (
          <>
            <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface shadow-card">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <caption className="sr-only">
                  Comparison of selected Afterglow charging stations
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-muted">
                    <th scope="col" className={HEAD_CELL}>
                      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                        Attribute
                      </span>
                    </th>
                    {selected.map((station) => (
                      <th key={station.id} scope="col" className="px-4 py-3 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to={`/station/${station.id}`}
                              className="line-clamp-2 text-sm font-semibold text-ink underline-offset-2 hover:text-brand hover:underline"
                            >
                              {station.name}
                            </Link>
                            <p className="mt-1 text-xs font-normal text-ink-subtle">
                              {station.city || station.address}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStation(station.id)}
                            aria-label={`Remove ${station.name} from the comparison`}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-ink-subtle transition-colors hover:border-error/40 hover:text-error-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.key} className="even:bg-surface-muted/40">
                      <th scope="row" className={`${CELL} ${HEAD_CELL} w-40 font-normal`}>
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                          {row.label}
                        </span>
                      </th>
                      {selected.map((station) => (
                        <td key={station.id} className={CELL}>
                          {row.render(station)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {differencesOnly && visibleRows.length === 0 && (
              <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                <Plus className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                Every listed attribute matches — turn off “differences only” to see the full table.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {selected.map((station) => (
                  <ButtonLink
                    key={station.id}
                    to={`/station/${station.id}`}
                    variant="outline"
                    size="sm"
                  >
                    View {station.name}
                  </ButtonLink>
                ))}
              </div>
              <p className="max-w-xl text-xs leading-relaxed text-ink-subtle">
                <Info className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Values are read from the station record. Availability is not live telemetry and no
                connector is reserved by this page.
                {selected.some((station) => station.dataSource === 'sample') && (
                  <> Some stations are bundled sample data.</>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
