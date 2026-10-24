import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { makeUser, renderWithProviders } from '../test/renderWithProviders';
import { makeSearchResult, makeStation } from '../test/fixtures';
import DashboardPage from './DashboardPage';
import { authService, stationService, tokenStore, userService } from '../services/api';
import type { UserAnalytics } from '../types';

vi.mock('../components/common/StationMap', () => ({
  default: () => <div data-testid="dashboard-map" />,
}));

const ANALYTICS: UserAnalytics = {
  totalSessions: 4,
  totalEnergyConsumed: 120,
  totalCost: 42,
  carbonFootprintSaved: 0,
  favoriteStations: [],
  monthlyUsage: [{ month: '2026-10', sessions: 4, energyConsumed: 120, cost: 42 }],
  rangeDays: 30,
  rangeStart: '2026-09-23T00:00:00.000Z',
  rangeEnd: '2026-10-23T00:00:00.000Z',
  averageDurationMinutes: 30,
  sessionsPerWeek: 1.2,
  totalBookings: 1,
  previousPeriod: {
    totalSessions: 2,
    totalEnergyConsumed: 60,
    totalCost: 21,
    averageDurationMinutes: 30,
    sessionsPerWeek: 0.6,
  },
  dailyUsage: [
    { date: '2026-10-20', sessions: 2, energyConsumed: 60, cost: 21 },
    { date: '2026-10-21', sessions: 2, energyConsumed: 60, cost: 21 },
  ],
  connectorUsage: [{ label: 'CCS', value: 4 }],
  recentSessions: [
    {
      id: 'sess-1',
      bookingId: 'bk-1',
      stationId: 'st-1',
      station: makeStation(),
      connectorType: 'CCS',
      startedAt: '2026-10-21T10:00:00.000Z',
      endedAt: '2026-10-21T10:30:00.000Z',
      durationMinutes: 30,
      status: 'completed',
      energyKwh: 30,
      cost: 10.5,
      currency: 'USD',
      simulated: true,
      operatorConfirmed: false,
    },
  ],
  upcomingBookings: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  tokenStore.set('test-token');
  vi.spyOn(authService, 'me').mockResolvedValue(makeUser());
  vi.spyOn(userService, 'getAnalytics').mockResolvedValue(ANALYTICS);
  vi.spyOn(stationService, 'searchStations').mockResolvedValue(makeSearchResult());
});

describe('DashboardPage — stored analytics', () => {
  it('renders KPIs and recent sessions from the API rather than sample data', async () => {
    renderWithProviders(<DashboardPage />, { route: '/dashboard', withAuth: true });

    expect(await screen.findByText('Your account data')).toBeInTheDocument();
    expect(await screen.findByText('120 kWh')).toBeInTheDocument();
    expect(screen.getAllByText('$42.00').length).toBeGreaterThan(0);
    expect(screen.getByText('1.2/wk')).toBeInTheDocument();
    expect(screen.getByText('Downtown Market Street Hub')).toBeInTheDocument();
    expect(screen.queryByText('Sample session data')).not.toBeInTheDocument();
  });
});
