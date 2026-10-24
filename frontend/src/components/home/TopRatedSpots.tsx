import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import StationCard from '../station/StationCard';
import { useStationCatalog } from '../../hooks/useStationCatalog';
import type { ChargingStation } from '../../types';

const maxPower = (station: ChargingStation) =>
  station.connectorTypes.reduce((max, connector) => Math.max(max, connector.maxPower), 0);

/**
 * Top-rated stations, straight from the catalog.
 *
 * The seed does not carry reviews yet, so every rating is 0. In that case the
 * section switches to the fastest connectors instead of presenting an empty
 * "top rated" list — and says which list it is showing.
 */
const TopRatedSpots: React.FC = () => {
  const { data, isLoading } = useStationCatalog();
  const stations = data?.stations ?? [];
  const hasRatings = stations.some((station) => station.reviewCount > 0);

  const featured = [...stations]
    .sort((a, b) =>
      hasRatings
        ? b.rating - a.rating || b.reviewCount - a.reviewCount
        : maxPower(b) - maxPower(a) || a.name.localeCompare(b.name),
    )
    .slice(0, 4);

  return (
    <section aria-labelledby="top-stations-heading">
      <SectionHeading
        eyebrow={hasRatings ? 'Top rated by drivers' : 'Fastest connectors'}
        title={hasRatings ? 'Charging spots worth the detour' : 'Stations built for a quick stop'}
        description={
          hasRatings
            ? 'Ranked by driver reviews from the Afterglow catalog.'
            : 'Ranked by peak connector power while the review feed is still empty.'
        }
        action={
          <Link
            to="/search?sort=speed"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-strong"
          >
            Browse the catalog
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      {isLoading ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[24rem] animate-pulse rounded-card border border-line bg-surface-muted"
            />
          ))}
        </div>
      ) : featured.length === 0 ? (
        <p className="mt-7 rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
          The catalog is empty right now. Try the station finder for a full search.
        </p>
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((station) => (
            <StationCard key={station.id} station={station} compact />
          ))}
        </div>
      )}
    </section>
  );
};

export default TopRatedSpots;
