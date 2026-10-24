'use strict';

const express = require('express');
const { ApiError, asyncHandler } = require('../errors');
const v = require('../validate');
const {
  nowIso,
  newId,
  getStationFull,
  ratingAggregates,
  connectorsByStation,
  stationExists,
} = require('../repo');
const { serializeStation, serializeReview, parseJson } = require('../serializers');

const MAX_LIMIT = 50;

const asArray = (value) => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

function buildOrderClause(sort) {
  switch (sort) {
    case 'price':
      return '(s.price_per_kwh IS NULL), s.price_per_kwh ASC';
    case 'rating':
      return 'avg_rating DESC';
    case 'speed':
      return 'max_power DESC';
    case 'name':
      return 's.name ASC';
    case 'availability':
      // Share of connectors currently reported free, stations with more
      // free hardware first. Derived from the same connector rows the station
      // payload uses, so the order cannot drift from the displayed counts.
      return `(
        SELECT COALESCE(SUM(MIN(c.available, c.count)), 0) * 1.0
               / NULLIF(SUM(c.count), 0)
        FROM connectors c WHERE c.station_id = s.id
      ) DESC, s.name ASC`;
    case 'distance':
    default:
      return 's.name ASC';
  }
}

const SORTS = ['distance', 'price', 'rating', 'speed', 'availability', 'name'];

function createStationsRouter(db, { requireAuth }) {
  const router = express.Router();

  // Static routes first so "/meta/filters" is not captured by "/:id".
  router.get(
    '/meta/filters',
    asyncHandler((req, res) => {
      const operators = db
        .prepare('SELECT DISTINCT operator FROM stations ORDER BY operator')
        .all()
        .map((row) => row.operator);
      const connectorTypes = db
        .prepare('SELECT DISTINCT type FROM connectors ORDER BY type')
        .all()
        .map((row) => row.type);
      const chargingSpeeds = db
        .prepare('SELECT DISTINCT charging_speed FROM stations ORDER BY charging_speed')
        .all()
        .map((row) => row.charging_speed);
      const amenities = new Set();
      for (const row of db.prepare('SELECT amenities_json FROM stations').all()) {
        for (const amenity of parseJson(row.amenities_json, [])) amenities.add(amenity);
      }
      const priceRow = db
        .prepare('SELECT MIN(price_per_kwh) AS min, MAX(price_per_kwh) AS max FROM stations')
        .get();

      res.json({
        success: true,
        data: {
          operators,
          connectorTypes,
          chargingSpeeds,
          amenities: [...amenities].sort(),
          priceRange: { min: priceRow.min ?? 0, max: priceRow.max ?? 0 },
        },
      });
    }),
  );

  router.get(
    '/',
    asyncHandler((req, res) => {
      const query = req.query;
      const page = v.positiveIntQuery(query.page, 'page', { fallback: 1, min: 1, max: 10000 });
      const limit = v.positiveIntQuery(query.limit, 'limit', { fallback: 12, min: 1, max: MAX_LIMIT });
      const sort = v.oneOf(query.sort, 'sort', SORTS, { required: false, fallback: 'distance' });

      const where = [];
      const params = [];

      if (query.q) {
        const term = `%${String(query.q).trim().toLowerCase()}%`;
        where.push(
          '(LOWER(s.name) LIKE ? OR LOWER(s.address) LIKE ? OR LOWER(s.city) LIKE ? OR LOWER(s.postcode) LIKE ? OR LOWER(s.operator) LIKE ?)',
        );
        params.push(term, term, term, term, term);
      }
      if (query.city) {
        where.push('LOWER(s.city) = ?');
        params.push(String(query.city).trim().toLowerCase());
      }
      if (query.postcode) {
        where.push('s.postcode LIKE ?');
        params.push(`${String(query.postcode).trim()}%`);
      }
      const speeds = asArray(query.chargingSpeed).map(String);
      if (speeds.length) {
        where.push(`s.charging_speed IN (${speeds.map(() => '?').join(',')})`);
        params.push(...speeds);
      }
      const operators = asArray(query.operator).map(String);
      if (operators.length) {
        where.push(`s.operator IN (${operators.map(() => '?').join(',')})`);
        params.push(...operators);
      }
      const connectors = asArray(query.connectorType).map(String);
      if (connectors.length) {
        where.push(
          `EXISTS (SELECT 1 FROM connectors c WHERE c.station_id = s.id AND c.type IN (${connectors
            .map(() => '?')
            .join(',')}))`,
        );
        params.push(...connectors);
      }
      const amenities = asArray(query.amenity).map(String);
      for (const amenity of amenities) {
        where.push("s.amenities_json LIKE ?");
        params.push(`%"${amenity}"%`);
      }
      const minPrice = query.minPrice === undefined ? null : Number(query.minPrice);
      if (minPrice !== null && Number.isFinite(minPrice)) {
        where.push('s.price_per_kwh >= ?');
        params.push(minPrice);
      }
      const maxPrice = query.maxPrice === undefined ? null : Number(query.maxPrice);
      if (maxPrice !== null && Number.isFinite(maxPrice)) {
        where.push('s.price_per_kwh <= ?');
        params.push(maxPrice);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const orderSql = buildOrderClause(sort);

      const rows = db
        .prepare(
          `SELECT s.*,
                  (SELECT AVG(r.rating) FROM reviews r WHERE r.station_id = s.id) AS avg_rating,
                  (SELECT COUNT(*) FROM reviews r WHERE r.station_id = s.id) AS review_count,
                  (SELECT MAX(c.max_power_kw) FROM connectors c WHERE c.station_id = s.id) AS max_power
           FROM stations s
           ${whereSql}
           ORDER BY ${orderSql}`,
        )
        .all(...params);

      const lat = query.lat !== undefined ? Number(query.lat) : null;
      const lng = query.lng !== undefined ? Number(query.lng) : null;
      const radius = query.radius !== undefined ? Number(query.radius) : null;
      const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);
      const origin = hasOrigin ? { latitude: lat, longitude: lng } : null;

      const ids = rows.map((row) => row.id);
      const connectorsMap = connectorsByStation(db, ids);

      let stations = rows.map((row) =>
        serializeStation(
          row,
          connectorsMap.get(row.id) || [],
          row.review_count > 0 ? { rating: Math.round(row.avg_rating * 10) / 10, reviewCount: row.review_count } : null,
          origin,
        ),
      );

      if (hasOrigin && Number.isFinite(radius)) {
        stations = stations.filter((station) => station.distance <= radius);
      }
      if (String(query.available).toLowerCase() === 'true') {
        stations = stations.filter((station) => station.availability.availableConnectors > 0);
      }
      const minRating = query.minRating === undefined ? null : Number(query.minRating);
      if (minRating !== null && Number.isFinite(minRating)) {
        stations = stations.filter((station) => station.rating >= minRating);
      }

      if (sort === 'distance') {
        stations.sort((a, b) => {
          if (hasOrigin) return (a.distance ?? 0) - (b.distance ?? 0);
          return a.name.localeCompare(b.name);
        });
      }

      const total = stations.length;
      const start = (page - 1) * limit;
      const pageItems = stations.slice(start, start + limit);

      res.json({
        success: true,
        data: {
          stations: pageItems,
          total,
          page,
          limit,
          hasMore: start + limit < total,
          source: 'database',
        },
      });
    }),
  );

  router.get(
    '/nearby',
    asyncHandler((req, res) => {
      const latitude = v.number(req.query.lat, 'lat', { min: -90, max: 90 });
      const longitude = v.number(req.query.lng, 'lng', { min: -180, max: 180 });
      const radius = v.number(req.query.radius, 'radius', { min: 1, max: 500, required: false }) ?? 25;

      const ids = db.prepare('SELECT id FROM stations').all().map((row) => row.id);
      const connectorsMap = connectorsByStation(db, ids);
      const ratings = ratingAggregates(db, ids);
      const origin = { latitude, longitude };

      const stations = db
        .prepare('SELECT * FROM stations')
        .all()
        .map((row) =>
          serializeStation(row, connectorsMap.get(row.id) || [], ratings.get(row.id) || null, origin),
        )
        .filter((station) => station.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50);

      res.json({ success: true, data: { stations, total: stations.length } });
    }),
  );

  router.get(
    '/:id',
    asyncHandler((req, res) => {
      const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
      const lng = req.query.lng !== undefined ? Number(req.query.lng) : null;
      const origin =
        Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
      const station = getStationFull(db, req.params.id, origin);
      if (!station) throw ApiError.notFound('Station not found.');
      res.json({ success: true, data: { station } });
    }),
  );

  router.get(
    '/:id/reviews',
    asyncHandler((req, res) => {
      if (!stationExists(db, req.params.id)) throw ApiError.notFound('Station not found.');
      const page = v.positiveIntQuery(req.query.page, 'page', { fallback: 1, min: 1, max: 1000 });
      const limit = v.positiveIntQuery(req.query.limit, 'limit', { fallback: 10, min: 1, max: 50 });

      const total = db
        .prepare('SELECT COUNT(*) AS c FROM reviews WHERE station_id = ?')
        .get(req.params.id).c;
      const rows = db
        .prepare(
          `SELECT r.*, u.name AS user_name FROM reviews r
           JOIN users u ON u.id = r.user_id
           WHERE r.station_id = ?
           ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
        )
        .all(req.params.id, limit, (page - 1) * limit);

      const aggregate = ratingAggregates(db, [req.params.id]).get(req.params.id) || {
        rating: 0,
        reviewCount: 0,
      };

      res.json({
        success: true,
        data: {
          reviews: rows.map(serializeReview),
          total,
          averageRating: aggregate.rating,
          page,
          limit,
        },
      });
    }),
  );

  router.post(
    '/:id/reviews',
    requireAuth,
    asyncHandler((req, res) => {
      if (!stationExists(db, req.params.id)) throw ApiError.notFound('Station not found.');
      const body = v.requireObjectBody(req.body);
      const rating = v.number(body.rating, 'rating', { min: 1, max: 5, integer: true });
      const title = v.str(body.title, 'Title', { min: 3, max: 120 });
      const comment = v.str(body.comment, 'Comment', { min: 5, max: 2000 });

      const timestamp = nowIso();
      const existing = db
        .prepare('SELECT id FROM reviews WHERE station_id = ? AND user_id = ?')
        .get(req.params.id, req.user.id);

      if (existing) {
        db.prepare(
          'UPDATE reviews SET rating = ?, title = ?, comment = ?, updated_at = ? WHERE id = ?',
        ).run(rating, v.sanitizeText(title), v.sanitizeText(comment), timestamp, existing.id);
      } else {
        db.prepare(
          `INSERT INTO reviews (id, station_id, user_id, rating, title, comment, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          newId(),
          req.params.id,
          req.user.id,
          rating,
          v.sanitizeText(title),
          v.sanitizeText(comment),
          timestamp,
          timestamp,
        );
      }

      const row = db
        .prepare(
          `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
           WHERE r.station_id = ? AND r.user_id = ?`,
        )
        .get(req.params.id, req.user.id);

      res.status(201).json({ success: true, data: { review: serializeReview(row) } });
    }),
  );

  router.post(
    '/:id/favorite',
    requireAuth,
    asyncHandler((req, res) => {
      if (!stationExists(db, req.params.id)) throw ApiError.notFound('Station not found.');
      db.prepare(
        'INSERT OR IGNORE INTO favorites (user_id, station_id, created_at) VALUES (?, ?, ?)',
      ).run(req.user.id, req.params.id, nowIso());
      res.status(201).json({ success: true, data: { favorite: true } });
    }),
  );

  router.delete(
    '/:id/favorite',
    requireAuth,
    asyncHandler((req, res) => {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND station_id = ?').run(
        req.user.id,
        req.params.id,
      );
      res.json({ success: true, data: { favorite: false } });
    }),
  );

  return router;
}

module.exports = { createStationsRouter };
