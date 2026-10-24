import React, { useId, useState } from 'react';
import { AlertCircle, CheckCircle2, Mail, MapPin, MessageSquare, ShieldCheck } from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Button from '../components/ui/Button';
import ButtonLink from '../components/ui/ButtonLink';
import { VALIDATION_RULES } from '../utils/constants';

const TOPICS = [
  'Station data correction',
  'Booking question',
  'Membership and billing',
  'Privacy or local data',
  'Something else',
];

const FAQS = [
  {
    question: 'Is a connector reserved when I book a slot?',
    answer:
      'No. A booking is recorded in the Afterglow database and checked against other bookings for the same station, but no operator is notified and no physical charger is held. Treat it as a plan, not a reservation.',
  },
  {
    question: 'How current is the availability shown on a station?',
    answer:
      'It is the connector count stored in that station record. This build does not poll an operator network, so the number can be out of date. The station page shows when the record was last updated where the API provides it.',
  },
  {
    question: 'Can I pay for a session or a membership here?',
    answer:
      'No payment is processed. Wallet balances and charging sessions are simulated ledger entries, and paid membership actions remain disabled until billing is genuinely configured.',
  },
  {
    question: 'What data is stored in my browser?',
    answer:
      'Favourites, recently viewed stations and the theme preference. They stay in local storage, are never sent to an analytics service, and can be removed by clearing site data in your browser.',
  },
];

const ContactPage: React.FC = () => {
  const nameId = useId();
  const emailId = useId();
  const topicId = useId();
  const messageId = useId();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < VALIDATION_RULES.NAME_MIN_LENGTH) {
      nextErrors.name = 'Add your name so the reply has someone to address.';
    }
    if (!VALIDATION_RULES.EMAIL.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address, for example driver@example.com.';
    }
    if (message.trim().length < 10) {
      nextErrors.message = 'Add a little more detail (at least 10 characters).';
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus('');
      return;
    }

    const subject = encodeURIComponent(`[Afterglow] ${topic}`);
    const body = encodeURIComponent(`${message.trim()}\n\n— ${name.trim()} (${email.trim()})`);
    setStatus(
      'Your email app should open with the message ready to send. Nothing was stored on this server.',
    );
    window.location.href = `mailto:support@afterglow.app?subject=${subject}&body=${body}`;
  };

  const fieldClass = (hasError: boolean) =>
    `w-full rounded-control border bg-surface-muted px-3.5 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-error/60 focus:border-error focus:ring-error/25'
        : 'border-line hover:border-line-strong focus:border-brand focus:ring-brand/25'
    }`;

  return (
    <div>
      <PageHero
        eyebrow="Contact"
        title="Ask about the data, a booking, or the build"
        description="Corrections and questions are welcome. This demo does not run a ticketing system, so the form composes an email in your own mail app rather than pretending to submit a ticket."
      />

      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6"
          >
            <h2 className="ev-card-title text-ink">Send a message</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Fields marked with an asterisk are required. The message opens in your email client,
              addressed to support@afterglow.app.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={nameId} className="mb-1.5 block text-sm font-medium text-ink">
                  Name <span className="text-brand">*</span>
                </label>
                <input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${nameId}-error` : undefined}
                  className={`${fieldClass(Boolean(errors.name))} h-11`}
                  placeholder="Alex Rivera"
                />
                {errors.name && (
                  <p id={`${nameId}-error`} className="mt-1.5 flex items-start gap-1.5 text-xs text-error-ink">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-ink">
                  Email <span className="text-brand">*</span>
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? `${emailId}-error` : undefined}
                  className={`${fieldClass(Boolean(errors.email))} h-11`}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p id={`${emailId}-error`} className="mt-1.5 flex items-start gap-1.5 text-xs text-error-ink">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor={topicId} className="mb-1.5 block text-sm font-medium text-ink">
                Topic
              </label>
              <select
                id={topicId}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className={`${fieldClass(false)} h-11`}
              >
                {TOPICS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label htmlFor={messageId} className="mb-1.5 block text-sm font-medium text-ink">
                Message <span className="text-brand">*</span>
              </label>
              <textarea
                id={messageId}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? `${messageId}-error` : undefined}
                className={`${fieldClass(Boolean(errors.message))} py-3`}
                placeholder="Include the station name, city and what looks wrong or unclear."
              />
              {errors.message && (
                <p id={`${messageId}-error`} className="mt-1.5 flex items-start gap-1.5 text-xs text-error-ink">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {errors.message}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" leftIcon={<Mail className="h-4 w-4" />}>
                Open in email app
              </Button>
              <p className="text-xs leading-relaxed text-ink-subtle">
                No message is uploaded or stored by this page.
              </p>
            </div>

            {status && (
              <p
                role="status"
                className="mt-4 flex items-start gap-2 rounded-control border border-success/30 bg-success-soft px-3 py-2.5 text-xs leading-relaxed text-success-ink"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {status}
              </p>
            )}
          </form>

          <div className="grid gap-4">
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="ev-card-title flex items-center gap-2 text-ink">
                <Mail className="h-4 w-4 text-brand" aria-hidden="true" />
                Direct email
              </h2>
              <a
                href="mailto:support@afterglow.app"
                className="mt-2 inline-block text-sm font-medium text-brand underline-offset-2 hover:underline"
              >
                support@afterglow.app
              </a>
              <p className="mt-2 text-xs leading-relaxed text-ink-subtle">
                This is a demo deployment. No inbox is monitored and no response time is promised.
              </p>
            </div>

            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="ev-card-title flex items-center gap-2 text-ink">
                <MessageSquare className="h-4 w-4 text-brand" aria-hidden="true" />
                What to include
              </h2>
              <ul className="mt-3 space-y-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  The station name and city, if the question is about a specific record.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  The connector or power figure you expected, and where you saw it.
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  Never send card numbers, passwords or API keys.
                </li>
              </ul>
            </div>

            <div className="rounded-card border border-line bg-surface-muted p-5">
              <h2 className="ev-card-title flex items-center gap-2 text-ink">
                <ShieldCheck className="h-4 w-4 text-success-ink" aria-hidden="true" />
                Privacy
              </h2>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                Account data lives in the project database. Favourites and recently viewed stations
                stay in this browser. There is no advertising tracker in this build.
              </p>
              <ButtonLink to="/about" variant="ghost" size="sm" className="mt-3">
                Read how the data works
              </ButtonLink>
            </div>
          </div>
        </div>

        <section className="mt-10" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="ev-title text-ink">
            Common questions
          </h2>
          <div className="mt-5 divide-y divide-line rounded-card border border-line bg-surface">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  {faq.question}
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-ink-subtle transition-transform group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2.5 max-w-3xl pr-8 text-[0.8125rem] leading-relaxed text-ink-muted">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-col gap-3 rounded-card border border-line bg-surface-muted px-5 py-4 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" aria-hidden="true" />
            Looking for a charger instead? The finder is public and needs no account.
          </p>
          <ButtonLink to="/search" variant="primary" size="sm">
            Find stations
          </ButtonLink>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
