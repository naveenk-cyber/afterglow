import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUser, renderWithProviders } from '../test/renderWithProviders';
import { makeBooking, makeStation } from '../test/fixtures';
import BookingPage from './BookingPage';
import { ApiError, authService, bookingService, stationService, tokenStore } from '../services/api';

const BOOKINGS_PAYLOAD = {
  bookings: [makeBooking()],
  total: 1,
  page: 1,
  limit: 20,
  hasMore: false,
};

/** Render the bookings route, optionally with a station preselected. */
function renderBookings(stationId?: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/bookings" element={<BookingPage />} />
      <Route path="/search" element={<h1>Find a station</h1>} />
      <Route path="/login" element={<h1>Sign in</h1>} />
      <Route path="/station/:id" element={<h1>Station detail</h1>} />
    </Routes>,
    { route: stationId ? `/bookings?stationId=${stationId}` : '/bookings', withAuth: true },
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  // Signed-in session for the whole suite.
  tokenStore.set('test-token');
  vi.spyOn(authService, 'me').mockResolvedValue(makeUser());
  vi.spyOn(bookingService, 'getBookings').mockResolvedValue(BOOKINGS_PAYLOAD);
  vi.spyOn(stationService, 'getStationById').mockResolvedValue(makeStation());
});

describe('BookingPage — booking creation', () => {
  it('loads the station, defaults the connector and shows an honest estimate', async () => {
    renderBookings('st-1');

    // The station appears in the create form and in the existing booking card.
    expect(await screen.findAllByText('Downtown Market Street Hub')).toHaveLength(2);
    expect(screen.getByLabelText('Connector')).toHaveValue('CCS');
    expect(screen.getByLabelText('Duration: 60 minutes')).toBeInTheDocument();
    // 150 kW × 1 h × 0.9 = 135 kWh; 135 × $0.34 + $0.50 session fee = $46.40
    expect(screen.getByText(/Estimated 135 kWh · \$46\.40/)).toBeInTheDocument();
    expect(screen.getByText(/Estimate only/)).toBeInTheDocument();
    expect(
      screen.getByText(/This stores a reservation in the Afterglow database only/),
    ).toBeInTheDocument();
  });

  it('creates a booking, confirms it is a demo reservation and returns to the list', async () => {
    const create = vi
      .spyOn(bookingService, 'createBooking')
      .mockResolvedValue({ booking: makeBooking(), note: 'demo' });

    renderBookings('st-1');
    await screen.findAllByText('Downtown Market Street Hub');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(
      await screen.findByText(
        'Booking saved in your account. This is a demo reservation — no real station was contacted.',
      ),
    ).toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][0];
    expect(payload).toMatchObject({ stationId: 'st-1', connectorType: 'CCS', durationMinutes: 60 });
    // The form is dismissed after a successful booking (the page navigates back).
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'New booking' })).not.toBeInTheDocument(),
    );
  });

  it('shows the conflict message when the connector is already reserved', async () => {
    vi.spyOn(bookingService, 'createBooking').mockRejectedValue(
      new ApiError(
        'That connector is already reserved for part of this time window. Pick another time or connector.',
        'CONFLICT',
        409,
      ),
    );

    renderBookings('st-1');
    await screen.findAllByText('Downtown Market Street Hub');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'That connector is already reserved for part of this time window. Pick another time or connector.',
    );
    // The form stays open so the driver can pick another slot.
    expect(screen.getByRole('heading', { name: 'New booking' })).toBeInTheDocument();
  });

  it('reports a station that cannot be loaded', async () => {
    vi.spyOn(stationService, 'getStationById').mockRejectedValue(
      new ApiError('Station not found.', 'NOT_FOUND', 404),
    );

    renderBookings('st-999');
    expect(await screen.findByText(/Could not load that station/)).toBeInTheDocument();
  });
});

describe('BookingPage — list, cancellation and charging', () => {
  it('lists a booking with its status and simulated label', async () => {
    renderBookings();
    const item = (await screen.findAllByRole('listitem')).find((node) =>
      node.textContent?.includes('Downtown Market Street Hub'),
    );
    expect(item).toBeDefined();
    expect(within(item as HTMLElement).getByText('confirmed')).toBeInTheDocument();
    expect(within(item as HTMLElement).getByText('simulated')).toBeInTheDocument();
    expect(within(item as HTMLElement).getByText(/CCS · 60 min/)).toBeInTheDocument();
  });

  it('cancels a confirmed booking', async () => {
    const cancel = vi
      .spyOn(bookingService, 'cancelBooking')
      .mockResolvedValue(makeBooking({ status: 'cancelled' }));

    renderBookings();
    const item = (await screen.findAllByRole('listitem')).find((node) =>
      node.textContent?.includes('Downtown Market Street Hub'),
    );
    await userEvent.click(
      within(item as HTMLElement).getByRole('button', { name: 'Cancel' }),
    );

    expect(await screen.findByText('Booking cancelled.')).toBeInTheDocument();
    expect(cancel).toHaveBeenCalledWith('bk-1');
  });

  it('starts a simulated charging session and says so', async () => {
    const start = vi
      .spyOn(bookingService, 'startCharging')
      .mockResolvedValue({ session: { id: 'sess-1' }, note: 'demo' });

    renderBookings();
    const item = (await screen.findAllByRole('listitem')).find((node) =>
      node.textContent?.includes('Downtown Market Street Hub'),
    );
    await userEvent.click(
      within(item as HTMLElement).getByRole('button', { name: 'Start charging' }),
    );

    expect(
      await screen.findByText(
        'Charging session started (simulated — no real hardware is involved).',
      ),
    ).toBeInTheDocument();
    expect(start).toHaveBeenCalledWith('bk-1');
  });

  it('stops an active session and reports the wallet debit', async () => {
    vi.spyOn(bookingService, 'getBookings').mockResolvedValue({
      ...BOOKINGS_PAYLOAD,
      bookings: [makeBooking({ status: 'active' })],
    });
    const stop = vi
      .spyOn(bookingService, 'stopCharging')
      .mockResolvedValue({ chargingCost: 1.28, charged: true, note: 'demo' });

    renderBookings();
    const item = (await screen.findAllByRole('listitem')).find((node) =>
      node.textContent?.includes('Downtown Market Street Hub'),
    );
    await userEvent.click(
      within(item as HTMLElement).getByRole('button', { name: 'Stop charging' }),
    );

    expect(
      await screen.findByText(
        'Session ended. Estimated cost $1.28 was deducted from your demo wallet.',
      ),
    ).toBeInTheDocument();
    expect(stop).toHaveBeenCalledWith('bk-1');
  });

  it('refuses to start a booking and shows the reason', async () => {
    vi.spyOn(bookingService, 'startCharging').mockRejectedValue(
      new ApiError('Only a confirmed booking can be started (current: cancelled).', 'CONFLICT', 409),
    );

    renderBookings();
    const item = (await screen.findAllByRole('listitem')).find((node) =>
      node.textContent?.includes('Downtown Market Street Hub'),
    );
    await userEvent.click(
      within(item as HTMLElement).getByRole('button', { name: 'Start charging' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only a confirmed booking can be started (current: cancelled).',
    );
  });

  it('filters by status through the API', async () => {
    const getBookings = vi.spyOn(bookingService, 'getBookings');

    renderBookings();
    await screen.findAllByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelled' }));

    await waitFor(() => expect(getBookings).toHaveBeenLastCalledWith('cancelled', 1, 20));
    expect(screen.getByRole('button', { name: 'Cancelled' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows an empty state that links to search', async () => {
    vi.spyOn(bookingService, 'getBookings').mockResolvedValue({
      bookings: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    renderBookings();
    expect(await screen.findByText('No bookings yet')).toBeInTheDocument();
    // The empty-state action is navigation, so it is a link (not a button
    // wrapped in one) and must point at the station finder.
    expect(screen.getByRole('link', { name: 'Find a station' })).toHaveAttribute(
      'href',
      '/search',
    );
  });

  it('shows a retryable error state when the list request fails', async () => {
    vi.spyOn(bookingService, 'getBookings').mockRejectedValue(
      new ApiError('Could not reach the Afterglow API. Is the backend running?', 'NETWORK_ERROR', 0),
    );

    renderBookings();
    expect(await screen.findByText(/Could not load bookings/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('asks signed-out visitors to sign in and does not query bookings', async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    const getBookings = vi.spyOn(bookingService, 'getBookings');

    renderBookings();
    expect(await screen.findByRole('heading', { name: 'Sign in to manage bookings' })).toBeInTheDocument();
    expect(getBookings).not.toHaveBeenCalled();
  });
});
