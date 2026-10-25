'use strict';

/**
 * Legacy entry point.
 *
 * The API now lives under `src/` (see src/index.js). This file is kept so the
 * documented `node server.js` command still works.
 */
const { start } = require('./src/index');

start().catch((error) => {
  console.error('[startup]', error);
  process.exitCode = 1;
});
