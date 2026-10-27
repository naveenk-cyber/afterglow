import type React from 'react';
import { Code, Globe } from 'lucide-react';
import AmbientGlow from './AmbientGlow';

type IconProps = { className?: string };

/**
 * GitHub and LinkedIn marks are drawn inline for the same reason the footer
 * draws its social marks: the installed lucide build no longer ships brand
 * glyphs. Everything that is not a brand mark reuses a lucide icon, so no new
 * icon dependency is introduced.
 */
const GitHubIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.55 2.34 1.1 2.91.84.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.02 10.02 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
  </svg>
);

const LinkedInIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.5 8.5H3.4V21h3.1V8.5ZM5 3a1.9 1.9 0 1 0 0 3.8A1.9 1.9 0 0 0 5 3Zm6.2 5.5H8.2V21h3v-6.6c0-1.8.8-2.7 2.1-2.7 1.2 0 1.8.8 1.8 2.7V21h3.1v-7.3c0-3.1-1.6-4.6-3.9-4.6-1.7 0-2.6.9-3 1.6V8.5Z" />
  </svg>
);

interface DeveloperLink {
  name: string;
  href: string;
  icon: React.FC<IconProps>;
}

const LINKS: DeveloperLink[] = [
  { name: 'Portfolio', href: 'https://updatedportfolio-five.vercel.app/', icon: Globe },
  { name: 'GitHub', href: 'https://github.com/naveenk-cyber', icon: GitHubIcon },
  { name: 'CodeChef', href: 'https://www.codechef.com/users/enum4linux', icon: Code },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/naveenk369/', icon: LinkedInIcon },
];

const BIO =
  "I'm Naveen, a B.Tech Information Technology student passionate about software development, problem-solving, and building useful digital products. Afterglow is part of my journey in creating technology-driven solutions.";

/** Everyone who has worked on Afterglow. */
const TEAM = ['Naveen K', 'Sudharshan S', 'Sri Iyappan K'];

/**
 * Developer credits band, rendered directly above the site footer.
 *
 * Provenance: Afterglow is a derivative of ChargeEase by Unseencoderz (Sahil
 * Gautam) — https://github.com/Unseencoderz/ChargeEase — which publishes no
 * LICENSE file (GitHub reports `license: null`), leaving the original work
 * all-rights-reserved by default. The visible credit line was removed at the
 * owner's request; this note stays so the lineage is on the record, and because
 * redistribution or public deployment may need the author's consent.
 */
const DeveloperProfile: React.FC = () => (
  <section aria-labelledby="developer-profile-heading" className="relative pt-10 lg:pt-12">
    <AmbientGlow variant="section" />

    <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
      <div className="rounded-panel border border-line bg-surface p-6 shadow-card transition-[border-color,box-shadow] duration-300 hover:border-brand/25 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-panel border border-brand/25 bg-brand-soft text-brand-soft-ink"
            aria-hidden="true"
          >
            <span className="ev-figure text-[1.4rem]">NK</span>
          </span>

          <div className="min-w-0">
            <h2 id="developer-profile-heading" className="ev-title text-ink">
              Built by Naveen{' '}
              {/* DM Serif Display ships a single 400 weight and `.ev-title` sets
                  font-synthesis-weight: none, so the heavier "K" only renders
                  when synthesis is re-enabled on this span. */}
              <span className="font-bold [font-synthesis-weight:auto]">K</span>
            </h2>
            <p className="mt-2 text-sm font-semibold text-brand-soft-ink">
              The developer behind Afterglow
            </p>
            <p className="mt-3 max-w-3xl text-[0.9rem] leading-relaxed text-ink-muted">{BIO}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                Team
              </span>
              <ul className="flex flex-wrap gap-2">
                {TEAM.map((member) => (
                  <li
                    key={member}
                    className="rounded-full border border-line-strong bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand/40 hover:text-ink"
                  >
                    {member}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <ul className="mt-6 flex flex-wrap gap-2.5">
          {LINKS.map((link) => (
            <li key={link.name}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-control border border-line-strong bg-surface-muted px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand-soft-ink focus-visible:border-brand/50"
              >
                <link.icon className="h-4 w-4" aria-hidden="true" />
                {link.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

export default DeveloperProfile;
