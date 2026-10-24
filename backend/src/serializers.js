'use strict';

/** Money is stored in minor units (cents) to avoid floating-point drift. */
const toMajor = (minor) => Math.round(minor) / 100;
const toMinor = (major) => Math.round(Number(major) * 100);

const parseJson = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/** Great-circle distance in miles between two coordinates. */
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function serializeConnector(row) {
  return {
    id: row.id,
    type: row.type,
    maxPower: row.max_power_kw,
    count: row.count,
    // `available` is the number of free connectors for this connector type,
    // not a boolean flag. Keep the boolean for older consumers and expose the
    // exact count so availability totals are not overstated.
    available: row.available > 0,
    availableCount: row.available,
  };
}

/**
 * Shape a station row + its connectors into the frontend `ChargingStation`.
 * `aggregate` optionally carries { rating, reviewCount } from stored reviews.
 */
function serializeStation(row, connectors = [], aggregate = null, origin = null) {
  const connectorTypes = connectors.map(serializeConnector);
  const totalConnectors = connectorTypes.reduce((sum, c) => sum + c.count, 0);
  const availableConnectors = connectors.reduce(
    (sum, connector) => sum + Math.max(0, Number(connector.available) || 0),
    0,
  );
  const status =
    row.status === 'Available' && availableConnectors === 0 ? 'Busy' : row.status;

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    postcode: row.postcode,
    latitude: row.latitude,
    longitude: row.longitude,
    operator: row.operator,
    hostType: row.host_type,
    chargingSpeed: row.charging_speed,
    rating: aggregate ? aggregate.rating : 0,
    reviewCount: aggregate ? aggregate.reviewCount : 0,
    amenities: parseJson(row.amenities_json, []),
    connectorTypes,
    pricing: {
      perKwh: row.price_per_kwh ?? undefined,
      perMinute: row.price_per_minute ?? undefined,
      sessionFee: row.session_fee ?? undefined,
      currency: row.currency,
    },
    availability: {
      status,
      availableConnectors,
      totalConnectors,
    },
    images: parseJson(row.images_json, []),
    operatingHours: parseJson(row.opening_hours_json, { isOpen24Hours: true }),
    dataSource: row.data_source,
    lastSyncedAt: row.last_synced_at,
    distance: origin
      ? distanceMiles(origin.latitude, origin.longitude, row.latitude, row.longitude)
      : undefined,
  };
}

function serializeVehicle(row) {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    batteryCapacity: row.battery_capacity_kwh,
    connectorTypes: parseJson(row.connector_types_json, []),
    estimatedRange: row.estimated_range_km,
    isDefault: Boolean(row.is_default),
  };
}

/** Public user shape — never exposes password_hash. */
function serializeUser(row, vehicles = []) {
  const preferences = parseJson(row.preferences_json, {});
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || undefined,
    avatar: row.avatar || null,
    membershipLevel: row.membership_level,
    preferences: {
      units: preferences.units || 'imperial',
      language: preferences.language || 'en',
      notifications: {
        email: preferences.notifications?.email ?? true,
        push: preferences.notifications?.push ?? false,
        sms: preferences.notifications?.sms ?? false,
      },
    },
    vehicles: vehicles.map(serializeVehicle),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeBooking(row, station = null) {
  return {
    id: row.id,
    userId: row.user_id,
    stationId: row.station_id,
    station,
    connectorType: row.connector_type,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration_minutes,
    status: row.status,
    totalCost: row.estimated_cost,
    energyDelivered: row.energy_kwh ?? undefined,
    currency: row.currency,
    simulated: Boolean(row.simulated),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeSession(row, station = null) {
  const endedAt = row.ended_at || null;
  const durationMinutes = endedAt
    ? Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(row.started_at).getTime()) / 60000))
    : null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    stationId: row.station_id,
    station,
    connectorType: row.connector_type,
    startedAt: row.started_at,
    endedAt,
    durationMinutes,
    status: endedAt ? 'completed' : 'active',
    energyKwh: row.energy_kwh,
    cost: row.cost,
    currency: row.currency,
    simulated: Boolean(row.simulated),
    operatorConfirmed: Boolean(row.operator_confirmed),
  };
}

function serializeTransaction(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: toMajor(row.amount_minor),
    balanceAfter: toMajor(row.balance_after_minor),
    description: row.description,
    reference: row.reference,
    simulated: Boolean(row.simulated),
    createdAt: row.created_at,
  };
}

function serializeWallet(row) {
  return {
    id: row.id,
    userId: row.user_id,
    balanceMinor: row.balance_minor,
    balance: toMajor(row.balance_minor),
    currency: row.currency,
    simulated: Boolean(row.simulated),
    updatedAt: row.updated_at,
  };
}

function serializeReview(row) {
  return {
    id: row.id,
    stationId: row.station_id,
    userId: row.user_id,
    userName: row.user_name || 'Afterglow driver',
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    helpful: row.helpful ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  toMajor,
  toMinor,
  parseJson,
  distanceMiles,
  serializeStation,
  serializeVehicle,
  serializeUser,
  serializeBooking,
  serializeSession,
  serializeTransaction,
  serializeWallet,
  serializeReview,
};
