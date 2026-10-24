import type React from 'react';
import { Building2, Info, MapPin, PlugZap, ShieldCheck } from 'lucide-react';

export interface ConnectorMixEntry {
  type: string;
  /** How many stations in the catalogue list this standard. */
  stations: number;
  /** Highest power available for this standard anywhere in the catalogue. */
  peakPower: number;
}

interface PlatformFactsProps {
  stationCount?: number;
  connectorStandards?: number;
  cities?: number;
  connectorMix?: ConnectorMixEntry[];
  isLoading?: boolean;
  isDemo?: boolean;
}

/**
 * Network overview numbers.
 *
 * Every figure is measured from the running catalogue (stations, connector
 * standards, cities) and the connector mix is aggregated from the same
 * records, so the homepage cannot advertise a plug type or city the finder
 * does not actually serve. Nothing here is a usage, customer or coverage
 * claim, because this build has no telemetry to support one.
 */
const PlatformFacts: React.FC<PlatformFactsProps> = ({
  stationCount,
  connectorStandards,
  cities,
  connectorMix = [],
  isLoading = false,
  isDemo = false,
}) => {
  const facts = [
    {
      icon: MapPin,
      value: isLoading ? '…' : stationCount != null ? String(stationCount) : '—',
      label: 'Stations available',
      detail: 'From the seeded catalogue',
    },
    {
      icon: PlugZap,
      value: isLoading ? '…' : connectorStandards != null ? String(connectorStandards) : '—',
      label: 'Connector standards',
      detail: 'Across the catalogue',
    },
    {
      icon: Building2,
      value: isLoading ? '…' : cities != null ? String(cities) : '—',
      label: 'Cities with coverage',
      detail: 'Where stations are seeded',
    },
    {
      icon: ShieldCheck,
      value: 'Free',
      label: 'Cost to run',
      detail: 'No paid services used',
    },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
          >
            <span className="ev-medallion mb-3 h-9 w-9 sm:mb-4 sm:h-10 sm:w-10">
              <fact.icon className="h-5 w-5 text-brand-soft-ink" aria-hidden="true" />
            </span>
            <dd className="ev-figure text-[2.1rem] leading-none text-ink">{fact.value}</dd>
            <dt className="ev-card-title mt-2.5 text-ink">{fact.label}</dt>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{fact.detail}</p>
          </div>
        ))}
      </dl>

      {connectorMix.length > 0 && (
        <div className="mt-4 rounded-card border border-line bg-surface px-4 py-4 shadow-card sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="ev-card-title text-ink">Connector mix in the catalogue</h3>
            <p className="text-xs text-ink-subtle">stations listing each standard</p>
          </div>
          <ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-5">
            {connectorMix.map((entry) => (
              <li
                key={entry.type}
                className="rounded-control border border-line bg-surface-muted px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.8125rem] font-medium text-ink">{entry.type}</span>
                  <span className="ev-figure text-[1.15rem] text-ink">{entry.stations}</span>
                </div>
                <p className="mt-0.5 text-[0.7rem] leading-snug text-ink-subtle">
                  up to {entry.peakPower} kW
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isDemo && (
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-warning-ink">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Demo data — the API is unreachable, so these figures come from the bundled sample
          stations rather than your local database.
        </p>
      )}
    </div>
  );
};

export default PlatformFacts;
