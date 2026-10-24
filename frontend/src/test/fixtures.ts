import type { Booking, ChargingStation, SearchResult } from '../types';

/**
 * `stationService.searchStations` always reports where the rows came from, so the
 * fixture requires `source` even though the shared `SearchResult` type has it
 * optional.
 */
export type StationSearchFixture = Omit<SearchResult, 'source'> & {
  source: 'database' | 'demo';
};

/**
 * Domain fixtures for tests. Only the fields the UI actually reads are
 * populated, so a test failure points at a real dependency rather than at a
 * missing fixture field.
 */
export function makeStation(overrides: Partial<ChargingStation> = {}): ChargingStation {
  return {
    id: 'st-1',
    name: 'Downtown Market Street Hub',
    address: '865 Market St',
    city: 'San Francisco',
    postcode: '94103',
    latitude: 37.7842,
    longitude: -122.4075,
    operator: 'Afterglow Demo Network',
    dataSource: 'sample',
    lastSyncedAt: null,
    rating: 4.5,
    reviewCount: 2,
    distance: 1.2,
    amenities: ['WiFi', 'Restrooms'],
    connectorTypes: [
      { id: 'st-1-CCS-150', type: 'CCS', maxPower: 150, available: true, count: 4 },
      { id: 'st-1-CHAdeMO-62', type: 'CHAdeMO', maxPower: 62.5, available: false, count: 2 },
    ],
    chargingSpeed: 'DC Fast',
    pricing: { perKwh: 0.34, sessionFee: 0.5, currency: 'USD' },
    availability: { status: 'Available', availableConnectors: 4, totalConnectors: 6 },
    images: [],
    operatingHours: { isOpen24Hours: true },
    hostType: 'Other',
    ...overrides,
  };
}

export function makeSearchResult(
  overrides: Partial<StationSearchFixture> = {},
): StationSearchFixture {
  return {
    stations: [makeStation()],
    total: 1,
    page: 1,
    limit: 12,
    hasMore: false,
    source: 'database',
    ...overrides,
  };
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    userId: 'user-test-1',
    stationId: 'st-1',
    station: makeStation(),
    startTime: '2026-11-01T10:00:00.000Z',
    endTime: '2026-11-01T11:00:00.000Z',
    duration: 60,
    connectorType: 'CCS',
    status: 'confirmed',
    totalCost: 46.4,
    currency: 'USD',
    simulated: true,
    createdAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-10-15T09:00:00.000Z',
    ...overrides,
  };
}
