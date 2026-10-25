'use strict';

const express = require('express');
const { ApiError, asyncHandler } = require('../errors');
const v = require('../validate');
const { transaction } = require('../db');
const {
  nowIso,
  newId,
  getStationFull,
  applyWalletTransaction,
} = require('../repo');
const { serializeBooking, serializeSession } = require('../serializers');

const MIN_DURATION = 15;
const MAX_DURATION = 480;
const ACTIVE_STATUSES = ['pending', 'confirmed', 'active'];
/** Assumed round-trip charging efficiency used for *estimates* only. */
const CHARGING_EFFICIENCY = 0.9;

/** Estimate energy + cost. These are projections, not measured values. */
function estimateSession(stationRow, connector, durationMinutes) {
  const hours = durationMinutes / 60;
  const energy = Math.round(connector.max_power_kw * hours * CHARGING_EFFICIENCY * 10) / 10;
  const perKwh = stationRow.price_per_kwh || 0;
  const sessionFee = stationRow.session_fee || 0;
  const cost = Math.round((energy * perKwh + sessionFee) * 100) / 100;
  return { energy, cost };
}

function createBookingsRouter(db, { requireAuth }) {
  const router = express.Router();

  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = v.requireObjectBody(req.body);
      const stationId = v.str(body.stationId, 'Station', { min: 1, max: 100 });
      const connectorType = v.str(body.connectorType, 'Connector type', { min: 1, max: 40 });
      const start = v.isoDate(body.startTime, 'Start time');
      const durationMinutes = v.number(body.durationMinutes, 'Duration', {
        min: MIN_DURATION,
        max: MAX_DURATION,
        integer: true,
      });
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      if (start.getTime() < Date.now() - 60 * 1000) {
        throw ApiError.badRequest('Start time must be in the future.');
      }

      const station = await db.prepare('SELECT * FROM stations WHERE id = ?').get(stationId);
      if (!station) throw ApiError.notFound('Station not found.');

      const connector = await db
        .prepare('SELECT * FROM connectors WHERE station_id = ? AND LOWER(type) = LOWER(?)')
        .get(stationId, connectorType);
      if (!connector) {
        throw ApiError.badRequest(
          `This station does not offer a ${connectorType} connector. Choose a supported connector.`,
        );
      }
      if (station.status === 'Out of Service') {
        throw ApiError.conflict('This station is currently out of service.');
      }

      const booking = await transaction(db, async () => {
        // Re-check conflicts inside the transaction to avoid races.
        const conflict = await db
          .prepare(
            `SELECT id FROM bookings
             WHERE station_id = ? AND LOWER(connector_type) = LOWER(?)
               AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})
               AND start_time < ? AND end_time > ?
             LIMIT 1`,
          )
          .get(stationId, connectorType, ...ACTIVE_STATUSES, end.toISOString(), start.toISOString());

        if (conflict) {
          throw ApiError.conflict(
            'That connector is already reserved for part of this time window. Pick another time or connector.',
          );
        }

        const estimate = estimateSession(station, connector, durationMinutes);
        const id = newId();
        const timestamp = nowIso();
        await db
          .prepare(
            `INSERT INTO bookings
              (id, user_id, station_id, connector_type, start_time, end_time, duration_minutes,
               status, estimated_cost, energy_kwh, currency, simulated, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NULL, ?, 1, ?, ?)`,
          )
          .run(
          id,
          req.user.id,
          stationId,
          connector.type,
          start.toISOString(),
          end.toISOString(),
          durationMinutes,
          estimate.cost,
          station.currency,
          timestamp,
          timestamp,
        );

        return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
      });

      res.status(201).json({
        success: true,
        data: {
          booking: serializeBooking(booking, await getStationFull(db, stationId)),
          note:
            'Demo booking stored in your account. No real station reservation is made without an operator integration.',
        },
      });
    }),
  );

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const page = v.positiveIntQuery(req.query.page, 'page', { fallback: 1, min: 1, max: 1000 });
      const limit = v.positiveIntQuery(req.query.limit, 'limit', { fallback: 10, min: 1, max: 50 });
      const status = v.oneOf(
        req.query.status,
        'status',
        ['all', 'upcoming', 'active', 'completed', 'cancelled'],
        { required: false, fallback: 'all' },
      );

      const where = ['user_id = ?'];
      const params = [req.user.id];
      if (status === 'upcoming') {
        where.push("status IN ('pending','confirmed') AND start_time > ?");
        params.push(nowIso());
      } else if (status === 'active') {
        where.push("status = 'active'");
      } else if (status === 'completed') {
        where.push("status = 'completed'");
      } else if (status === 'cancelled') {
        where.push("status = 'cancelled'");
      }
      const whereSql = `WHERE ${where.join(' AND ')}`;

      const total = Number(
        (await db.prepare(`SELECT COUNT(*) AS c FROM bookings ${whereSql}`).get(...params)).c,
      );
      const rows = await db
        .prepare(`SELECT * FROM bookings ${whereSql} ORDER BY start_time DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, (page - 1) * limit);

      res.json({
        success: true,
        data: {
          bookings: await Promise.all(
            rows.map(async (row) => serializeBooking(row, await getStationFull(db, row.station_id))),
          ),
          total,
          page,
          limit,
          hasMore: (page - 1) * limit + rows.length < total,
        },
      });
    }),
  );

  router.get(
    '/history',
    requireAuth,
    asyncHandler(async (req, res) => {
      const page = v.positiveIntQuery(req.query.page, 'page', { fallback: 1, min: 1, max: 1000 });
      const limit = v.positiveIntQuery(req.query.limit, 'limit', { fallback: 20, min: 1, max: 50 });
      const total = Number(
        (await db
          .prepare('SELECT COUNT(*) AS c FROM charging_sessions WHERE user_id = ? AND ended_at IS NOT NULL')
          .get(req.user.id)).c,
      );
      const rows = await db
        .prepare(
          `SELECT * FROM charging_sessions WHERE user_id = ? AND ended_at IS NOT NULL
           ORDER BY started_at DESC LIMIT ? OFFSET ?`,
        )
        .all(req.user.id, limit, (page - 1) * limit);

      res.json({
        success: true,
        data: {
          sessions: await Promise.all(
            rows.map(async (row) => serializeSession(row, await getStationFull(db, row.station_id))),
          ),
          total,
          page,
          limit,
        },
      });
    }),
  );

  router.get(
    '/sessions/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const session = await db
        .prepare('SELECT * FROM charging_sessions WHERE id = ?')
        .get(req.params.id);
      if (!session) throw ApiError.notFound('Session not found.');
      if (session.user_id !== req.user.id) throw ApiError.forbidden();
      res.json({
        success: true,
        data: {
          session: serializeSession(session, await getStationFull(db, session.station_id)),
        },
      });
    }),
  );

  const loadOwnedBooking = async (req) => {
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) throw ApiError.notFound('Booking not found.');
    // Authorization enforced server-side, not just hidden in the UI.
    if (booking.user_id !== req.user.id) throw ApiError.forbidden();
    return booking;
  };

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const booking = await loadOwnedBooking(req);
      res.json({
        success: true,
        data: {
          booking: serializeBooking(booking, await getStationFull(db, booking.station_id)),
        },
      });
    }),
  );

  router.post(
    '/:id/cancel',
    requireAuth,
    asyncHandler(async (req, res) => {
      const booking = await loadOwnedBooking(req);
      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw ApiError.conflict(`A ${booking.status} booking cannot be cancelled.`);
      }
      await db
        .prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .run(nowIso(), booking.id);
      const updated = await db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
      res.json({
        success: true,
        data: {
          booking: serializeBooking(updated, await getStationFull(db, booking.station_id)),
        },
      });
    }),
  );

  router.post(
    '/:id/start',
    requireAuth,
    asyncHandler(async (req, res) => {
      const booking = await loadOwnedBooking(req);
      if (booking.status !== 'confirmed') {
        throw ApiError.conflict(`Only a confirmed booking can be started (current: ${booking.status}).`);
      }
      const session = await transaction(db, async () => {
        await db
          .prepare("UPDATE bookings SET status = 'active', updated_at = ? WHERE id = ?")
          .run(nowIso(), booking.id);
        const id = newId();
        await db.prepare(
          `INSERT INTO charging_sessions
            (id, booking_id, user_id, station_id, connector_type, started_at, ended_at,
             energy_kwh, cost, currency, simulated, operator_confirmed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, 1, 0, ?)`,
        ).run(
          id,
          booking.id,
          req.user.id,
          booking.station_id,
          booking.connector_type,
          nowIso(),
          booking.currency,
          nowIso(),
        );
        return db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(id);
      });
      res.status(201).json({
        success: true,
        data: {
          session: serializeSession(session, await getStationFull(db, booking.station_id)),
          note: 'Simulated charging session. No real charging hardware is involved.',
        },
      });
    }),
  );

  router.post(
    '/:id/stop',
    requireAuth,
    asyncHandler(async (req, res) => {
      const booking = await loadOwnedBooking(req);
      if (booking.status !== 'active') {
        throw ApiError.conflict('Only an active booking can be stopped.');
      }
      const session = await db
        .prepare("SELECT * FROM charging_sessions WHERE booking_id = ? AND ended_at IS NULL")
        .get(booking.id);
      if (!session) throw ApiError.conflict('No open charging session found for this booking.');

      const connector = await db
        .prepare('SELECT * FROM connectors WHERE station_id = ? AND LOWER(type) = LOWER(?)')
        .get(booking.station_id, booking.connector_type);
      const station = await db.prepare('SELECT * FROM stations WHERE id = ?').get(booking.station_id);

      const elapsedMinutes = Math.max(
        1,
        Math.min(
          booking.duration_minutes,
          Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000),
        ),
      );
      const estimate = estimateSession(station, connector, elapsedMinutes);

      const result = await transaction(db, async () => {
        await db
          .prepare(
            `UPDATE charging_sessions
             SET ended_at = ?, energy_kwh = ?, cost = ? WHERE id = ?`,
          )
          .run(nowIso(), estimate.energy, estimate.cost, session.id);
        await db
          .prepare(
            "UPDATE bookings SET status = 'completed', energy_kwh = ?, estimated_cost = ?, updated_at = ? WHERE id = ?",
          )
          .run(estimate.energy, estimate.cost, nowIso(), booking.id);

        let transactionRow = null;
        if (estimate.cost > 0) {
          transactionRow = await applyWalletTransaction(db, req.user.id, {
            type: 'charge',
            amountMinor: -Math.round(estimate.cost * 100),
            description: `Charging session at ${station.name}`,
            reference: session.id,
          });
        }
        return { transactionRow };
      });

      res.json({
        success: true,
        data: {
          session: serializeSession(
            await db.prepare('SELECT * FROM charging_sessions WHERE id = ?').get(session.id),
            await getStationFull(db, booking.station_id),
          ),
          chargingCost: estimate.cost,
          charged: Boolean(result.transactionRow),
          note: 'Simulated session cost. These values are estimates, not meter readings.',
        },
      });
    }),
  );

  return router;
}

module.exports = { createBookingsRouter };
