import { describe, expect, it } from 'vitest';
import {
  buildQueryString,
  calculateDistance,
  capitalize,
  formatDistance,
  formatPrice,
  filterStations,
  getAvailabilityColor,
  getErrorMessage,
  groupBy,
  parseQueryString,
  slugify,
  sortBy,
  truncateText,
  uniqueBy,
  validateEmail,
  validatePassword,
  validatePhone,
} from './helpers';
import type { ChargingStation, SearchFilters } from '../types';

/** Minimal station factory — only the fields the filter logic reads. */
function makeStation(overrides: Partial<ChargingStation> = {}): ChargingStation {
  return {
    id: 'st-1',
    name: 'Test Hub',
    address: '1 Test St',
    latitude: 30,
    longitude: -97,
    operator: 'Afterglow Demo Network',
    hostType: 'Other',
    chargingSpeed: 'DC Fast',
    rating: 4.5,
    reviewCount: 3,
    amenities: ['WiFi'],
    connectorTypes: [{ type: 'CCS', maxPower: 150, available: true, count: 2 }],
    pricing: { perKwh: 0.42, currency: 'USD' },
    availability: { status: 'Available', availableConnectors: 2, totalConnectors: 2 },
    images: [],
    operatingHours: { isOpen24Hours: true },
    ...overrides,
  };
}

describe('formatting helpers', () => {
  it('formats prices as USD currency', () => {
    expect(formatPrice(12.5)).toBe('$12.50');
    expect(formatPrice(12.5, 'USD', false)).toBe('$13');
  });

  it('formats distances with a sub-0.1 floor', () => {
    expect(formatDistance(0.04)).toBe('<0.1');
    expect(formatDistance(0.5)).toBe('0.5');
    expect(formatDistance(4.6)).toBe('5');
  });

  it('capitalizes, truncates and slugifies text', () => {
    expect(capitalize('hELLO')).toBe('Hello');
    expect(truncateText('abcdefghij', 5)).toBe('abcde...');
    expect(truncateText('abc', 5)).toBe('abc');
    expect(slugify('Tesla Supercharger — Austin!')).toBe('tesla-supercharger-austin');
  });
});

describe('calculateDistance', () => {
  it('returns great-circle distance in miles and km', () => {
    // Austin -> Dallas is roughly 190 miles / 306 km.
    const miles = calculateDistance(30.2669, -97.7428, 32.7767, -96.797);
    const km = calculateDistance(30.2669, -97.7428, 32.7767, -96.797, 'km');
    expect(miles).toBeGreaterThan(180);
    expect(miles).toBeLessThan(200);
    expect(km).toBeGreaterThan(290);
    expect(km).toBeLessThan(320);
  });

  it('is zero for the same point', () => {
    expect(calculateDistance(30, -97, 30, -97)).toBe(0);
  });
});

describe('validation helpers', () => {
  it('accepts valid emails and rejects malformed ones', () => {
    expect(validateEmail('driver@afterglow.test')).toBe(true);
    expect(validateEmail('driver@afterglow')).toBe(false);
    expect(validateEmail('not-an-email')).toBe(false);
  });

  it('requires at least 10 digits for phone numbers', () => {
    expect(validatePhone('+1 (512) 555-0134')).toBe(true);
    expect(validatePhone('12345')).toBe(false);
  });

  it('enforces the documented password policy', () => {
    // Same rules as the API: 8+ chars, upper, lower, number and a special character.
    expect(validatePassword('Demo1234!').isValid).toBe(true);

    const weak = validatePassword('short');
    expect(weak.isValid).toBe(false);
    expect(weak.errors).toContain('Password must be at least 8 characters long');
    expect(weak.errors).toContain('Password must contain at least one uppercase letter');
    expect(weak.errors).toContain('Password must contain at least one number');
    expect(weak.errors).toContain('Password must contain at least one special character');

    // No special character, but otherwise valid.
    expect(validatePassword('Demo1234').errors).toEqual([
      'Password must contain at least one special character',
    ]);
  });
});

describe('array and query helpers', () => {
  it('groups, sorts and de-duplicates', () => {
    const rows = [
      { city: 'Austin', n: 2 },
      { city: 'Dallas', n: 3 },
      { city: 'Austin', n: 1 },
    ];
    expect(Object.keys(groupBy(rows, 'city'))).toEqual(['Austin', 'Dallas']);
    expect(sortBy(rows, 'n').map((r) => r.n)).toEqual([1, 2, 3]);
    expect(sortBy(rows, 'n', 'desc').map((r) => r.n)).toEqual([3, 2, 1]);
    expect(uniqueBy(rows, 'city')).toHaveLength(2);
  });

  it('builds and parses query strings symmetrically', () => {
    const qs = buildQueryString({ city: 'Austin', page: 2, skip: undefined, amenities: ['WiFi', 'Cafe'] });
    expect(qs).toBe('city=Austin&page=2&amenities=WiFi&amenities=Cafe');
    const parsed = parseQueryString(qs);
    expect(parsed.city).toBe('Austin');
    expect(parsed.amenities).toEqual(['WiFi', 'Cafe']);
  });
});

describe('filterStations', () => {
  const stations = [
    makeStation({ id: 'a', chargingSpeed: 'DC Fast', amenities: ['WiFi', 'Cafe'], rating: 4.5 }),
    makeStation({ id: 'b', chargingSpeed: 'Level 2', amenities: ['WiFi'], rating: 3.2 }),
    makeStation({
      id: 'c',
      chargingSpeed: 'Level 1',
      connectorTypes: [{ type: 'CHAdeMO', maxPower: 50, available: false, count: 1 }],
      availability: { status: 'Busy', availableConnectors: 0, totalConnectors: 1 },
      rating: 4.9,
    }),
  ];
  const base: SearchFilters = {};

  it('returns every station when no filter is set', () => {
    expect(filterStations(stations, base)).toHaveLength(3);
  });

  it('filters by charging speed, connector, amenity, availability and rating', () => {
    expect(filterStations(stations, { ...base, chargingSpeed: ['DC Fast'] }).map((s) => s.id)).toEqual(['a']);
    expect(filterStations(stations, { ...base, connectorTypes: ['CHAdeMO'] }).map((s) => s.id)).toEqual(['c']);
    expect(filterStations(stations, { ...base, amenities: ['WiFi', 'Cafe'] }).map((s) => s.id)).toEqual(['a']);
    expect(filterStations(stations, { ...base, availability: true }).map((s) => s.id)).toEqual(['a', 'b']);
    expect(filterStations(stations, { ...base, rating: 4 }).map((s) => s.id)).toEqual(['a', 'c']);
  });
});

describe('misc helpers', () => {
  it('maps statuses to the documented colours', () => {
    expect(getAvailabilityColor('Available')).toBe('#10B981');
    expect(getAvailabilityColor('Busy')).toBe('#F59E0B');
    expect(getAvailabilityColor('Out of Service')).toBe('#EF4444');
    expect(getAvailabilityColor('unknown')).toBe('#6B7280');
  });

  it('extracts readable error messages', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('boom')).toBe('boom');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });
});
