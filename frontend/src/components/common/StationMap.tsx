import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X } from 'lucide-react';
import { ChargingStation } from '../../types';
import { formatPrice } from '../../utils/helpers';

/**
 * OpenStreetMap + Leaflet map.
 *
 * Tiles are served by the public OpenStreetMap tile servers. That service is
 * free but has a usage policy (no bulk downloading, attribution required, and
 * not intended to back high-traffic production apps). For production traffic,
 * point `TILE_URL` at your own tile server or a commercial provider, and keep
 * the attribution intact. See README "Maps and station data".
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Build a lightweight div icon so we avoid Leaflet's bundler-unfriendly assets.
 *
 * Only the size is inline; the colour comes from CSS (`data-status` plus the
 * design tokens), so switching theme restyles every marker without rebuilding
 * the Leaflet icons.
 */
const buildIcon = (station: ChargingStation, selected: boolean) => {
  // 24px is the minimum comfortable target for a pointer or touch; the selected
  // marker grows so the active station is obvious without a second highlight.
  const size = selected ? 30 : 24;
  const status = station.availability.status.replace(/\s+/g, '-');
  return L.divIcon({
    className: 'chargeease-marker',
    html:
      `<span class="chargeease-dot${selected ? ' is-selected' : ''}" data-status="${status}" ` +
      `style="width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Opening view when the caller supplies no centre.
 *
 * Fitting every result across several cities zooms out to a multi-state map
 * where markers collapse into dots. Prefer the city with the most results so
 * the first view is useful, and let the driver zoom out or set a location to
 * see the rest.
 */
function InitialView({ stations, active }: { stations: ChargingStation[]; active: boolean }) {
  const map = useMap();
  const key = stations.map((station) => station.id).join(',');

  useEffect(() => {
    if (!active || stations.length === 0) return;

    const groups = new Map<string, ChargingStation[]>();
    for (const station of stations) {
      if (!Number.isFinite(station.latitude) || !Number.isFinite(station.longitude)) continue;
      const groupKey = station.city || station.address;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), station]);
    }

    const densest = [...groups.values()].sort((a, b) => b.length - a.length)[0];
    if (!densest || densest.length === 0) return;

    if (densest.length === 1) {
      map.setView([densest[0].latitude, densest[0].longitude], 13, { animate: false });
      return;
    }

    const { lat, lng } = densest.reduce(
      (total, station) => ({
        lat: total.lat + station.latitude,
        lng: total.lng + station.longitude,
      }),
      { lat: 0, lng: 0 },
    );
    map.setView([lat / densest.length, lng / densest.length], 12, { animate: false });
  }, [key, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

interface StationMapProps {
  stations: ChargingStation[];
  center?: { latitude: number; longitude: number };
  selectedId?: string | null;
  onSelect?: (station: ChargingStation) => void;
  onClearSelection?: () => void;
  height?: string;
  /** Shown when there are no stations to plot. */
  emptyMessage?: string;
  /** Tighter chrome for the dashboard's nearby widget. */
  compact?: boolean;
}

const StationMap: React.FC<StationMapProps> = ({
  stations,
  center,
  selectedId = null,
  onSelect,
  onClearSelection,
  height = '600px',
  emptyMessage = 'No stations to show on the map yet.',
  compact = false,
}) => {
  const [tileError, setTileError] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);

  const mapCenter = useMemo<[number, number]>(
    () => [center?.latitude ?? 37.7749, center?.longitude ?? -122.4194],
    [center?.latitude, center?.longitude],
  );

  const selected = stations.find((station) => station.id === selectedId) || null;

  if (stations.length === 0) {
    return (
      <div
        className="grid place-items-center rounded-card border border-line bg-surface-muted px-5 text-center"
        style={{ height }}
      >
        <div className="max-w-xs py-6">
          <span className="ev-medallion mx-auto h-10 w-10">
            <MapPin className="h-5 w-5 text-ink-subtle" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{emptyMessage}</p>
          <p className="mt-1.5 text-xs text-ink-subtle">
            The station list beside the map still works.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chargeease-map relative overflow-hidden rounded-card border border-line"
      style={{ height }}
      role="region"
      aria-label="Map of charging stations"
    >
      <MapContainer
        center={mapCenter}
        zoom={center ? 12 : 11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          maxZoom={19}
          eventHandlers={{
            tileerror: () => setTileError(true),
            load: () => setTilesReady(true),
          }}
        />
        {center ? (
          <Recenter center={mapCenter} />
        ) : (
          <InitialView stations={stations} active={!center} />
        )}
        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={buildIcon(station, station.id === selectedId)}
            // Leaflet puts this on the marker element, which is a focusable
            // button; without it a keyboard or screen-reader user hears an
            // unnamed control.
            title={station.name}
            eventHandlers={{ click: () => onSelect?.(station) }}
          >
            <Popup>
              <div className="min-w-[190px]">
                <p className="font-semibold text-ink">{station.name}</p>
                <p className="text-xs text-ink-muted">{station.address}</p>
                <p className="mt-1 text-xs">
                  {station.availability.status} · {station.availability.availableConnectors}/
                  {station.availability.totalConnectors} free
                </p>
                <p className="text-xs">
                  {station.connectorTypes
                    .slice(0, 2)
                    .map((connector) => `${connector.type} ${connector.maxPower} kW`)
                    .join(' · ')}
                </p>
                <p className="text-xs">
                  {station.pricing.perKwh != null
                    ? `${formatPrice(station.pricing.perKwh)}/kWh`
                    : 'Pricing varies'}
                  {station.distance != null && ` · ${station.distance} mi`}
                </p>
                <Link
                  to={`/station/${station.id}`}
                  className="mt-1.5 inline-block text-xs font-semibold text-brand underline-offset-2 hover:underline"
                >
                  View station details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {!tilesReady && !tileError && (
        <div
          role="status"
          className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted shadow-card"
        >
          Loading map…
        </div>
      )}

      {tileError && (
        <div
          role="status"
          className="absolute left-1/2 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-center text-xs leading-relaxed text-warning-ink shadow-card"
        >
          Map tiles could not load. Station markers and the list still work.
        </div>
      )}

      {selected && (
        <div className="absolute bottom-3 left-3 right-3 z-[400] rounded-control border border-line bg-surface p-3 shadow-card sm:right-auto sm:max-w-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{selected.name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{selected.address}</p>
            </div>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Close station summary"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-ink-subtle">
              {selected.availability.status} ·{' '}
              {selected.availability.availableConnectors}/{selected.availability.totalConnectors}{' '}
              connectors free
              {selected.pricing.perKwh != null &&
                ` · ${formatPrice(selected.pricing.perKwh)}/kWh`}
            </p>
          )}
          <Link
            to={`/station/${selected.id}`}
            className="mt-2 inline-flex text-xs font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Open station details
          </Link>
        </div>
      )}
    </div>
  );
};

export default StationMap;
