import { ChargingStation, SearchFilters, SearchResult } from '../types';
import { calculateDistance } from '../utils/helpers';

/**
 * OFFLINE SAMPLE DATA (demo mode).
 *
 * Used only when the Afterglow API cannot be reached, so the interface stays
 * explorable without a backend. These are fictional stations — they are
 * labelled "Sample data" in the UI and must never be presented as real.
 * Mirrors the ids used by the backend seed so links keep working.
 */
type SampleSeed = {
  id: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  lat: number;
  lng: number;
  operator: string;
  hostType: ChargingStation['hostType'];
  speed: ChargingStation['chargingSpeed'];
  status: ChargingStation['availability']['status'];
  amenities: string[];
  pricePerKwh: number;
  sessionFee?: number;
  connectors: { type: ChargingStation['connectorTypes'][number]['type']; kw: number; count: number; available: number }[];
};

const SEED: SampleSeed[] = [
  {
    id: 'st-001', name: 'Downtown Market Street Hub', address: '865 Market St', city: 'San Francisco', postcode: '94103',
    lat: 37.7845, lng: -122.4075, operator: 'Afterglow Demo Network', hostType: 'Other', speed: 'DC Fast', status: 'Available',
    amenities: ['Restrooms', 'WiFi', 'Shopping', '24/7 Access'], pricePerKwh: 0.34, sessionFee: 0.5,
    connectors: [ { type: 'CCS', kw: 150, count: 6, available: 4 }, { type: 'CHAdeMO', kw: 62.5, count: 2, available: 1 } ],
  },
  {
    id: 'st-002', name: 'Embarcadero Center Garage', address: '4 Embarcadero Center', city: 'San Francisco', postcode: '94111',
    lat: 37.7955, lng: -122.3944, operator: 'ChargePoint', hostType: 'ChargePoint', speed: 'Level 2', status: 'Available',
    amenities: ['Parking', 'Restrooms', 'Covered Parking'], pricePerKwh: 0.27,
    connectors: [ { type: 'J1772', kw: 7.2, count: 10, available: 7 }, { type: 'Type 2', kw: 11, count: 4, available: 2 } ],
  },
  {
    id: 'st-003', name: 'Mission Bay Supercharge Plaza', address: '1700 Owens St', city: 'San Francisco', postcode: '94158',
    lat: 37.7699, lng: -122.3939, operator: 'Tesla', hostType: 'Tesla', speed: 'Supercharger', status: 'Busy',
    amenities: ['Food Court', 'Restrooms', 'WiFi'], pricePerKwh: 0.4,
    connectors: [ { type: 'Tesla', kw: 250, count: 12, available: 2 } ],
  },
  {
    id: 'st-004', name: 'EVgo Airport Express', address: 'SFO Long Term Garage', city: 'San Francisco', postcode: '94128',
    lat: 37.6213, lng: -122.379, operator: 'EVgo', hostType: 'EVgo', speed: 'DC Fast', status: 'Available',
    amenities: ['24/7 Access', 'Restrooms', 'ATM'], pricePerKwh: 0.42, sessionFee: 1,
    connectors: [ { type: 'CCS', kw: 350, count: 8, available: 5 }, { type: 'CHAdeMO', kw: 100, count: 2, available: 2 } ],
  },
  {
    id: 'st-005', name: 'Financial District Level 2 Lot', address: '555 California St', city: 'San Francisco', postcode: '94104',
    lat: 37.7924, lng: -122.4057, operator: 'Afterglow Demo Network', hostType: 'Other', speed: 'Level 2', status: 'Available',
    amenities: ['Parking', 'Coffee'], pricePerKwh: 0.24,
    connectors: [ { type: 'J1772', kw: 6.6, count: 8, available: 8 } ],
  },
  {
    id: 'st-006', name: 'SOMA Electrify America Station', address: '680 Folsom St', city: 'San Francisco', postcode: '94105',
    lat: 37.7858, lng: -122.3975, operator: 'Electrify America', hostType: 'Electrify America', speed: 'DC Fast', status: 'Available',
    amenities: ['Restrooms', 'Grocery Store', 'WiFi'], pricePerKwh: 0.36,
    connectors: [ { type: 'CCS', kw: 150, count: 6, available: 3 }, { type: 'CCS', kw: 350, count: 2, available: 1 } ],
  },
  {
    id: 'st-007', name: 'Golden Gate Park Chargers', address: '501 Stanyan St', city: 'San Francisco', postcode: '94117',
    lat: 37.7694, lng: -122.4545, operator: 'ChargePoint', hostType: 'ChargePoint', speed: 'Level 2', status: 'Available',
    amenities: ['Parking', 'Restrooms'], pricePerKwh: 0.22,
    connectors: [ { type: 'J1772', kw: 6.6, count: 6, available: 4 }, { type: 'Type 2', kw: 22, count: 2, available: 1 } ],
  },
  {
    id: 'st-008', name: 'Oakland City Center Garage', address: '1200 Clay St', city: 'Oakland', postcode: '94612',
    lat: 37.8044, lng: -122.2712, operator: 'EVgo', hostType: 'EVgo', speed: 'DC Fast', status: 'Available',
    amenities: ['Parking', 'Restrooms', '24/7 Access'], pricePerKwh: 0.38, sessionFee: 0.75,
    connectors: [ { type: 'CCS', kw: 150, count: 4, available: 4 }, { type: 'CHAdeMO', kw: 50, count: 1, available: 0 } ],
  },
  {
    id: 'st-009', name: 'Berkeley Telegraph Commons', address: '2440 Bancroft Way', city: 'Berkeley', postcode: '94704',
    lat: 37.8677, lng: -122.2585, operator: 'Volta (Demo)', hostType: 'Other', speed: 'Level 2', status: 'Available',
    amenities: ['Coffee', 'Shopping', 'WiFi'], pricePerKwh: 0.2,
    connectors: [ { type: 'J1772', kw: 7.2, count: 4, available: 3 }, { type: 'CCS', kw: 50, count: 2, available: 2 } ],
  },
  {
    id: 'st-010', name: 'Palo Alto University Ave Charger', address: '400 University Ave', city: 'Palo Alto', postcode: '94301',
    lat: 37.4463, lng: -122.1612, operator: 'ChargePoint', hostType: 'ChargePoint', speed: 'Level 2', status: 'Available',
    amenities: ['Restaurant', 'Shopping', 'WiFi'], pricePerKwh: 0.29,
    connectors: [ { type: 'J1772', kw: 7.2, count: 6, available: 5 }, { type: 'Type 2', kw: 22, count: 4, available: 2 } ],
  },
  {
    id: 'st-011', name: 'San Jose Tech Park DC Fast', address: '2880 Zanker Rd', city: 'San Jose', postcode: '95134',
    lat: 37.3869, lng: -121.9419, operator: 'Electrify America', hostType: 'Electrify America', speed: 'DC Fast', status: 'Out of Service',
    amenities: ['Restrooms', '24/7 Access'], pricePerKwh: 0.39,
    connectors: [ { type: 'CCS', kw: 350, count: 4, available: 0 } ],
  },
  {
    id: 'st-012', name: 'Austin Congress Avenue Hub', address: '300 Congress Ave', city: 'Austin', postcode: '78701',
    lat: 30.2669, lng: -97.7428, operator: 'Afterglow Demo Network', hostType: 'Other', speed: 'DC Fast', status: 'Available',
    amenities: ['Restaurant', 'WiFi', 'Restrooms'], pricePerKwh: 0.31, sessionFee: 0.25,
    connectors: [ { type: 'CCS', kw: 180, count: 6, available: 6 }, { type: 'Tesla', kw: 250, count: 4, available: 3 } ],
  },
];

const toStation = (seed: SampleSeed, origin?: { latitude: number; longitude: number }): ChargingStation => {
  const connectorTypes = seed.connectors.map((c, index) => ({
    type: c.type,
    maxPower: c.kw,
    count: c.count,
    available: c.available > 0,
    id: `${seed.id}-${index}`,
  })) as ChargingStation['connectorTypes'];
  const total = seed.connectors.reduce((sum, c) => sum + c.count, 0);
  const available = seed.connectors.reduce((sum, c) => sum + c.available, 0);

  return {
    id: seed.id,
    name: seed.name,
    address: `${seed.address}, ${seed.city} ${seed.postcode}`,
    city: seed.city,
    postcode: seed.postcode,
    latitude: seed.lat,
    longitude: seed.lng,
    operator: seed.operator,
    hostType: seed.hostType,
    chargingSpeed: seed.speed,
    rating: 0,
    reviewCount: 0,
    amenities: seed.amenities,
    connectorTypes,
    pricing: { perKwh: seed.pricePerKwh, sessionFee: seed.sessionFee, currency: 'USD' },
    availability: {
      status: available === 0 ? 'Busy' : seed.status,
      availableConnectors: available,
      totalConnectors: total,
    },
    images: [],
    operatingHours: { isOpen24Hours: true },
    dataSource: 'sample',
    distance: origin
      ? calculateDistance(origin.latitude, origin.longitude, seed.lat, seed.lng)
      : undefined,
  } as ChargingStation;
};

export const SAMPLE_STATIONS: ChargingStation[] = SEED.map((seed) => toStation(seed));

export function getSampleStation(id: string): ChargingStation | undefined {
  return SAMPLE_STATIONS.find((station) => station.id === id);
}

/** Client-side filter/sort/paginate mirroring the backend query behaviour. */
export function searchSampleStations(
  filters: SearchFilters,
  page = 1,
  limit = 12,
): SearchResult & { source: 'demo' } {
  const origin = filters.location
    ? { latitude: filters.location.latitude, longitude: filters.location.longitude }
    : undefined;

  let stations = SEED.map((seed) => toStation(seed, origin));

  if (filters.query) {
    const term = filters.query.toLowerCase();
    stations = stations.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.address.toLowerCase().includes(term) ||
        (s.city || '').toLowerCase().includes(term) ||
        (s.operator || '').toLowerCase().includes(term),
    );
  }
  if (filters.chargingSpeed?.length) {
    stations = stations.filter((s) => filters.chargingSpeed!.includes(s.chargingSpeed));
  }
  if (filters.connectorTypes?.length) {
    stations = stations.filter((s) =>
      s.connectorTypes.some((c) => filters.connectorTypes!.includes(c.type)),
    );
  }
  if (filters.amenities?.length) {
    stations = stations.filter((s) => filters.amenities!.every((a) => s.amenities.includes(a)));
  }
  if (filters.operators?.length) {
    stations = stations.filter((s) => filters.operators!.includes(s.operator || ''));
  }
  if (filters.priceRange?.max !== undefined) {
    stations = stations.filter((s) => (s.pricing.perKwh ?? 0) <= filters.priceRange!.max);
  }
  if (filters.priceRange?.min !== undefined) {
    stations = stations.filter((s) => (s.pricing.perKwh ?? 0) >= filters.priceRange!.min);
  }
  if (filters.availability) {
    stations = stations.filter((s) => s.availability.availableConnectors > 0);
  }
  if (origin && filters.location?.radius) {
    stations = stations.filter((s) => (s.distance ?? 0) <= filters.location!.radius);
  }

  switch (filters.sort) {
    case 'price':
      stations.sort((a, b) => (a.pricing.perKwh ?? Infinity) - (b.pricing.perKwh ?? Infinity));
      break;
    case 'speed':
      stations.sort(
        (a, b) =>
          Math.max(...b.connectorTypes.map((c) => c.maxPower)) -
          Math.max(...a.connectorTypes.map((c) => c.maxPower)),
      );
      break;
    case 'name':
      stations.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'distance':
    case 'rating':
    default:
      stations.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      break;
  }

  const total = stations.length;
  const start = (page - 1) * limit;
  return {
    stations: stations.slice(start, start + limit),
    total,
    page,
    limit,
    hasMore: start + limit < total,
    source: 'demo',
  };
}
