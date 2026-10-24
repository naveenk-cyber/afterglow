'use strict';

const express = require('express');
const { ApiError, asyncHandler } = require('../errors');
const v = require('../validate');
const {
  nowIso,
  newId,
  getVehicles,
  publicUser,
  ensureWallet,
  applyWalletTransaction,
  analyticsFor,
  ratingAggregates,
  connectorsByStation,
} = require('../repo');
const {
  serializeWallet,
  serializeTransaction,
  serializeVehicle,
  serializeStation,
  parseJson,
} = require('../serializers');

const CONNECTOR_TYPES = ['J1772', 'CCS', 'CHAdeMO', 'Tesla', 'Type 2'];
const UNITS = ['metric', 'imperial'];
const TOPUP_MIN_MINOR = 100;      // 1.00
const TOPUP_MAX_MINOR = 100000;   // 1,000.00

function createUsersRouter(db, { requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  /* --------------------------------- profile -------------------------------- */

  router.get(
    '/profile',
    asyncHandler((req, res) => {
      res.json({ success: true, data: { user: publicUser(db, req.user) } });
    }),
  );

  router.put(
    '/profile',
    asyncHandler((req, res) => {
      const body = v.requireObjectBody(req.body);
      const current = parseJson(req.user.preferences_json, {});
      const fields = [];
      const params = [];

      if (body.name !== undefined) {
        fields.push('name = ?');
        params.push(v.sanitizeText(v.str(body.name, 'Name', { min: 2, max: 80 })));
      }
      if (body.phone !== undefined) {
        fields.push('phone = ?');
        const phone = v.str(body.phone, 'Phone', { required: false, max: 32 });
        params.push(phone ? v.sanitizeText(phone) : null);
      }
      if (body.avatar !== undefined) {
        const avatar = v.str(body.avatar, 'Avatar', { required: false, max: 500 });
        fields.push('avatar = ?');
        params.push(avatar || null);
      }
      if (body.preferences !== undefined) {
        const prefs = v.requireObjectBody(body.preferences);
        const next = {
          units: prefs.units ? v.oneOf(prefs.units, 'units', UNITS) : current.units || 'imperial',
          language: prefs.language
            ? v.str(prefs.language, 'language', { min: 2, max: 10 })
            : current.language || 'en',
          notifications: {
            email: prefs.notifications?.email ?? current.notifications?.email ?? true,
            push: prefs.notifications?.push ?? current.notifications?.push ?? false,
            sms: prefs.notifications?.sms ?? current.notifications?.sms ?? false,
          },
        };
        fields.push('preferences_json = ?');
        params.push(JSON.stringify(next));
      }

      if (fields.length) {
        fields.push('updated_at = ?');
        params.push(nowIso());
        params.push(req.user.id);
        db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
      }

      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      res.json({ success: true, data: { user: publicUser(db, updated) } });
    }),
  );

  /* -------------------------------- vehicles -------------------------------- */

  router.get(
    '/vehicles',
    asyncHandler((req, res) => {
      res.json({ success: true, data: { vehicles: getVehicles(db, req.user.id).map(serializeVehicle) } });
    }),
  );

  router.post(
    '/vehicles',
    asyncHandler((req, res) => {
      const body = v.requireObjectBody(req.body);
      const make = v.sanitizeText(v.str(body.make, 'Make', { min: 1, max: 60 }));
      const model = v.sanitizeText(v.str(body.model, 'Model', { min: 1, max: 60 }));
      const year = v.number(body.year, 'Year', { min: 1990, max: 2100, integer: true, required: false });
      const battery = v.number(body.batteryCapacity, 'Battery capacity', {
        min: 1,
        max: 500,
        required: false,
      });
      const range = v.number(body.estimatedRange, 'Estimated range', {
        min: 1,
        max: 2000,
        required: false,
      });
      const connectorTypes = v
        .stringArray(body.connectorTypes, 'connectorTypes', { max: 10 })
        .filter((type) => CONNECTOR_TYPES.some((known) => known.toLowerCase() === type.toLowerCase()));

      const id = newId();
      const timestamp = nowIso();
      db.prepare(
        `INSERT INTO vehicles
          (id, user_id, make, model, year, battery_capacity_kwh, connector_types_json,
           estimated_range_km, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        req.user.id,
        make,
        model,
        year ?? null,
        battery ?? null,
        JSON.stringify(connectorTypes),
        range ?? null,
        body.isDefault ? 1 : 0,
        timestamp,
        timestamp,
      );

      res.status(201).json({
        success: true,
        data: { vehicle: serializeVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)) },
      });
    }),
  );

  router.put(
    '/vehicles/:id',
    asyncHandler((req, res) => {
      const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
      if (!existing) throw ApiError.notFound('Vehicle not found.');
      if (existing.user_id !== req.user.id) throw ApiError.forbidden();

      const body = v.requireObjectBody(req.body);
      const fields = [];
      const params = [];
      const setField = (column, value) => {
        fields.push(`${column} = ?`);
        params.push(value);
      };

      if (body.make !== undefined) setField('make', v.sanitizeText(v.str(body.make, 'Make', { min: 1, max: 60 })));
      if (body.model !== undefined) setField('model', v.sanitizeText(v.str(body.model, 'Model', { min: 1, max: 60 })));
      if (body.year !== undefined) setField('year', v.number(body.year, 'Year', { min: 1990, max: 2100, integer: true, required: false }) ?? null);
      if (body.batteryCapacity !== undefined) setField('battery_capacity_kwh', v.number(body.batteryCapacity, 'Battery capacity', { min: 1, max: 500, required: false }) ?? null);
      if (body.estimatedRange !== undefined) setField('estimated_range_km', v.number(body.estimatedRange, 'Estimated range', { min: 1, max: 2000, required: false }) ?? null);
      if (body.connectorTypes !== undefined) {
        const types = v
          .stringArray(body.connectorTypes, 'connectorTypes', { max: 10 })
          .filter((type) => CONNECTOR_TYPES.some((known) => known.toLowerCase() === type.toLowerCase()));
        setField('connector_types_json', JSON.stringify(types));
      }
      if (body.isDefault !== undefined) setField('is_default', body.isDefault ? 1 : 0);

      if (fields.length) {
        setField('updated_at', nowIso());
        params.push(req.params.id);
        db.prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`).run(...params);
      }

      res.json({
        success: true,
        data: {
          vehicle: serializeVehicle(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id)),
        },
      });
    }),
  );

  router.delete(
    '/vehicles/:id',
    asyncHandler((req, res) => {
      const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
      if (!existing) throw ApiError.notFound('Vehicle not found.');
      if (existing.user_id !== req.user.id) throw ApiError.forbidden();
      db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
      res.json({ success: true, data: { deleted: true } });
    }),
  );

  /* -------------------------------- favorites ------------------------------- */

  router.get(
    '/favorites',
    asyncHandler((req, res) => {
      const rows = db
        .prepare(
          `SELECT s.* FROM favorites f JOIN stations s ON s.id = f.station_id
           WHERE f.user_id = ? ORDER BY f.created_at DESC`,
        )
        .all(req.user.id);
      const ids = rows.map((row) => row.id);
      const connectorsMap = connectorsByStation(db, ids);
      const ratings = ratingAggregates(db, ids);
      res.json({
        success: true,
        data: {
          stations: rows.map((row) =>
            serializeStation(row, connectorsMap.get(row.id) || [], ratings.get(row.id) || null),
          ),
        },
      });
    }),
  );

  /* ---------------------------------- wallet -------------------------------- */

  router.get(
    '/wallet',
    asyncHandler((req, res) => {
      const wallet = ensureWallet(db, req.user.id);
      const transactions = db
        .prepare(
          'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
        )
        .all(req.user.id);
      res.json({
        success: true,
        data: {
          wallet: serializeWallet(wallet),
          transactions: transactions.map(serializeTransaction),
          simulated: true,
          notice:
            'This is a simulated demo wallet. It holds no real money and no payment card details are stored.',
        },
      });
    }),
  );

  router.get(
    '/wallet/transactions',
    asyncHandler((req, res) => {
      const page = v.positiveIntQuery(req.query.page, 'page', { fallback: 1, min: 1, max: 1000 });
      const limit = v.positiveIntQuery(req.query.limit, 'limit', { fallback: 20, min: 1, max: 50 });
      const total = db
        .prepare('SELECT COUNT(*) AS c FROM wallet_transactions WHERE user_id = ?')
        .get(req.user.id).c;
      const rows = db
        .prepare(
          'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        )
        .all(req.user.id, limit, (page - 1) * limit);
      res.json({
        success: true,
        data: {
          transactions: rows.map(serializeTransaction),
          total,
          page,
          limit,
          hasMore: (page - 1) * limit + rows.length < total,
        },
      });
    }),
  );

  /**
   * Simulated top-up. There is no payment gateway: the balance is credited
   * directly and the ledger entry is flagged as simulated.
   */
  router.post(
    '/wallet/topup',
    asyncHandler((req, res) => {
      const body = v.requireObjectBody(req.body);
      const amountMinor = v.number(body.amountMinor, 'Amount', {
        min: TOPUP_MIN_MINOR,
        max: TOPUP_MAX_MINOR,
        integer: true,
      });
      const row = applyWalletTransaction(db, req.user.id, {
        type: 'topup',
        amountMinor,
        description: 'Simulated wallet top-up',
        reference: null,
      });
      res.status(201).json({
        success: true,
        data: {
          transaction: serializeTransaction(row),
          wallet: serializeWallet(ensureWallet(db, req.user.id)),
          simulated: true,
          notice: 'Simulated top-up. No real payment was processed.',
        },
      });
    }),
  );

  /* -------------------------------- analytics ------------------------------- */

  router.get(
    '/analytics',
    asyncHandler((req, res) => {
      const days = v.oneOf(req.query.days ?? '30', 'days', ['7', '30', '90', '365'], {
        fallback: '30',
      });
      res.json({
        success: true,
        data: {
          analytics: analyticsFor(db, req.user.id, { days: Number(days) }),
          notice:
            'Figures are computed from your stored bookings and simulated charging sessions. Energy and cost values are estimates, not meter readings.',
        },
      });
    }),
  );

  return router;
}

module.exports = { createUsersRouter };
