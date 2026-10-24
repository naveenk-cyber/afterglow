import React, { useMemo } from 'react';
import Hero from './home/Hero';
import PlatformFacts from './home/PlatformFacts';
import type { ConnectorMixEntry } from './home/PlatformFacts';
import PopularDestinations from './home/PopularDestinations';
import TopRatedSpots from './home/TopRatedSpots';
import HowItWorks from './home/HowItWorks';
import ConnectorGuide from './home/ConnectorGuide';
import CompareTeaser from './home/CompareTeaser';
import ChargingShowcase from './home/ChargingShowcase';
import ChargingClub from './home/ChargingClub';
import TrustPanel from './home/TrustPanel';
import SectionHeading from './ui/SectionHeading';
import ButtonLink from './ui/ButtonLink';
import { useCatalogCounts, useStationCatalog } from '../hooks/useStationCatalog';
import { ArrowRight } from 'lucide-react';

/**
 * Homepage composition.
 *
 * Every section either explains a real capability or links to one. The numbers
 * and the connector mix come from the same catalogue query the finder uses, so
 * the landing page cannot drift from the running data.
 */
const Home: React.FC = () => {
  const { stations, connectorStandards, cities, isLoading, source } = useCatalogCounts();
  const { data: catalog } = useStationCatalog();

  const connectorMix = useMemo<ConnectorMixEntry[]>(() => {
    const mix = new Map<string, ConnectorMixEntry>();
    for (const station of catalog?.stations ?? []) {
      for (const connector of station.connectorTypes) {
        const current = mix.get(connector.type);
        if (current) {
          current.peakPower = Math.max(current.peakPower, connector.maxPower);
        } else {
          mix.set(connector.type, {
            type: connector.type,
            stations: 0,
            peakPower: connector.maxPower,
          });
        }
      }
    }
    // Station counts are counted once per type, after collecting the types.
    for (const station of catalog?.stations ?? []) {
      const seen = new Set(station.connectorTypes.map((connector) => connector.type));
      seen.forEach((type) => {
        const entry = mix.get(type);
        if (entry) entry.stations += 1;
      });
    }
    return [...mix.values()].sort((a, b) => b.stations - a.stations || a.type.localeCompare(b.type));
  }, [catalog]);

  return (
    <div>
      <Hero />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <section className="py-10 lg:py-12" aria-labelledby="network-overview-heading">
          <SectionHeading
            id="network-overview-heading"
            eyebrow="Network overview"
            title="The catalogue, measured"
            description="Live counts from the same station records the finder searches. Nothing here is a marketing estimate."
            action={
              <ButtonLink
                to="/search"
                variant="outline"
                size="md"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Open the finder
              </ButtonLink>
            }
          />
          <PlatformFacts
            stationCount={stations}
            connectorStandards={connectorStandards}
            cities={cities}
            connectorMix={connectorMix}
            isLoading={isLoading}
            isDemo={source === 'demo'}
          />
        </section>

        <div className="h-px bg-line" />

        <div className="py-10 lg:py-14">
          <PopularDestinations />
        </div>

        <div className="h-px bg-line" />

        <div className="py-10 lg:py-14">
          <TopRatedSpots />
        </div>

        <div className="pb-10 lg:pb-14">
          <HowItWorks />
        </div>

        <div className="h-px bg-line" />

        <div className="py-10 lg:py-14">
          <ConnectorGuide />
        </div>

        <div className="pb-10 lg:pb-14">
          <CompareTeaser />
        </div>

        <div className="pb-10 lg:pb-14">
          <ChargingShowcase />
        </div>

        <div className="pb-12 lg:pb-16">
          <ChargingClub />
        </div>

        <div className="pb-16 lg:pb-20">
          <TrustPanel isDemo={source === 'demo'} />
        </div>
      </div>
    </div>
  );
};

export default Home;
