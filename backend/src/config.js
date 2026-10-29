'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

/**
 * In production a real secret is mandatory. In development we generate a
 * throwaway one so the app still runs, but every restart invalidates tokens.
 */
function resolveSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (isProduction) {
    throw new Error(
      'JWT_SECRET must be set to a random value of at least 16 characters in production.',
    );
  }
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Supabase is used as the OAuth broker for Google sign-in (see routes/auth).
 * Both values are public client credentials — the project URL and the anon
 * (publishable) key — and the service-role key must never be configured here,
 * because every request the API makes with it would bypass row level security.
 */
const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: resolveSecret(),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
  databaseFile: process.env.DATABASE_FILE || './data/chargeease.db',
  publicAppUrl: process.env.PUBLIC_APP_URL || 'http://localhost:5173',
  currency: process.env.CURRENCY || 'USD',
  distanceUnit: process.env.DISTANCE_UNIT || 'miles',
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    // Google sign-in is only offered when the deployment is wired up for it.
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    // True when at least one of the two values is present. Used only to tell
    // "never set up" apart from "set up incompletely": without it, a
    // deployment holding the URL but not the key would be reported as "not
    // configured", naming neither the missing value nor the right fix.
    present: Boolean(supabaseUrl || supabaseAnonKey),
  },
};

module.exports = config;
