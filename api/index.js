'use strict';

/**
 * Vercel serverless entry point for the Afterglow API.
 *
 * Vercel only routes one path segment past `/api` to a filesystem function in
 * this project, so `vercel.json` rewrites every `/api/<rest>` request to
 * `/api?__path=<rest>`. This handler restores the original URL (path and query)
 * before handing the request to Express, which then routes it normally.
 *
 * The Express app is created once per warm function instance and reused. The
 * database is Turso/libSQL in production (TURSO_DATABASE_URL) and the local
 * SQLite file is used for development.
 */
const { getDatabase } = require('../backend/src/db');
const { createApp } = require('../backend/src/app');
const { seedIfEmpty, seedDemoUser } = require('../backend/src/seed');

let appPromise = null;

async function bootstrap() {
  const db = await getDatabase();

  if (process.env.SEED_ON_START !== 'false') {
    await seedIfEmpty(db);
    if (process.env.SEED_DEMO_USER === 'true') await seedDemoUser(db);
  }

  return createApp(db);
}

/** Undo the `/api?__path=` rewrite so Express sees the real path and query. */
function restoreUrl(req) {
  const raw = req.url || '/';
  const queryIndex = raw.indexOf('?');
  if (queryIndex === -1) return;

  const params = new URLSearchParams(raw.slice(queryIndex + 1));
  const rest = params.get('__path');
  if (rest === null) return;
  params.delete('__path');

  const search = params.toString();
  req.url = `/api/${rest.replace(/^\/+/, '')}${search ? `?${search}` : ''}`;
}

module.exports = async function handler(req, res) {
  try {
    restoreUrl(req);
    if (!appPromise) {
      appPromise = bootstrap().catch((error) => {
        // Do not cache a failed bootstrap; the next request retries.
        appPromise = null;
        throw error;
      });
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('[api-bootstrap]', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The API could not start. Check the server logs.',
        },
      });
    }
    return undefined;
  }
};
