import React, { useId, useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTipProps {
  /** Short name of the term being explained, used in the button label. */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Contextual help for EV terminology (kW, connector standards, simulated
 * sessions). Keyboard and screen-reader accessible: the trigger is a real
 * button, the bubble is `role="tooltip"` wired through `aria-describedby`, and
 * Escape closes it. No tooltip library is needed for this.
 */
const InfoTip: React.FC<InfoTipProps> = ({ label, children, className = '' }) => {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={`More about ${label}`}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="grid h-4 w-4 place-items-center rounded-full border border-line-strong text-ink-subtle transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Info className="h-2.5 w-2.5" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-56 max-w-[75vw] -translate-x-1/2 rounded-control border border-line-strong bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink-muted shadow-card-hover"
        >
          {children}
        </span>
      )}
    </span>
  );
};

export default InfoTip;
