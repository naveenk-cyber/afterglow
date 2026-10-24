'use strict';

const crypto = require('node:crypto');
const config = require('./config');
const { transaction } = require('./db');
const { ApiError } = require('./errors');
const {
  serializeStation,
  serializeVehicle,
  serializeUser,
  serializeBooking,
  serializeSession,
} = require('./serializers');

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function findUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getVehicles(db, userId) {
  return db
    .prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY is_default DESC, created_at ASC')
    .all(userId);
}

function publicUser(db, userRow) {
  return serializeUser(userRow, getVehicles(db, userRow.id));
}

/** Rating aggregate per station (from stored reviews, never hardcoded). */
function ratingAggregates(db, stationIds) {
  const map = new Map();
  if (stationIds.length === 0) return map;
  const placeholders = stationIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT station_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
       FROM reviews WHERE station_id IN (${placeholders}) GROUP BY station_id`,
    )
    .all(...stationIds);
  for (const row of rows) {
    map.set(row.station_id, {
      rating: Math.round(row.avg_rating * 10) / 10,
      reviewCount: row.review_count,
    });
  }
  return map;
}

function connectorsByStation(db, stationIds) {
  const map = new Map();
  if (stationIds.length === 0) return map;
  const placeholders = stationIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM connectors WHERE station_id IN (${placeholders})`)
    .all(...stationIds);
  for (const row of rows) {
    if (!map.has(row.station_id)) map.set(row.station_id, []);
    map.get(row.station_id).push(row);
  }
  return map;
}

function getStationFull(db, id, origin = null) {
  const row = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  if (!row) return null;
  const connectors = db.prepare('SELECT * FROM connectors WHERE station_id = ?').all(id);
  const aggregate = ratingAggregates(db, [id]).get(id) || null;
  return serializeStation(row, connectors, aggregate, origin);
}

/** Ensure the user's demo wallet exists, creating it lazily. */
function ensureWallet(db, userId) {
  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
  if (!wallet) {
    const id = newId();
    db.prepare(
      `INSERT INTO wallets (id, user_id, balance_minor, currency, simulated, updated_at)
       VALUES (?, ?, 0, ?, 1, ?)`,
    ).run(id, userId, config.currency, nowIso());
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
  }
  return wallet;
}

/**
 * Apply a signed wallet movement atomically and record the ledger entry.
 * Positive amountMinor credits, negative debits.
 */
function applyWalletTransaction(db, userId, { type, amountMinor, description, reference = null }) {
  return transaction(db, () => {
    const wallet = ensureWallet(db, userId);
    const nextBalance = wallet.balance_minor + amountMinor;
    if (nextBalance < 0) {
      throw ApiError.conflict('Insufficient wallet balance for this operation.');
    }
    db.prepare('UPDATE wallets SET balance_minor = ?, updated_at = ? WHERE id = ?').run(
      nextBalance,
      nowIso(),
      wallet.id,
    );
    const id = newId();
    db.prepare(
      `INSERT INTO wallet_transactions
        (id, wallet_id, user_id, type, amount_minor, balance_after_minor, description, reference, simulated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      id,
      wallet.id,
      userId,
      type,
      amountMinor,
      nextBalance,
      description,
      reference,
      nowIso(),
    );
    return db.prepare('SELECT * FROM wallet_transactions WHERE id = ?').get(id);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYTICS_DAYS = new Set([7, 30, 90, 365]);

/**
 * Per-user charging statistics computed from stored sessions + bookings.
 *
 * Date ranges are evaluated in UTC against the stored ISO timestamps. Charts
 * receive daily buckets so the client can bucket them for narrow screens
 * without inventing records. Nothing here is hardcoded.
 */
function analyticsFor(db, userId, { days = 30, now = Date.now() } = {}) {
  const rangeDays = ANALYTICS_DAYS.has(Number(days)) ? Number(days) : 30;
  const rangeEnd = new Date(now).toISOString();
  const rangeStart = new Date(now - rangeDays * DAY_MS).toISOString();
  const previousStart = new Date(now - rangeDays * 2 * DAY_MS).toISOString();
  const previousEnd = rangeStart;

  const summarise = (from, to) =>
    db
      .prepare(
        `SELECT
           COUNT(*) AS sessions,
           COALESCE(SUM(energy_kwh), 0) AS energy,
           COALESCE(SUM(cost), 0) AS cost,
           COALESCE(AVG((julianday(ended_at) - julianday(started_at)) * 1440), 0) AS avg_minutes
         FROM charging_sessions
         WHERE user_id = ? AND ended_at IS NOT NULL
           AND started_at >= ? AND started_at < ?`,
      )
      .get(userId, from, to);

  const totals = summarise(rangeStart, rangeEnd);
  const previous = summarise(previousStart, previousEnd);

  const daily = db
    .prepare(
      `SELECT substr(started_at, 1, 10) AS date,
              COUNT(*) AS sessions,
              COALESCE(SUM(energy_kwh), 0) AS energy,
              COALESCE(SUM(cost), 0) AS cost
       FROM charging_sessions
       WHERE user_id = ? AND ended_at IS NOT NULL
         AND started_at >= ? AND started_at < ?
       GROUP BY date ORDER BY date ASC`,
    )
    .all(userId, rangeStart, rangeEnd);

  const connectorUsage = db
    .prepare(
      `SELECT connector_type AS label, COUNT(*) AS value
       FROM charging_sessions
       WHERE user_id = ? AND ended_at IS NOT NULL
         AND started_at >= ? AND started_at < ?
       GROUP BY connector_type ORDER BY value DESC`,
    )
    .all(userId, rangeStart, rangeEnd);

  const monthly = db
    .prepare(
      `SELECT substr(started_at, 1, 7) AS month,
              COUNT(*) AS sessions,
              COALESCE(SUM(energy_kwh), 0) AS energy,
              COALESCE(SUM(cost), 0) AS cost
       FROM charging_sessions
       WHERE user_id = ? AND ended_at IS NOT NULL AND started_at >= ?
       GROUP BY month ORDER BY month ASC`,
    )
    .all(userId, new Date(now - 365 * DAY_MS).toISOString());

  const recentRows = db
    .prepare(
      `SELECT * FROM charging_sessions WHERE user_id = ?
       ORDER BY started_at DESC LIMIT 6`,
    )
    .all(userId);

  const upcomingRows = db
    .prepare(
      `SELECT * FROM bookings
       WHERE user_id = ? AND status IN ('pending', 'confirmed') AND start_time >= ?
       ORDER BY start_time ASC LIMIT 5`,
    )
    .all(userId, new Date(now).toISOString());

  const favorites = db
    .prepare(
      `SELECT s.* FROM favorites f JOIN stations s ON s.id = f.station_id
       WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT 10`,
    )
    .all(userId);

  const favoriteIds = favorites.map((row) => row.id);
  const favoriteConnectors = connectorsByStation(db, favoriteIds);
  const favoriteRatings = ratingAggregates(db, favoriteIds);
  const bookingsCount = db
    .prepare("SELECT COUNT(*) AS c FROM bookings WHERE user_id = ? AND status != 'cancelled'")
    .get(userId);

  return {
    rangeDays,
    rangeStart,
    rangeEnd,
    totalSessions: totals.sessions,
    totalEnergyConsumed: Math.round(totals.energy * 10) / 10,
    totalCost: Math.round(totals.cost * 100) / 100,
    averageDurationMinutes: Math.round(totals.avg_minutes * 10) / 10,
    sessionsPerWeek: Math.round((totals.sessions / rangeDays) * 7 * 10) / 10,
    previousPeriod: {
      totalSessions: previous.sessions,
      totalEnergyConsumed: Math.round(previous.energy * 10) / 10,
      totalCost: Math.round(previous.cost * 100) / 100,
      averageDurationMinutes: Math.round(previous.avg_minutes * 10) / 10,
      sessionsPerWeek: Math.round((previous.sessions / rangeDays) * 7 * 10) / 10,
    },
    totalBookings: bookingsCount.c,
    dailyUsage: daily.map((row) => ({
      date: row.date,
      sessions: row.sessions,
      energyConsumed: Math.round(row.energy * 10) / 10,
      cost: Math.round(row.cost * 100) / 100,
    })),
    connectorUsage: connectorUsage.map((row) => ({
      label: row.label,
      value: row.value,
    })),
    monthlyUsage: monthly.map((row) => ({
      month: row.month,
      sessions: row.sessions,
      energyConsumed: Math.round(row.energy * 10) / 10,
      cost: Math.round(row.cost * 100) / 100,
    })),
    recentSessions: recentRows.map((row) =>
      serializeSession(row, getStationFull(db, row.station_id)),
    ),
    upcomingBookings: upcomingRows.map((row) =>
      serializeBooking(row, getStationFull(db, row.station_id)),
    ),
    favoriteStations: favorites.map((row) =>
      serializeStation(row, favoriteConnectors.get(row.id) || [], favoriteRatings.get(row.id) || null),
    ),
  };
}

function stationExists(db, id) {
  return Boolean(db.prepare('SELECT 1 FROM stations WHERE id = ?').get(id));
}

module.exports = {
  nowIso,
  newId,
  findUserById,
  findUserByEmail,
  getVehicles,
  publicUser,
  ratingAggregates,
  connectorsByStation,
  getStationFull,
  ensureWallet,
  applyWalletTransaction,
  analyticsFor,
  stationExists,
  serializeVehicle,
};
