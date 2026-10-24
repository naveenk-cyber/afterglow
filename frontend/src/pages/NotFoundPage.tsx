import { ArrowRight, Compass, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import ButtonLink from '../components/ui/ButtonLink';

const NotFoundPage: React.FC = () => (
  <div className="relative overflow-hidden">
    <div className="ev-grid ev-grid--center" aria-hidden="true" />
    <div className="relative mx-auto flex min-h-[62vh] max-w-[1280px] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-xl text-center">
        <span className="ev-medallion mx-auto h-11 w-11">
          <Compass className="h-5 w-5 text-brand-soft-ink" aria-hidden="true" />
        </span>
        <p className="ev-label mt-5">Error 404</p>
        <h1 className="ev-display mt-3 text-ink">This route is off the map.</h1>
        <p className="mx-auto mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink-muted">
          The page may have moved, or the link may be incomplete. The station finder and your
          account are both still where you left them.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <ButtonLink to="/search" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Find a station
          </ButtonLink>
          <ButtonLink to="/" variant="ghost">
            Back to home
          </ButtonLink>
        </div>
        <p className="mt-6 text-xs text-ink-subtle">
          <LifeBuoy className="mr-1 inline h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />
          Need a hand?{' '}
          <Link to="/contact" className="text-ink-muted underline underline-offset-2 hover:text-ink">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  </div>
);

export default NotFoundPage;
