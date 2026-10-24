import type React from 'react';
import { BatteryCharging, CircleDollarSign, Clock, PlugZap, ShieldCheck, Zap } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';
import InfoTip from '../ui/InfoTip';
import ButtonLink from '../ui/ButtonLink';

/**
 * Connector and charging-speed primer.
 *
 * Written for a driver who has just bought their first EV: which plug fits
 * which car, and what the kW numbers actually mean. The standards and power
 * ranges are the widely published ones; nothing here claims a specific
 * station or vehicle supports a plug, and the finder remains the source of
 * truth for a particular site.
 */
const STANDARDS = [
  {
    name: 'CCS',
    kind: 'DC fast',
    power: '50–350 kW',
    note: 'Most non-Tesla EVs in North America and Europe. Adds two power pins below a J1772 or Type 2 socket.',
  },
  {
    name: 'Tesla / NACS',
    kind: 'DC fast & AC',
    power: 'up to 250+ kW',
    note: 'Tesla vehicles, plus a growing number of other brands with a native port or adapter.',
  },
  {
    name: 'CHAdeMO',
    kind: 'DC fast',
    power: '50–100 kW',
    note: 'Older Japanese EVs. Being retired in favour of CCS on new networks.',
  },
  {
    name: 'J1772',
    kind: 'AC Level 2',
    power: '6.6–19 kW',
    note: 'The common North American AC plug for plug-in hybrids and earlier EVs.',
  },
  {
    name: 'Type 2',
    kind: 'AC Level 2',
    power: '11–22 kW',
    note: 'The European AC standard; most public AC points use this socket.',
  },
];

const SPEEDS = [
  {
    icon: Clock,
    title: 'AC Level 2',
    detail: 'Overnight or destination charging. Expect roughly 10–40 miles of range per hour.',
  },
  {
    icon: Zap,
    title: 'DC fast',
    detail: 'Road-trip charging. A 20–40 minute stop is typical, depending on the car and battery state.',
  },
  {
    icon: BatteryCharging,
    title: 'Peak vs actual',
    detail: 'A station’s peak rating is the most it can deliver, not what your car will accept.',
  },
];

const ConnectorGuide: React.FC = () => (
  <section aria-labelledby="connector-guide-heading">
    <SectionHeading
      eyebrow="New to charging?"
      title="Know your plug before you arrive"
      description="Connector standards are not universal. Check the plug your car uses, then filter the finder by that standard and your charging speed."
      action={
        <ButtonLink to="/search" variant="outline" size="md" leftIcon={<PlugZap className="h-4 w-4" />}>
          Filter by connector
        </ButtonLink>
      }
      id="connector-guide-heading"
    />

    <div className="mt-7 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h3 className="ev-label">Connector standards</h3>
        <dl className="mt-4 divide-y divide-line">
          {STANDARDS.map((standard) => (
            <div
              key={standard.name}
              className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr] sm:gap-4"
            >
              <dt className="flex items-baseline gap-2">
                <span className="ev-card-title text-ink">{standard.name}</span>
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.1em] text-brand">
                  {standard.kind}
                </span>
              </dt>
              <dd className="text-[0.8125rem] leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">{standard.power}</span> · {standard.note}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-ink" aria-hidden="true" />
          Standard names describe the plug, not the network. A station listing a CCS connector can
          still be slower than its headline rating.
        </p>
      </div>

      <div className="grid gap-4">
        {SPEEDS.map((item) => (
          <div key={item.title} className="rounded-card border border-line bg-surface p-5 shadow-card">
            <span className="ev-medallion h-9 w-9">
              <item.icon className="h-4 w-4 text-brand-soft-ink" aria-hidden="true" />
            </span>
            <h3 className="ev-card-title mt-3 flex items-center gap-1.5 text-ink">
              {item.title}
              {item.title === 'Peak vs actual' && (
                <InfoTip label="peak power">
                  Kilowatts (kW) measure charging power. Your vehicle, its battery temperature and
                  state of charge all cap what you actually receive.
                </InfoTip>
              )}
            </h3>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">{item.detail}</p>
          </div>
        ))}

        <div className="rounded-card border border-line bg-surface-muted p-5">
          <h3 className="ev-card-title flex items-center gap-1.5 text-ink">
            <CircleDollarSign className="h-4 w-4 text-brand" aria-hidden="true" />
            What a session costs
          </h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
            Prices are listed per kWh where the operator publishes them. Some sites also charge a
            session fee or idle time — the station page shows each line separately.
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default ConnectorGuide;
