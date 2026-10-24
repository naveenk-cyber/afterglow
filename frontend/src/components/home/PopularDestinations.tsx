import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import { useStationCatalog } from '../../hooks/useStationCatalog';

const PHOTOS = [
  { src: '/assets/station-2.jpg', alt: 'Electric car charging at a scenic stop' },
  { src: '/assets/station-3.jpg', alt: 'Electric car at a night charging stop' },
  { src: '/assets/station-garage.jpg', alt: 'Electric car charging in a covered garage' },
  { src: '/assets/premium-dusk.jpg', alt: 'Electric vehicle at dusk' },
  { src: '/assets/station-6.jpg', alt: 'Electric sedan charging at dusk' },
  { src: '/assets/charging-hardware.jpg', alt: 'EV charging connector illuminated' },
];

const PopularDestinations: React.FC = () => {
  const { data, isLoading } = useStationCatalog();

  const cityCounts = new Map<string, number>();
  for (const station of data?.stations ?? []) {
    if (!station.city) continue;
    cityCounts.set(station.city, (cityCounts.get(station.city) ?? 0) + 1);
  }

  const cities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6);

  return (
    <section aria-labelledby="destinations-heading">
      <SectionHeading
        eyebrow="Browse by city"
        title="Where drivers are charging"
        description="Every city below is drawn from the current station catalog, with the number of stations already listed."
        action={
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-strong"
          >
            All stations
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      {isLoading && cities.length === 0 ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-card border border-line bg-surface-muted"
            />
          ))}
        </div>
      ) : cities.length === 0 ? (
        <p className="mt-7 rounded-card border border-line bg-surface p-5 text-sm text-ink-muted">
          No cities are listed yet. Search the catalog to see individual stations.
        </p>
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map(([city, count], index) => {
            const photo = PHOTOS[index % PHOTOS.length];
            return (
              <Link
                key={city}
                to={`/search?q=${encodeURIComponent(city)}`}
                className="group relative flex h-40 flex-col justify-end overflow-hidden rounded-card border border-line bg-surface-muted shadow-card transition-colors hover:border-brand/45"
              >
                <span
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                  aria-hidden="true"
                >
                  <MapPin className="h-7 w-7 text-line-strong" strokeWidth={1.25} />
                </span>
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  onError={(event) => {
                    event.currentTarget.style.visibility = 'hidden';
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(6,7,8,0.05) 20%, rgba(6,7,8,0.82) 100%)',
                  }}
                  aria-hidden="true"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.02em] text-white">{city}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-white/70">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {count} station{count === 1 ? '' : 's'} listed
                    </p>
                  </div>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 text-white transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-on-accent">
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PopularDestinations;
