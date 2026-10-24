import React from 'react';
import { ArrowRight, MapPin, Star, Zap } from 'lucide-react';
import Backdrop from '../layout/Backdrop';
import ButtonLink from '../ui/ButtonLink';
import Badge from '../ui/Badge';
import SearchBar from './SearchBar';
import { useStationCatalog } from '../../hooks/useStationCatalog';
import { formatPrice } from '../../utils/helpers';

const Hero: React.FC = () => {
  const { data, isLoading } = useStationCatalog();
  const stations = data?.stations ?? [];
  const featured = stations[0];
  const stationCount = data?.total ?? stations.length;
  const connectorStandards = new Set(
    stations.flatMap((station) => station.connectorTypes.map((connector) => connector.type)),
  ).size;
  const cities = new Set(stations.map((station) => station.city).filter(Boolean)).size;

  const facts = [
    { label: 'Stations in the catalog', value: isLoading ? '—' : stationCount.toLocaleString() },
    { label: 'Connector standards', value: isLoading ? '—' : String(connectorStandards) },
    { label: 'Cities covered', value: isLoading ? '—' : String(cities) },
  ];

  return (
    <section className="relative overflow-hidden border-b border-line bg-deep text-deep-ink">
      <div className="ev-grid" aria-hidden="true" />
      <Backdrop variant="hero" />

      <div className="relative mx-auto max-w-[1280px] px-4 pb-10 pt-10 sm:px-6 sm:pt-12 lg:px-8 lg:pb-12 lg:pt-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:gap-12">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-deep-line bg-white/[0.04] px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-brand-on-deep">
              <Zap className="h-3 w-3" aria-hidden="true" />
              EV charging, without the guesswork
            </p>

            <h1 className="ev-display mt-5 max-w-[10em] text-deep-ink">
              Charge anywhere.
              <br />
              <em className="text-brand">Keep moving.</em>
            </h1>

            <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed text-deep-ink-muted sm:text-base">
              Find the right connector, compare real power and price, and keep every session in one
              place — before you leave the house.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <ButtonLink
                to="/search"
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Find charging stations
              </ButtonLink>
              <ButtonLink to="/membership" variant="glass" size="lg">
                Explore membership
              </ButtonLink>
            </div>

            <dl className="mt-7 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-5">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dd className="ev-figure text-[1.7rem] text-deep-ink">{fact.value}</dd>
                  <dt className="mt-1 text-[0.66rem] leading-snug text-deep-ink-muted">
                    {fact.label}
                  </dt>
                </div>
              ))}
            </dl>

            {data?.source === 'demo' && (
              <p className="mt-3 max-w-md text-xs leading-relaxed text-warning-ink">
                Showing the bundled sample catalog — the Afterglow API is not reachable, so these
                figures describe demo data only.
              </p>
            )}
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-surface shadow-[0_30px_70px_-40px_rgb(0_0_0/0.95)]">
              <img
                src="/assets/hero-charging.jpg"
                alt="Electric vehicle charging at a lit station at dusk"
                className="aspect-[16/10] w-full object-cover sm:aspect-[2/1] lg:aspect-[4/3]"
                fetchPriority="high"
                decoding="async"
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(6,7,8,0) 40%, rgba(6,7,8,0.6) 100%), linear-gradient(90deg, rgba(6,7,8,0.25) 0%, transparent 55%)',
                }}
                aria-hidden="true"
              />

              <div className="absolute left-3 top-3">
                <Badge tone="deep" dot>
                  From the station catalogue
                </Badge>
              </div>

              {featured && (
                <div className="absolute inset-x-3 bottom-3 rounded-[12px] border border-white/12 bg-[#0b0c0e]/85 p-3.5 backdrop-blur-md">
                  <p className="ev-label text-brand-on-deep">Featured station</p>
                  <p className="mt-1 truncate text-[0.92rem] font-semibold text-deep-ink">
                    {featured.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-deep-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {featured.city || featured.address}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-3 w-3 text-brand" aria-hidden="true" />
                      {featured.connectorTypes[0]?.maxPower ?? 0} kW
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 text-star" aria-hidden="true" />
                      {featured.reviewCount > 0 ? featured.rating.toFixed(1) : 'New'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-deep-ink-muted">
                    {featured.pricing.perKwh != null
                      ? `${formatPrice(featured.pricing.perKwh)} / kWh`
                      : 'Pricing varies'}
                    {' · '}
                    {featured.availability.availableConnectors} of{' '}
                    {featured.availability.totalConnectors} free
                  </p>
                </div>
              )}
            </div>

            <div className="absolute -bottom-4 -right-3 hidden h-14 w-14 place-items-center rounded-full border border-brand/30 bg-brand-soft text-brand shadow-accent sm:grid lg:-right-4">
              <Zap className="h-5 w-5" fill="currentColor" strokeWidth={0} aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="mt-8 lg:mt-10">
          <SearchBar />
        </div>
      </div>
    </section>
  );
};

export default Hero;
