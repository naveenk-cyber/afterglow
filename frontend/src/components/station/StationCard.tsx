import type React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gauge, MapPin, Star, Zap } from 'lucide-react';
import type { ChargingStation } from '../../types';
import Badge from '../ui/Badge';
import StationStatusBadge from './StationStatusBadge';
import ButtonLink from '../ui/ButtonLink';
import { formatDistance, formatPrice } from '../../utils/helpers';

interface StationCardProps {
  station: ChargingStation;
  /**
   * Discovery variant: the whole card is a link, with no action row. Used on
   * the homepage where the card is a teaser rather than a control surface.
   */
  compact?: boolean;
  /** Renders the Details / Book row (station finder). */
  showActions?: boolean;
  /** Control pinned to the top-right corner, e.g. a favourite toggle. */
  cornerAction?: React.ReactNode;
  /** Highlighted state driven by the map hover in the finder. */
  selected?: boolean;
  onMouseEnter?: () => void;
  className?: string;
}

const CARD = 'bg-surface border rounded-card shadow-card transition-all duration-200 overflow-hidden';

/**
 * Deterministic photo pool for sample stations. The catalog carries no real
 * per-station imagery, so each station picks one photo from this pool through
 * a stable hash of its id — the same station always shows the same image, and
 * neighbouring cards differ. The photos are illustrative; the card never
 * claims they depict the actual site.
 */
const STATION_PHOTOS = [
  { src: '/assets/charging-hardware.jpg', alt: 'Premium electric vehicle charging at a modern station, connector illuminated' },
  { src: '/assets/hero-charging.jpg', alt: 'EV charging at dusk with premium lighting' },
  { src: '/assets/membership-premium.jpg', alt: 'Premium EV on coastal road at dusk' },
  { src: '/assets/station-1.jpg', alt: 'Charging cable seated in an EV charge port' },
  { src: '/assets/station-2.jpg', alt: 'Electric car parked at a scenic charging stop at sunset' },
  { src: '/assets/station-3.jpg', alt: 'Electric car lit with light painting at a night charging stop' },
  { src: '/assets/station-4.jpg', alt: 'Electric sedan on the road between charges' },
  { src: '/assets/station-5.jpg', alt: 'White electric sports car in a modern showroom' },
  { src: '/assets/station-6.jpg', alt: 'Electric sedan charging at dusk' },
  { src: '/assets/station-garage.jpg', alt: 'Electric car charging in a marked parking bay' },
];

function photoForStation(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return STATION_PHOTOS[hash % STATION_PHOTOS.length];
}
/**
 * Connector standards offered at the station, heaviest power first.
 *
 * Multiple hardware units of the same standard are merged into one chip that
 * carries the peak power and the unit count, so a station with three CCS
 * chargers reads as "CCS 150 kW ×3" rather than three identical rows.
 */
const ConnectorList: React.FC<{ station: ChargingStation; max?: number }> = ({
  station,
  max = 3,
}) => {
  const grouped = new Map<string, { type: string; maxPower: number; count: number }>();
  for (const connector of station.connectorTypes) {
    const existing = grouped.get(connector.type);
    if (existing) {
      existing.maxPower = Math.max(existing.maxPower, connector.maxPower);
      existing.count += connector.count;
    } else {
      grouped.set(connector.type, {
        type: connector.type,
        maxPower: connector.maxPower,
        count: connector.count,
      });
    }
  }

  const connectors = [...grouped.values()].sort((a, b) => b.maxPower - a.maxPower);
  const shown = connectors.slice(0, max);
  const hidden = connectors.length - shown.length;

  if (shown.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
      {shown.map((connector) => (
        <li
          key={connector.type}
          className="inline-flex items-center gap-1 rounded-control bg-surface-muted/60 border border-line/30 px-2 py-1 ev-meta text-ink"
        >
          <Zap className="w-3 h-3 text-brand shrink-0" aria-hidden="true" />
          <span className="font-medium">{connector.type}</span>
          <span className="text-ink-subtle">{connector.maxPower} kW</span>
          {connector.count > 1 && <span className="text-ink-subtle">×{connector.count}</span>}
        </li>
      ))}
      {hidden > 0 && (
        <li className="inline-flex items-center rounded-control border border-line px-2 py-1 ev-meta">
          +{hidden} more
        </li>
      )}
    </ul>
  );
};

const StationCard: React.FC<StationCardProps> = ({
  station,
  compact = false,
  showActions = false,
  cornerAction,
  selected = false,
  onMouseEnter,
  className = '',
}) => {
  const price =
    station.pricing.perKwh != null ? `${formatPrice(station.pricing.perKwh)}/kWh` : 'Price varies';
  const maxPower = station.connectorTypes.reduce((max, c) => Math.max(max, c.maxPower), 0);
  const hasReviews = station.reviewCount > 0;
  const photo = photoForStation(station.id);

  const body = (
    <>
      {/* Illustrative photo, cropped to a consistent 16:10 frame. Lazy-loaded
          and self-hiding on failure so a missing asset degrades to the plain
          card rather than a broken-image icon. */}
      <div className="relative -mx-px -mt-px bg-surface-muted">
        {/* The frame keeps its 16:10 footprint while the photo loads (or if it
            fails), so a card never collapses into a black gap. */}
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center"
          aria-hidden="true"
        >
          <Zap className="h-8 w-8 text-line-strong" strokeWidth={1.25} />
        </span>
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          className="relative w-full aspect-[16/10] object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        {/* Bottom scrim keeps the transition into the card surface subtle. */}
        <div
          className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent, rgb(11 13 15 / 0.35))' }}
          aria-hidden="true"
        />
      </div>

      <div className="p-4 sm:p-5 flex flex-col flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="ev-card-title text-ink line-clamp-2">{station.name}</h3>
          <p className="ev-meta mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            <span className="truncate">{station.city || station.address}</span>
          </p>
        </div>
        {cornerAction}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <StationStatusBadge status={station.availability.status} />
        <Badge tone="brand" icon={<Gauge />}>
          {station.chargingSpeed}
        </Badge>
        <Badge>{price}</Badge>
      </div>

      <div className="mt-3">
        <ConnectorList station={station} max={compact ? 2 : 3} />
      </div>

      <dl className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-1.5 ev-meta">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Rating</dt>
          <dd className="flex items-center gap-1.5">
            <Star
              className={`w-3.5 h-3.5 ${hasReviews ? 'text-star' : 'text-ink-subtle'}`}
              aria-hidden="true"
            />
            {hasReviews ? (
              <span className="text-ink font-medium">
                {station.rating.toFixed(1)}
                <span className="text-ink-subtle font-normal"> ({station.reviewCount})</span>
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
          </dd>
        </div>

        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Peak power</dt>
          <dd className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
            {maxPower > 0 ? `${maxPower} kW peak` : 'Power not listed'}
          </dd>
        </div>

        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Connectors</dt>
          <dd>
            {station.availability.availableConnectors}/{station.availability.totalConnectors}{' '}
            connectors free
          </dd>
        </div>

        {station.distance != null && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Distance</dt>
            <dd>{formatDistance(station.distance)} mi away</dd>
          </div>
        )}
      </dl>
      </div>
    </>
  );

  if (compact) {
    return (
      <Link
        to={`/station/${station.id}`}
        onMouseEnter={onMouseEnter}
        className={`${CARD} group flex h-full flex-col p-4 hover:border-brand/40 hover:shadow-card-hover ${
          selected ? 'border-brand' : 'border-line'
        } ${className}`}
      >
        {body}
        <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-brand">
          View station
          <ArrowRight
            className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </Link>
    );
  }

  return (
    <article
      onMouseEnter={onMouseEnter}
      className={`${CARD} flex h-full flex-col p-5 hover:shadow-card-hover ${
        selected ? 'border-brand' : 'border-line hover:border-line-strong'
      } ${className}`}
    >
      {body}

      {showActions && (
        <div className="mt-4 pt-4 border-t border-line flex gap-2">
          <ButtonLink
            to={`/station/${station.id}`}
            variant="outline"
            size="sm"
            fullWidth
            className="flex-1"
          >
            Details
          </ButtonLink>
          <ButtonLink
            to={`/bookings?stationId=${station.id}`}
            variant="primary"
            size="sm"
            fullWidth
            className="flex-1"
          >
            Book
          </ButtonLink>
        </div>
      )}
    </article>
  );
};

export default StationCard;
