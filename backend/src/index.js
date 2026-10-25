'use strict';

const config = require('./config');
const { getDatabase } = require('./db');
const { createApp } = require('./app');
const { seedIfEmpty, seedDemoUser } = require('./seed');

async function start() {
  const db = await getDatabase();

  // Convenience for local development: fill an empty database with sample data.
  // Set SEED_ON_START=false to disable.
  if (process.env.SEED_ON_START !== 'false') {
    await seedIfEmpty(db);
    // The demo account stays a development convenience by default. A deployed
    // demo that advertises it opts in explicitly with SEED_DEMO_USER=true.
    const seedDemo = process.env.SEED_DEMO_USER
      ? process.env.SEED_DEMO_USER === 'true'
      : !config.isProduction;
    if (seedDemo) await seedDemoUser(db);
  }

  const app = createApp(db);
  const server = app.listen(config.port, () => {
    console.log(`Afterglow API listening on http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`Environment: ${config.nodeEnv}`);
    if (!config.isProduction) {
      console.log('Sample station data is seeded automatically when the database is empty.');
    }
  });
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('[startup]', error);
    process.exitCode = 1;
  });
}

module.exports = { start };
