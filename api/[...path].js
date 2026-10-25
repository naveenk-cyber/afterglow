'use strict';

/**
 * Vercel serverless entry point for the Afterglow API.
 *
 * The Express app is created once per warm function instance and reused.
 * The database is Turso/libSQL in production (TURSO_DATABASE_URL) and the
 * local SQLite file is used for development.
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

module.exports = async function handler(req, res) {
  try {
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
