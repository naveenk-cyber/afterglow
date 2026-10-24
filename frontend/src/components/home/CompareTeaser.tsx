import type React from 'react';
import { ArrowRight, Check, Minus } from 'lucide-react';
import ButtonLink from '../ui/ButtonLink';

const ATTRIBUTES = [
  { label: 'Peak power', detail: 'kW a connector can deliver, not what your car will accept' },
  { label: 'Price per kWh', detail: 'plus any session fee the operator publishes' },
  { label: 'Connector standards', detail: 'and how many of each are installed' },
  { label: 'Availability', detail: 'free connectors out of the total listed' },
  { label: 'Amenities', detail: 'what is on site while you wait' },
  { label: 'Access and hours', detail: 'operator, opening hours and location notes' },
];

const CompareTeaser: React.FC = () => (
  <section
    aria-labelledby="compare-heading"
    className="relative overflow-hidden rounded-[18px] border border-line bg-surface-muted"
  >
    <div className="ev-grid ev-grid--center" aria-hidden="true" />
    <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:p-10">
      <div>
        <p className="ev-label">Compare before you commit</p>
        <h2 id="compare-heading" className="ev-title mt-2 max-w-[20ch] text-ink">
          Put two stations side by side
        </h2>
        <p className="mt-3 max-w-lg text-[0.9rem] leading-relaxed text-ink-muted">
          Price per kWh is only half the decision. Compare power, connectors, availability and
          amenities from the same catalogue, then open the station that fits.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <ButtonLink
            to="/compare"
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Compare stations
          </ButtonLink>
          <ButtonLink to="/search" variant="ghost" size="md">
            Browse the catalogue
          </ButtonLink>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
          Comparison reads station records directly — no scores, no sponsored placement.
        </p>
      </div>

      <ul className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        {ATTRIBUTES.map((attribute) => (
          <li key={attribute.label} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <Check className="h-2.5 w-2.5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[0.8125rem] font-medium text-ink">{attribute.label}</span>
              <span className="block text-xs leading-relaxed text-ink-subtle">
                {attribute.detail}
              </span>
            </span>
          </li>
        ))}
        <li className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-line text-ink-subtle">
            <Minus className="h-2.5 w-2.5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[0.8125rem] font-medium text-ink">Not compared</span>
            <span className="block text-xs leading-relaxed text-ink-subtle">
              live connector telemetry or reserved capacity — neither exists in this build
            </span>
          </span>
        </li>
      </ul>
    </div>
  </section>
);

export default CompareTeaser;
