'use strict';

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { ApiError } = require('./errors');
const { requireAuth } = require('./security');
const { createAuthRouter } = require('./routes/auth');
const { createStationsRouter } = require('./routes/stations');
const { createBookingsRouter } = require('./routes/bookings');
const { createUsersRouter } = require('./routes/users');

/** Basic security headers without pulling in another dependency. */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function createApp(db) {
  const app = express();

  app.disable('x-powered-by');
  // Trust the first proxy hop so rate limiting sees real client IPs behind a proxy.
  app.set('trust proxy', 1);

  app.use(securityHeaders);

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin, curl, and server-to-server requests have no Origin header.
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      // Required for the HttpOnly session cookie when the frontend is served
      // from a different origin than the API (e.g. VITE_API_URL is absolute).
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Vercel's Node runtime may parse the JSON body before the function runs.
  // Only parse when the body has not already been populated, otherwise the
  // request stream is empty and Express would reject valid payloads.
  const jsonParser = express.json({ limit: '100kb' });
  const urlencodedParser = express.urlencoded({ extended: false, limit: '100kb' });
  app.use((req, res, next) => {
    if (req.body !== undefined) return next();
    return jsonParser(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.body !== undefined) return next();
    return urlencodedParser(req, res, next);
  });

  // Broad limiter for the whole API surface.
  app.use(
    rateLimit({
      windowMs: 5 * 60 * 1000,
      limit: 600,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
        }),
    }),
  );

  const health = (req, res) =>
    res.json({
      success: true,
      data: { status: 'ok', service: 'chargeease-api', version: '1.0.0', time: new Date().toISOString() },
    });

  app.get('/', health);
  app.get(config.apiPrefix, health);

  const api = express.Router();
  api.use('/auth', createAuthRouter(db));
  api.use('/stations', createStationsRouter(db, { requireAuth: requireAuth(db) }));
  api.use('/bookings', createBookingsRouter(db, { requireAuth: requireAuth(db) }));
  api.use('/users', createUsersRouter(db, { requireAuth: requireAuth(db) }));

  app.use(config.apiPrefix, api);

  // Unknown route
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
    });
  });

  // Central error handler — never leaks stack traces in production.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err instanceof ApiError ? err.status : err.status || 500;
    if (status >= 500) console.error('[api-error]', err);
    res.status(status).json({
      success: false,
      error: {
        code: err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
        message:
          status === 500 && config.isProduction
            ? 'Something went wrong on the server.'
            : err.message || 'Unexpected error',
        details: err.details,
      },
    });
  });

  return app;
}

module.exports = { createApp };
