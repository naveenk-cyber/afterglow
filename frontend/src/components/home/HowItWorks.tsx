import React from 'react';
import { CalendarCheck2, Search, SlidersHorizontal } from 'lucide-react';
import SectionHeading from '../ui/SectionHeading';

const STEPS = [
  {
    icon: Search,
    title: 'Search where you are going',
    description:
      'Search by city, postcode or station name. Distances are calculated from your location when you allow it.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Filter for your connector',
    description:
      'Narrow the list by connector standard, charging speed and live availability, then sort by price or power.',
  },
  {
    icon: CalendarCheck2,
    title: 'Book and keep the record',
    description:
      'Start a session from the station page and review every booking and simulated charge in your account.',
  },
];

const HowItWorks: React.FC = () => (
  <section aria-labelledby="how-it-works-heading" className="rounded-card border border-line bg-surface p-6 sm:p-8">
    <SectionHeading
      eyebrow="How Afterglow works"
      title="Three steps from range anxiety to a plan"
      description="No account needed to search. An account keeps your bookings, saved stations and wallet in one place."
    />

    <ol className="mt-8 grid gap-7 md:grid-cols-3 md:gap-6">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative">
          <div className="flex items-center gap-3">
            <span className="ev-medallion">
              <step.icon className="h-5 w-5 text-brand-soft-ink" aria-hidden="true" />
            </span>
            <span className="text-xs font-bold tracking-[0.16em] text-ink-subtle">
              STEP {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <h3 className="ev-card-title mt-3 text-ink">{step.title}</h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">{step.description}</p>
          {index < STEPS.length - 1 && (
            <span
              className="absolute left-12 top-6 hidden h-px w-[calc(100%-3rem)] bg-line md:block"
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  </section>
);

export default HowItWorks;
