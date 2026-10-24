import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Heart,
  Info,
  List,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import SearchBar from '../components/home/SearchBar';
import StationCard from '../components/station/StationCard';
import StationMap from '../components/common/StationMap';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Button from '../components/ui/Button';
import ButtonLink from '../components/ui/ButtonLink';
import Checkbox from '../components/ui/Checkbox';
import EmptyState from '../components/ui/EmptyState';
import { StationCardSkeleton } from '../components/ui/Skeleton';
import { stationService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useStationCatalog } from '../hooks/useStationCatalog';
import type { ChargingSpeed, SearchFilters, SearchSort } from '../types';

const PAGE_SIZE = 12;
const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: 'distance', label: 'Nearest' },
  { value: 'price', label: 'Lowest price' },
  { value: 'rating', label: 'Best rated' },
  { value: 'speed', label: 'Fastest charging' },
  { value: 'availability', label: 'Most connectors free' },
  { value: 'name', label: 'Name (A–Z)' },
];

const CHIP =
  'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

function toggleValue<T extends string>(values: T[] | undefined, value: T): T[] {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { ids: recentIds, clearRecent } = useRecentlyViewed();
  const { data: catalogData } = useStationCatalog();

  const [filters, setFilters] = useState<SearchFilters>(() => {
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    return {
      query: searchParams.get('q') || undefined,
      connectorTypes: searchParams.get('connector') ? [searchParams.get('connector')!] : undefined,
      chargingSpeed: searchParams.get('speed')
        ? [searchParams.get('speed') as ChargingSpeed]
        : undefined,
      availability: searchParams.get('available') === '1' || undefined,
      sort: (searchParams.get('sort') as SearchSort) || 'distance',
      location:
        Number.isFinite(lat) && Number.isFinite(lng) && searchParams.get('lat')
          ? { latitude: lat, longitude: lng, radius: 25 }
          : undefined,
    };
  });
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>(
    searchParams.get('view') === 'map' ? 'map' : 'list',
  );

  useEffect(() => {
    if (!favoriteMessage) return;
    const timer = window.setTimeout(() => setFavoriteMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [favoriteMessage]);

  const { data: meta } = useQuery({
    queryKey: ['stations', 'filter-meta'],
    queryFn: () => stationService.getFilterMeta(),
    staleTime: 1000 * 60 * 10,
  });

  const {
    data: result,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['stations', 'search', filters, page],
    queryFn: () => stationService.searchStations(filters, page, PAGE_SIZE),
  });

  const stations = result?.stations ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilterCount = useMemo(
    () =>
      (filters.connectorTypes?.length ?? 0) +
      (filters.chargingSpeed?.length ?? 0) +
      (filters.amenities?.length ?? 0) +
      (filters.operators?.length ?? 0) +
      (filters.availability ? 1 : 0) +
      (filters.query ? 1 : 0),
    [filters],
  );

  const updateFilters = useCallback((next: Partial<SearchFilters>, resetPage = true) => {
    setFilters((current) => ({ ...current, ...next }));
    if (resetPage) setPage(1);
  }, []);

  const syncParams = useCallback(
    (next: Partial<SearchFilters>) => {
      const params = new URLSearchParams(searchParams);
      const query = next.query;
      if (query) params.set('q', query);
      else params.delete('q');
      if (next.connectorTypes?.[0]) params.set('connector', next.connectorTypes[0]);
      else params.delete('connector');
      if (next.chargingSpeed?.[0]) params.set('speed', next.chargingSpeed[0]);
      else params.delete('speed');
      if (next.availability) params.set('available', '1');
      else params.delete('available');
      if (next.location) {
        params.set('lat', String(next.location.latitude));
        params.set('lng', String(next.location.longitude));
      } else {
        params.delete('lat');
        params.delete('lng');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleSearch = (next: SearchFilters) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
    syncParams(next);
  };

  const handleViewChange = (mode: 'list' | 'map') => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams);
    if (mode === 'map') params.set('view', 'map');
    else params.delete('view');
    setSearchParams(params, { replace: true });
  };

  const clearFilters = () => {
    const next: SearchFilters = { sort: filters.sort };
    setFilters(next);
    setPage(1);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  /** Apply one filter change and keep the URL shareable. */
  const applyPatch = useCallback(
    (patch: Partial<SearchFilters>) => {
      const next = { ...filters, ...patch };
      setFilters(next);
      setPage(1);
      syncParams(next);
    },
    [filters, syncParams],
  );

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; remove: () => void }[] = [];
    if (filters.query) {
      chips.push({
        key: 'query',
        label: `“${filters.query}”`,
        remove: () => applyPatch({ query: undefined }),
      });
    }
    (filters.connectorTypes ?? []).forEach((type) => {
      chips.push({
        key: `connector-${type}`,
        label: type,
        remove: () =>
          applyPatch({
            connectorTypes: (filters.connectorTypes ?? []).filter((value) => value !== type),
          }),
      });
    });
    (filters.chargingSpeed ?? []).forEach((speed) => {
      chips.push({
        key: `speed-${speed}`,
        label: speed,
        remove: () =>
          applyPatch({
            chargingSpeed: (filters.chargingSpeed ?? []).filter((value) => value !== speed),
          }),
      });
    });
    (filters.amenities ?? []).forEach((amenity) => {
      chips.push({
        key: `amenity-${amenity}`,
        label: amenity,
        remove: () =>
          applyPatch({
            amenities: (filters.amenities ?? []).filter((value) => value !== amenity),
          }),
      });
    });
    if (filters.operators?.length) {
      chips.push({
        key: 'operator',
        label: filters.operators[0],
        remove: () => applyPatch({ operators: undefined }),
      });
    }
    if (filters.availability) {
      chips.push({
        key: 'availability',
        label: 'Available now',
        remove: () => applyPatch({ availability: undefined }),
      });
    }
    if (filters.location) {
      chips.push({
        key: 'location',
        label: 'Within 25 mi',
        remove: () => applyPatch({ location: undefined }),
      });
    }
    return chips;
  }, [filters, applyPatch]);

  const recentStations = useMemo(() => {
    const stations = catalogData?.stations ?? [];
    return recentIds
      .map((id) => stations.find((station) => station.id === id))
      .filter((station): station is NonNullable<typeof station> => Boolean(station))
      .slice(0, 4);
  }, [catalogData, recentIds]);

  const handleFavorite = async (stationId: string, name: string) => {
    try {
      const saved = await toggleFavorite(stationId);
      setFavoriteMessage(
        saved
          ? `${name} saved. Station added to your favourites.`
          : `${name} removed from favourites.`,
      );
    } catch (error) {
      setFavoriteMessage(
        error instanceof Error ? error.message : `Could not update ${name}. Try again.`,
      );
    }
  };

  const filterPanel = (
    <div id="search-filters" className="grid gap-6">
      {meta && (
        <>
          <fieldset>
            <legend className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Connector
            </legend>
            <div className="flex flex-wrap gap-2">
              {meta.connectorTypes.map((type) => {
                const active = filters.connectorTypes?.includes(type) ?? false;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      updateFilters({ connectorTypes: toggleValue(filters.connectorTypes, type) })
                    }
                    className={`${CHIP} ${
                      active
                        ? 'border-brand bg-brand-soft text-brand-soft-ink'
                        : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Charging speed
            </legend>
            <div className="flex flex-wrap gap-2">
              {meta.chargingSpeeds.map((speed) => {
                const active = filters.chargingSpeed?.includes(speed as ChargingSpeed) ?? false;
                return (
                  <button
                    key={speed}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      updateFilters({
                        chargingSpeed: toggleValue(
                          filters.chargingSpeed,
                          speed as ChargingSpeed,
                        ),
                      })
                    }
                    className={`${CHIP} ${
                      active
                        ? 'border-brand bg-brand-soft text-brand-soft-ink'
                        : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {speed}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Amenities
            </legend>
            <div className="flex flex-wrap gap-2">
              {meta.amenities.slice(0, 8).map((amenity) => {
                const active = filters.amenities?.includes(amenity) ?? false;
                return (
                  <button
                    key={amenity}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateFilters({ amenities: toggleValue(filters.amenities, amenity) })}
                    className={`${CHIP} ${
                      active
                        ? 'border-brand bg-brand-soft text-brand-soft-ink'
                        : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {amenity}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="operator-filter"
              className="mb-2 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle"
            >
              Network
            </label>
            <select
              id="operator-filter"
              value={filters.operators?.[0] ?? ''}
              onChange={(event) =>
                updateFilters({
                  operators: event.target.value ? [event.target.value] : undefined,
                })
              }
              className="h-10 w-full rounded-control border border-line bg-surface-muted px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            >
              <option value="">All networks</option>
              {meta.operators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <Checkbox
        checked={Boolean(filters.availability)}
        onChange={(checked) => updateFilters({ availability: checked || undefined })}
        ariaLabel="Available now"
        hint="Only stations reporting at least one free connector."
      >
        Available now
      </Checkbox>

      <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
        Clear filters
      </Button>
    </div>
  );

  return (
    <div>
      <PageHero
        eyebrow="Station finder"
        title="Find your next charge"
        description="Search the Afterglow catalog by place, connector and speed. Prices, power and availability come straight from the station feed."
      />

      <div className="relative z-10 mx-auto -mt-8 max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <SearchBar meta={meta} initialQuery={filters.query ?? ''} onSearch={handleSearch} />
      </div>

      <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <Breadcrumbs
          className="mb-5"
          items={[{ label: 'Home', to: '/' }, { label: 'Find stations' }]}
        />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Filters */}
          <aside className="w-full shrink-0 lg:w-[17.5rem]">
            <div className="flex items-center justify-between lg:hidden">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="search-filters"
                leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              >
                Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </Button>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-brand hover:text-brand-strong"
                >
                  Clear all
                </button>
              )}
            </div>

            <div
              className={`${filtersOpen ? 'mt-4 block' : 'mt-4 hidden'} rounded-card border border-line bg-surface p-5 shadow-card lg:sticky lg:top-[88px] lg:mt-0 lg:block`}
            >
              <div className="mb-5 hidden items-center justify-between lg:flex">
                <h2 className="ev-card-title text-ink">Filters</h2>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.7rem] font-semibold text-brand-soft-ink">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              {filterPanel}
            </div>
          </aside>

          {/* Results */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <p role="status" aria-live="polite" className="text-sm text-ink-muted">
                {isPending
                  ? 'Searching stations…'
                  : `${total} station${total === 1 ? '' : 's'}`}
                {result?.source === 'demo' && (
                  <span className="ml-2 rounded-full border border-warning/35 bg-warning-soft px-2 py-0.5 text-[0.7rem] font-semibold text-warning-ink">
                    Demo mode
                  </span>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <ButtonLink
                  to="/compare"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Scale className="h-3.5 w-3.5" />}
                >
                  Compare
                </ButtonLink>
                <div className="flex rounded-full border border-line bg-surface-muted p-1" role="group" aria-label="View mode">
                  <button
                    type="button"
                    onClick={() => handleViewChange('list')}
                    aria-pressed={viewMode === 'list'}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === 'list' ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" aria-hidden="true" />
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewChange('map')}
                    aria-pressed={viewMode === 'map'}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === 'map' ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Map
                  </button>
                </div>

                <label htmlFor="sort" className="sr-only">
                  Sort
                </label>
                <select
                  id="sort"
                  value={filters.sort ?? 'distance'}
                  onChange={(event) => updateFilters({ sort: event.target.value as SearchSort })}
                  className="h-9 rounded-full border border-line bg-surface-muted px-3 text-xs font-medium text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
                <span className="text-xs text-ink-subtle">Active:</span>
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.remove}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-brand/35 bg-brand-soft px-2.5 text-xs font-medium text-brand-soft-ink transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {chip.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">Remove {chip.label} filter</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded text-xs font-medium text-ink-muted underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Clear all
                </button>
              </div>
            )}

            {result?.source === 'demo' && (
              <div className="mt-4 flex items-start gap-2.5 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-xs leading-relaxed text-warning-ink">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  <strong className="font-semibold">Demo mode:</strong> the API could not be reached.
                  These are not real stations — they are bundled sample data so the finder stays
                  explorable.
                </p>
              </div>
            )}

            {favoriteMessage && (
              <p
                role="status"
                aria-live="polite"
                className="mt-4 rounded-card border border-success/30 bg-success-soft px-4 py-2.5 text-xs font-medium text-success-ink"
              >
                {favoriteMessage}
              </p>
            )}

            <div className="mt-5">
              {isError ? (
                <div className="rounded-card border border-line bg-surface p-10 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-ink-subtle" aria-hidden="true" />
                  <h2 className="ev-card-title mt-4 text-ink">We could not complete that search.</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
                    {(error as Error)?.message || 'The station service did not respond.'}
                  </p>
                  <Button className="mt-5" onClick={() => refetch()} isLoading={isFetching}>
                    Try again
                  </Button>
                </div>
              ) : viewMode === 'map' ? (
                <div className="space-y-4">
                  <StationMap
                    stations={stations}
                    center={
                      filters.location
                        ? { latitude: filters.location.latitude, longitude: filters.location.longitude }
                        : undefined
                    }
                    selectedId={selectedId}
                    onSelect={(station) => setSelectedId(station.id)}
                    onClearSelection={() => setSelectedId(null)}
                    height="560px"
                    emptyMessage="No stations match these filters, so there is nothing to plot."
                  />
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Coordinates come from the seeded Afterglow catalogue, not a verified operator
                    feed. Treat them as sample locations and confirm the address before driving.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {stations.slice(0, 4).map((station) => (
                      <StationCard key={station.id} station={station} showActions />
                    ))}
                  </div>
                </div>
              ) : isPending ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <StationCardSkeleton key={index} />
                  ))}
                </div>
              ) : stations.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No stations match those filters"
                  description="Nothing in the catalogue satisfies every filter at once. Try a wider search, a different connector, or clear the filters entirely."
                  action={
                    <>
                      <Button variant="primary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                      <ButtonLink to="/compare" variant="ghost" size="md">
                        Compare stations
                      </ButtonLink>
                    </>
                  }
                  footNote="The catalogue only lists stations that have been seeded in this build."
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {stations.map((station) => (
                    <StationCard
                      key={station.id}
                      station={station}
                      showActions
                      cornerAction={
                        isAuthenticated ? (
                          <button
                            type="button"                              onClick={() =>
                                void handleFavorite(station.id, station.name)
                              }
                            aria-label={
                              isFavorite(station.id)
                                ? `Remove ${station.name} from favourites`
                                : `Save ${station.name} to favourites`
                            }
                            aria-pressed={isFavorite(station.id)}
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                              isFavorite(station.id)
                                ? 'border-brand/40 bg-brand-soft text-brand'
                                : 'border-line bg-surface text-ink-subtle hover:text-ink'
                            }`}
                          >
                            <Heart
                              className={`h-4 w-4 ${isFavorite(station.id) ? 'fill-current' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          <Link
                            to="/login"
                            aria-label={`Sign in to save ${station.name}`}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-subtle transition-colors hover:border-brand/40 hover:text-brand"
                          >
                            <Heart className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {!isError && stations.length > 0 && totalPages > 1 && (
              <nav
                className="mt-8 flex items-center justify-between gap-3"
                aria-label="Search results pages"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <p className="text-xs text-ink-subtle">
                  Page {page} of {totalPages}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </nav>
            )}

            {stations.length > 0 && (
              <p className="mt-8 text-xs leading-relaxed text-ink-subtle">
                <Info className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Availability, power and pricing are supplied by the station feed and can differ from
                what the operator charges on site.{' '}
                <Link to="/about" className="text-ink-muted underline underline-offset-2 hover:text-ink">
                  About the data
                </Link>
                .
              </p>
            )}

            {recentStations.length > 0 && (
              <section
                aria-labelledby="recently-viewed-heading"
                className="mt-10 border-t border-line pt-8"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h2 id="recently-viewed-heading" className="ev-title text-ink">
                      Recently viewed
                    </h2>
                    <p className="mt-1 text-xs text-ink-subtle">
                      Stored in this browser only — clear it whenever you like.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="rounded text-xs font-medium text-ink-muted underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Clear history
                  </button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {recentStations.map((station) => (
                    <StationCard key={station.id} station={station} compact />
                  ))}
                </div>
              </section>
            )}

            <div className="mt-10 flex flex-col gap-3 rounded-card border border-line bg-surface-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="ev-card-title text-ink">Comparing charges is easier in a table</h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Put up to three stations side by side for power, connectors, price and amenities.
                </p>
              </div>
              <ButtonLink
                to="/compare"
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Open comparison
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
