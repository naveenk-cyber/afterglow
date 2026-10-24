import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUser, renderWithProviders } from '../test/renderWithProviders';
import { makeSearchResult, makeStation } from '../test/fixtures';
import SearchPage from './SearchPage';
import { ApiError, authService, stationService, tokenStore } from '../services/api';

// Leaflet needs a real layout engine, so the map itself is stubbed: these tests
// cover the search, filter, sort and state behaviour around it.
vi.mock('../components/common/StationMap', () => ({
  default: ({ stations }: { stations: unknown[] }) => (
    <div data-testid="station-map">{stations.length} markers</div>
  ),
}));

const FILTER_META = {
  operators: ['Afterglow Demo Network', 'ChargePoint'],
  connectorTypes: ['CCS', 'CHAdeMO', 'J1772'],
  chargingSpeeds: ['DC Fast', 'Level 2'],
  amenities: ['WiFi', 'Restrooms', 'Cafe'],
  priceRange: { min: 0.2, max: 0.6 },
};

function renderSearch(route = '/search') {
  return renderWithProviders(
    <Routes>
      <Route path="/search" element={<SearchPage />} />
      <Route path="/login" element={<h1>Sign in</h1>} />
      <Route path="/station/:id" element={<h1>Station detail</h1>} />
    </Routes>,
    { route, withAuth: true },
  );
}

const searchStations = () => vi.spyOn(stationService, 'searchStations');

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  tokenStore.set('test-token');
  vi.spyOn(authService, 'me').mockResolvedValue(makeUser());
  searchStations().mockResolvedValue(
    makeSearchResult({
      stations: [
        makeStation({ id: 'st-1', name: 'Downtown Market Street Hub' }),
        makeStation({ id: 'st-2', name: 'Embarcadero Center Garage' }),
        makeStation({ id: 'st-3', name: 'Austin Congress Avenue Hub' }),
      ],
      total: 3,
    }),
  );
  vi.spyOn(stationService, 'getFilterMeta').mockResolvedValue(FILTER_META);
});

describe('SearchPage — results and announcements', () => {
  it('renders result cards and announces the count in a live region', async () => {
    renderSearch();

    expect(await screen.findByText('Downtown Market Street Hub')).toBeInTheDocument();
    expect(screen.getByText('Embarcadero Center Garage')).toBeInTheDocument();

    const count = screen.getByText('3 stations');
    expect(count).toHaveAttribute('role', 'status');
    expect(count).toHaveAttribute('aria-live', 'polite');
  });

  it('uses the singular form for one result', async () => {
    searchStations().mockResolvedValue(makeSearchResult({ total: 1 }));
    renderSearch();

    expect(await screen.findByText('1 station')).toBeInTheDocument();
  });

  it('submits a free-text query from the search field', async () => {
    const search = searchStations();
    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    await userEvent.type(screen.getByLabelText('Where'), 'austin');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'austin' }), 1, 12),
    );
  });

  it('shows an empty state with a way to reset the filters', async () => {
    searchStations().mockResolvedValue(makeSearchResult({ stations: [], total: 0 }));
    renderSearch();

    expect(await screen.findByText('No stations match those filters')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0);
  });

  it('reports a failed search and offers a retry', async () => {
    searchStations().mockRejectedValue(
      new ApiError('Search is unavailable.', 'INTERNAL_ERROR', 500),
    );
    renderSearch();

    expect(await screen.findByText('We could not complete that search.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('labels sample data as demo mode instead of presenting it as live', async () => {
    searchStations().mockResolvedValue(makeSearchResult({ source: 'demo' }));
    renderSearch();

    expect((await screen.findAllByText(/Demo mode/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/These are not real stations/)).toBeInTheDocument();
  });
});

describe('SearchPage — filters and sorting', () => {
  it('applies a connector chip filter through the API', async () => {
    const search = searchStations();
    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(await screen.findByRole('button', { name: 'CHAdeMO' }));

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({ connectorTypes: ['CHAdeMO'] }),
        1,
        12,
      ),
    );
  });

  it('applies the charging-speed filter and marks the chip as pressed', async () => {
    const search = searchStations();
    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Level 2' }));

    // Re-query: the panel re-renders when the filter state changes.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Level 2' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({ chargingSpeed: ['Level 2'] }),
        1,
        12,
      ),
    );
  });

  it('applies the "Available now" filter', async () => {
    const search = searchStations();
    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(await screen.findByLabelText('Available now'));

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({ availability: true }),
        1,
        12,
      ),
    );
  });

  it('changes the sort order and resets to the first page', async () => {
    const search = searchStations();
    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'price');

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'price' }), 1, 12),
    );
  });

  it('shows the active filter count on the toggle', async () => {
    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(await screen.findByRole('button', { name: 'WiFi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restrooms' }));

    expect(await screen.findByRole('button', { name: 'Filters (2)' })).toHaveAttribute(
      'aria-controls',
      'search-filters',
    );
  });
});

describe('SearchPage — view mode and favourites', () => {
  it('switches to the map view and marks it pressed', async () => {
    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    expect(screen.getByRole('button', { name: /List/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /Map/ }));

    expect(await screen.findByTestId('station-map')).toHaveTextContent('3 markers');
    expect(screen.getByRole('button', { name: /Map/ })).toHaveAttribute('aria-pressed', 'true');
    // The ?view=map query is written through setSearchParams, which a MemoryRouter
    // keeps in memory rather than in window.location — the browser covers that URL.
    expect(screen.getByRole('button', { name: /List/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers sign-in instead of a dead favourite button for visitors', async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(stationService, 'searchStations').mockResolvedValue(makeSearchResult());
    vi.spyOn(stationService, 'getFilterMeta').mockResolvedValue(FILTER_META);

    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    expect(
      screen.getByRole('link', { name: /Sign in to save Downtown Market Street Hub/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Downtown Market Street Hub/i })).toBeNull();
  });

  it('saves a station for a signed-in driver and confirms it', async () => {
    const addFavorite = vi
      .spyOn(stationService, 'addFavorite')
      .mockResolvedValue(undefined);

    renderSearch();

    await screen.findByText('Downtown Market Street Hub');
    await userEvent.click(
      screen.getByRole('button', { name: /Save Downtown Market Street Hub to favourites/i }),
    );

    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith('st-1'));
    expect(await screen.findByText(/Station added to your favourites\./)).toBeInTheDocument();
  });
});
