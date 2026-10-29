import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  AlertCircle, 
  ArrowLeft, 
  BatteryCharging, 
  Building2, 
  Clock, 
  Heart, 
  Info, 
  MapPin, 
  Navigation, 
  Star, 
  Zap 
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Button from '../components/ui/Button';
import ButtonLink from '../components/ui/ButtonLink';
import { buttonClasses } from '../components/ui/buttonStyles';
import Input from '../components/ui/Input';
import StationMap from '../components/common/StationMap';
import Picture from '../components/ui/Picture';
import { stationService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useGeolocation } from '../hooks/useGeolocation';
import { formatDate, formatPrice } from '../utils/helpers';

/** Availability states map onto the shared badge tones, not raw hex colours. */
const AVAILABILITY_TONE = {
  Available: 'success',
  Busy: 'warning',
  'Out of Service': 'danger',
  'Coming Soon': 'neutral',
} as const;

const SECTION = 'bg-surface rounded-card border border-line p-6 shadow-card';

const StationDetailsPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { recordVisit } = useRecentlyViewed();
  const { latitude, longitude, getCurrentLocation, isLoading: locating } = useGeolocation({
    immediate: false,
  });

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  useEffect(() => {
    if (id) recordVisit(id);
  }, [id, recordVisit]);

  const origin =
    latitude != null && longitude != null ? { latitude, longitude } : undefined;

  const stationQuery = useQuery({
    queryKey: ['station', id, origin?.latitude, origin?.longitude],
    queryFn: () => stationService.getStationById(id, origin),
    enabled: Boolean(id),
  });

  const reviewsQuery = useQuery({
    queryKey: ['station', id, 'reviews'],
    queryFn: () => stationService.getReviews(id),
    enabled: Boolean(id),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      stationService.createReview({
        stationId: id,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
      }),
    onSuccess: () => {
      setReviewMessage('Thanks — your review was saved.');
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
      queryClient.invalidateQueries({ queryKey: ['station', id] });
    },
    onError: (error) => setReviewMessage((error as Error).message),
  });

  if (stationQuery.isPending) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4" aria-busy="true">
          <div className="h-8 bg-surface-sunken rounded w-1/3" />
          <div className="h-4 bg-surface-sunken rounded w-2/3" />
          <div className="h-64 bg-surface-sunken rounded" />
        </div>
      </div>
    );
  }

  if (stationQuery.isError || !stationQuery.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-error-ink mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-ink mb-2">
          Station unavailable
        </h1>
        <p className="text-ink-muted mb-6">
          {(stationQuery.error as Error | null)?.message || 'We could not load this station. It may have been removed.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => stationQuery.refetch()}>Retry</Button>
          <Button onClick={() => navigate('/search')}>Back to search</Button>
        </div>
      </div>
    );
  }

  const station = stationQuery.data;
  const availabilityTone = AVAILABILITY_TONE[station.availability.status] ?? 'neutral';
  const directionsUrl = `https://www.openstreetmap.org/directions?from=&to=${station.latitude}%2C${station.longitude}`;

  const maxPower = Math.max(...station.connectorTypes.map((c) => c.maxPower), 0);

  return (
    <div>
      {/* Hero photograph: premium EV charging at modern station */}
<div className="ev-photo-scope relative mb-8 overflow-hidden border-b border-line bg-deep">
        <Picture
          src="/assets/charging-hardware.jpg"
          alt="A premium electric vehicle charging at a modern station, connector illuminated"
          width={1200}
          height={1600}
          fetchPriority="high"
          decoding="async"
          className="h-64 w-full object-cover sm:h-80 lg:h-[22rem]"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,7,8,0.15) 0%, rgba(6,7,8,0.75) 100%)',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          className="mb-4"
          items={[
            { label: 'Home', to: '/' },
            { label: 'Find stations', to: '/search' },
            { label: station.name },
          ]}
        />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 min-h-9 -ml-1 px-1 mb-5 rounded-control text-sm text-ink-muted transition-colors hover:text-brand"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
        </button>

        <header className="bg-surface rounded-card border border-line p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={availabilityTone} dot>
                  {station.availability.status}
                </Badge>
                {station.dataSource === 'sample' && (
                  <Badge tone="warning" icon={<Info />}>
                    Sample data
                  </Badge>
                )}
              </div>
              <h1 className="ev-title text-ink mt-3">{station.name}</h1>
              <p className="ev-body text-ink-muted flex items-start gap-1.5 mt-1.5">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                {station.address}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 ev-meta">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-star" aria-hidden="true" />
                  {station.reviewCount > 0
                    ? `${station.rating} average from ${station.reviewCount} review${station.reviewCount === 1 ? '' : 's'}`
                    : 'No reviews yet — be the first to review'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                  {station.availability.availableConnectors} of{' '}
                  {station.availability.totalConnectors} connectors free
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0 sm:w-44">
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate('/login');
                    return;
                  }
                  void toggleFavorite(id);
                }}
                leftIcon={<Heart className={isFavorite(id) ? 'w-4 h-4 fill-current' : 'w-4 h-4'} />}
              >
                {isFavorite(id) ? 'Saved' : isAuthenticated ? 'Save' : 'Sign in to save'}
              </Button>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={buttonClasses({ variant: 'ghost', size: 'md', fullWidth: true })}
              >
                <span className="flex-shrink-0" aria-hidden="true">
                  <Navigation className="w-4 h-4" />
                </span>
                Directions
              </a>
              <ButtonLink
                to={`/compare?ids=${station.id}`}
                variant="ghost"
                size="md"
                fullWidth
              >
                Compare
              </ButtonLink>
              {latitude == null && (
                <Button variant="ghost" size="md" fullWidth onClick={getCurrentLocation} isLoading={locating}>
                  Use my location
                </Button>
              )}
            </div>
          </div>

          {station.distance != null && (
            <p className="mt-4 text-sm text-ink-muted">
              {station.distance} mi from your location (straight-line estimate, not a driving route).
            </p>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Connectors */}
            <section className={SECTION}>
              <h2 className="ev-card-title text-ink flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-brand" aria-hidden="true" /> Connectors & power
              </h2>
              <ul className="space-y-3 list-none p-0">
                {station.connectorTypes.map((connector, index) => (
                  <li
                    key={connector.id ?? `${connector.type}-${index}`}
                    className="flex items-center justify-between gap-4 p-3 rounded-control bg-surface-muted"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{connector.type}</p>
                      <p className="ev-meta flex items-center gap-1">
                        <BatteryCharging className="w-3 h-3" aria-hidden="true" />
                        up to {connector.maxPower} kW
                      </p>
                    </div>
                    <Badge
                      tone={
                        (connector.availableCount ?? (connector.available ? connector.count : 0)) > 0
                          ? 'brand'
                          : 'neutral'
                      }
                    >
                      {connector.availableCount ?? (connector.available ? connector.count : 0)} of{' '}
                      {connector.count} free
                    </Badge>
                  </li>
                ))}
              </ul>
              {maxPower > 0 && (
                <p className="text-xs text-ink-subtle mt-3">
                  Peak power at this station: {maxPower} kW. Actual charging speed depends on your
                  vehicle and state of charge.
                </p>
              )}
            </section>

            {/* Reviews */}
            <section className={SECTION}>
              <h2 className="ev-card-title text-ink mb-4">
                Reviews ({reviewsQuery.data?.total ?? 0})
              </h2>

              {reviewsQuery.isPending ? (
                <div className="space-y-3" aria-busy="true">
                  <div className="h-16 bg-surface-muted rounded animate-pulse" />
                  <div className="h-16 bg-surface-muted rounded animate-pulse" />
                </div>
              ) : (reviewsQuery.data?.reviews.length ?? 0) === 0 ? (
                <p className="text-sm text-ink-muted">
                  No reviews yet. Reviews are stored in the database and averaged into the rating.
                </p>
              ) : (
                <ul className="space-y-4 list-none p-0">
                  {reviewsQuery.data!.reviews.map((review) => (
                    <li key={review.id} className="border-b border-line pb-4 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              className={`w-3.5 h-3.5 ${index < review.rating ? 'text-star fill-current' : 'text-line-strong'}`}
                              aria-hidden="true"
                            />
                          ))}
                        </span>
                        <span className="text-sm font-medium text-ink">
                          {review.title}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted mt-1">{review.comment}</p>
                      <p className="ev-meta mt-1">
                        {review.userName} · {formatDate(review.createdAt, 'medium')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 pt-6 border-t border-line">
                <h3 className="ev-card-title text-ink mb-3">
                  {isAuthenticated ? 'Write a review' : 'Sign in to write a review'}
                </h3>
                {isAuthenticated ? (
                  <form
                    className="space-y-3"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      setReviewMessage(null);
                      if (!reviewTitle.trim() || !reviewComment.trim()) {
                        setReviewMessage('Add a title and a comment before submitting.');
                        return;
                      }
                      reviewMutation.mutate();
                    }}
                  >
                    <div>
                      <label htmlFor="review-rating" className="ev-label block mb-1.5">
                        Rating
                      </label>
                      <select
                        id="review-rating"
                        value={reviewRating}
                        onChange={(event) => setReviewRating(Number(event.target.value))}
                        className="h-10 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink transition-colors hover:border-brand/50 focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none"
                      >
                        {[5, 4, 3, 2, 1].map((value) => (
                          <option key={value} value={value}>
                            {value} star{value === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Title"
                      value={reviewTitle}
                      onChange={(event) => setReviewTitle(event.target.value)}
                      maxLength={120}
                      required
                      placeholder="Fast and easy to find"
                    />
                    <div>
                      <label htmlFor="review-comment" className="ev-label block mb-1.5">
                        Comment
                      </label>
                      <textarea
                        id="review-comment"
                        value={reviewComment}
                        onChange={(event) => setReviewComment(event.target.value)}
                        rows={3}
                        maxLength={2000}
                        required
                        placeholder="Share what the charging experience was like"
                        className="w-full rounded-control border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle transition-colors hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    {reviewMessage && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="text-sm text-ink-muted"
                      >
                        {reviewMessage}
                      </p>
                    )}
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={reviewMutation.isPending}
                    >
                      Submit review
                    </Button>
                  </form>
                ) : (
                  <ButtonLink to="/login" variant="outline" size="sm">
                    Sign in
                  </ButtonLink>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <section className={SECTION}>
              <h2 className="ev-card-title text-ink mb-4">Location</h2>
              <StationMap
                stations={[station]}
                center={{ latitude: station.latitude, longitude: station.longitude }}
                selectedId={station.id}
                height="220px"
              />
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-ink-muted">
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                  <dt className="sr-only">Operator</dt>
                  <dd>{station.operator || 'Operator not listed'}</dd>
                </div>
                <div className="flex items-center gap-2 text-ink-muted">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <dt className="sr-only">Opening hours</dt>
                  <dd>
                    {station.operatingHours.isOpen24Hours ? 'Open 24 hours' : 'Opening hours vary — check with the operator'}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={SECTION}>
              <h2 className="ev-card-title text-ink mb-2">Pricing</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Per kWh</dt>
                  <dd className="font-medium text-ink">
                    {station.pricing.perKwh != null ? formatPrice(station.pricing.perKwh) : 'Varies'}
                  </dd>
                </div>
                {station.pricing.sessionFee != null && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Session fee</dt>
                    <dd className="font-medium text-ink">
                      {formatPrice(station.pricing.sessionFee)}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-ink-subtle mt-3">
                Prices come from {station.dataSource === 'sample' ? 'bundled sample data' : 'the station feed'} and may
                differ from what the operator charges.
              </p>
            </section>

            {station.amenities.length > 0 && (
              <section className={SECTION}>
                <h2 className="ev-card-title text-ink mb-3">Amenities</h2>
                <ul className="flex flex-wrap gap-2 list-none p-0">
                  {station.amenities.map((amenity) => (
                    <li key={amenity}>
                      <Badge tone="neutral">{amenity}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={SECTION}>
              <h2 className="ev-card-title text-ink mb-2">Data freshness</h2>
              <p className="text-xs text-ink-muted">
                {station.dataSource === 'sample'
                  ? 'This is bundled sample data for demonstration. Availability is not live.'
                  : `Last synced ${station.lastSyncedAt ? formatDate(station.lastSyncedAt, 'datetime') : 'unknown'}.`}
              </p>
            </section>

            <ButtonLink
              to={`/bookings?stationId=${station.id}`}
              variant="primary"
              fullWidth
            >
              Book a charging session
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StationDetailsPage;