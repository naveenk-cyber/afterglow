import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crosshair, Search, Zap } from 'lucide-react';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { ChargingSpeed, FilterMeta, SearchFilters } from '../../types';

interface SearchBarProps {
  className?: string;
  onSearch?: (filters: SearchFilters) => void;
  compact?: boolean;
  /** Filter values from the API; falls back to the common standards. */
  meta?: FilterMeta | null;
  initialQuery?: string;
}

const FALLBACK_CONNECTORS = ['CCS', 'CHAdeMO', 'J1772', 'Tesla', 'Type 2'];
const FALLBACK_SPEEDS = ['Level 2', 'DC Fast', 'Supercharger'];

/**
 * Station search.
 *
 * Earlier this component asked for check-in/check-out dates and a guest count —
 * values that were forwarded as query parameters the station API never read.
 * It now collects the three things the catalog can actually filter on:
 * a place or station name, a connector standard and a charging speed.
 */
const SearchBar: React.FC<SearchBarProps> = ({
  className = '',
  onSearch,
  compact = false,
  meta = null,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [connector, setConnector] = useState('');
  const [speed, setSpeed] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const navigate = useNavigate();

  const {
    latitude,
    longitude,
    isLoading: locating,
    error: locationError,
    getCurrentLocation,
  } = useGeolocation({ immediate: false });

  const connectors = meta?.connectorTypes?.length ? meta.connectorTypes : FALLBACK_CONNECTORS;
  const speeds = meta?.chargingSpeeds?.length ? meta.chargingSpeeds : FALLBACK_SPEEDS;

  const buildFilters = (): SearchFilters => ({
    query: query.trim() || undefined,
    connectorTypes: connector ? [connector] : undefined,
    chargingSpeed: speed ? [speed as ChargingSpeed] : undefined,
    availability: availableOnly || undefined,
    location:
      latitude != null && longitude != null
        ? { latitude, longitude, radius: 25 }
        : undefined,
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const filters = buildFilters();

    if (onSearch) {
      onSearch(filters);
      return;
    }

    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (connector) params.set('connector', connector);
    if (speed) params.set('speed', speed);
    if (availableOnly) params.set('available', '1');
    if (latitude != null && longitude != null) {
      params.set('lat', String(latitude));
      params.set('lng', String(longitude));
    }
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const fieldClass =
    'h-12 w-full rounded-control border border-line bg-surface-muted px-3.5 text-sm text-ink ' +
    'placeholder:text-ink-subtle transition-colors hover:border-line-strong focus:border-brand ' +
    'focus:outline-none focus:ring-2 focus:ring-brand/25';

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Find a charging station"
      className={`rounded-card border border-line bg-surface p-3 shadow-card sm:p-4 ${className}`}
    >
      <div className={compact ? 'grid gap-2.5 lg:grid-cols-[1.6fr_1fr_1fr_auto]' : 'grid gap-2.5 md:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_auto]'}>
        <div>
          <label htmlFor="station-search" className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Where
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <input
              id="station-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="City, postcode or station"
              className={`${fieldClass} pl-10`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="station-connector" className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Connector
          </label>
          <select
            id="station-connector"
            value={connector}
            onChange={(event) => setConnector(event.target.value)}
            className={fieldClass}
          >
            <option value="">Any connector</option>
            {connectors.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="station-speed" className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Speed
          </label>
          <select
            id="station-speed"
            value={speed}
            onChange={(event) => setSpeed(event.target.value)}
            className={fieldClass}
          >
            <option value="">Any speed</option>
            {speeds.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={getCurrentLocation}
            isLoading={locating}
            leftIcon={<Crosshair className="h-4 w-4" />}
            className="shrink-0 px-4"
            aria-label="Use my current location"
            title="Use my current location"
          >
            <span className="hidden sm:inline">Near me</span>
          </Button>
          <Button type="submit" size="lg" className="flex-1" leftIcon={<Zap className="h-4 w-4" />}>
            Search
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Checkbox checked={availableOnly} onChange={setAvailableOnly}>
          Available connectors only
        </Checkbox>

        <p className="text-xs text-ink-subtle" role="status">
          {latitude != null && longitude != null
            ? 'Using your approximate location for distance.'
            : locationError
              ? locationError
              : 'Add a location to sort by distance.'}
        </p>
      </div>
    </form>
  );
};

export default SearchBar;
