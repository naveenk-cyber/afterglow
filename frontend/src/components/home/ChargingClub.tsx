import React from 'react';
import { ArrowRight, Check, Crown } from 'lucide-react';
import ButtonLink from '../ui/ButtonLink';
import Picture from '../ui/Picture';

const BENEFITS = [
  'Priority reservations at partner stations',
  'Discounted per-kWh pricing',
  'Trip tools that plan around chargers',
];

const ChargingClub: React.FC = () => (
  <section
    aria-labelledby="membership-cta-heading"
    className="relative overflow-hidden rounded-[18px] border border-line bg-deep"
  >
    <Picture
      src="/assets/membership-premium.jpg"
      alt="Electric vehicle on a coastal road at dusk"
      width={1200}
      height={800}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover opacity-60"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(100deg, rgba(6,7,8,0.96) 0%, rgba(6,7,8,0.86) 46%, rgba(6,7,8,0.35) 100%)',
      }}
      aria-hidden="true"
    />

    <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-11">
      <div>
        <p className="ev-label flex items-center gap-2">
          <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          Afterglow membership
        </p>
        <h2
          id="membership-cta-heading"
          className="ev-title mt-3 max-w-[19ch] text-deep-ink"
        >
          Less time hunting. More benefits at the plug.
        </h2>
        <p className="mt-3 max-w-lg text-[0.9rem] leading-relaxed text-deep-ink-muted sm:text-[0.95rem]">
          Membership is built around the parts of charging that actually cost you time — finding a
          free connector, knowing the price, and keeping a record of every session.
        </p>

        <ul className="mt-6 space-y-2.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5 text-sm text-deep-ink-muted">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <ButtonLink
            to="/membership"
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Compare plans
          </ButtonLink>
          <ButtonLink to="/signup" variant="glass" size="lg">
            Create an account
          </ButtonLink>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-deep-ink-muted/80">
          Demo build: plans and prices are illustrative, and no payment can be taken.
        </p>
      </div>

      <div className="hidden justify-self-end lg:block">
        <div className="w-[16rem] rounded-card border border-white/15 bg-white/[0.06] p-5 backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deep-ink-muted">
            Premium
          </p>
          <p className="mt-2 flex items-baseline gap-1 text-deep-ink">
            <span className="ev-figure text-[2.4rem]">$9.99</span>
            <span className="text-sm text-deep-ink-muted">/mo</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-deep-ink-muted">
            Everything in Free, plus priority booking and partner pricing.
          </p>
          <div className="mt-4 h-px bg-white/10" />
          <p className="mt-3 text-xs text-deep-ink-muted">
            Billing is not connected in this build.
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default ChargingClub;
