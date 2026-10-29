'use strict';

const config = require('./config');
const { ApiError } = require('./errors');

const IDENTITY_TIMEOUT_MS = 8000;

/** Supabase's browser-safe key prefix. */
const PUBLISHABLE_PREFIX = 'sb_publishable_';
/** The privileged prefix: it bypasses row level security. */
const SECRET_PREFIX = 'sb_secret_';
/** Roles that carry more authority than this service ever needs. */
const PRIVILEGED_ROLES = new Set(['service_role', 'supabase_admin', 'supabase_auth_admin']);

/** Read one JWT segment, only to inspect the `role` claim. */
function decodeJwtPayload(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try {
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return decoded && typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}

function describeUrlProblem(url) {
  const base = String(url || '').trim().replace(/\/+$/, '');
  if (!base) return 'SUPABASE_URL is not set';
  if (!/^https?:\/\//i.test(base)) return 'SUPABASE_URL must start with https://';
  if (!/^https:/i.test(base) && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(base)) {
    return 'SUPABASE_URL must use https (http is only allowed for localhost)';
  }
  return null;
}

function describeKeyProblem(key) {
  const value = String(key || '').trim();
  if (!value) return 'SUPABASE_ANON_KEY is not set';
  if (value.startsWith(SECRET_PREFIX)) {
    return 'SUPABASE_ANON_KEY holds a Supabase secret key, which bypasses row level security; use the publishable key instead';
  }
  if (value.startsWith(PUBLISHABLE_PREFIX)) return null;

  const payload = decodeJwtPayload(value);
  if (payload) {
    const role = typeof payload.role === 'string' ? payload.role : '';
    if (role === 'anon') return null; // legacy anon key
    if (PRIVILEGED_ROLES.has(role)) {
      return `SUPABASE_ANON_KEY holds a "${role}" key; use the publishable key instead`;
    }
    return role ? `SUPABASE_ANON_KEY has role "${role}"` : 'SUPABASE_ANON_KEY is a JWT without a role claim';
  }

  return 'SUPABASE_ANON_KEY is not a publishable key (expected sb_publishable_…) or a legacy anon key';
}

/**
 * Why the configured pair cannot be used, or `null` when it can.
 *
 * Only the publishable (or legacy anon) key is accepted: this service asks
 * Supabase to verify a caller's token, which needs no privileged access, and
 * refusing a secret or `service_role` key here keeps the API from masking a
 * dangerous frontend configuration. The frontend repeats this check for the
 * `VITE_` pair; see frontend/src/services/supabase.ts.
 *
 * This inspects the values themselves rather than the `configured` shortcut, so
 * the reason names the specific variable to fix. `configured` is simply
 * "both are present and neither is empty" and cannot say which one is missing.
 */
function describeConfigurationProblem({ url, anonKey } = config.supabase) {
  return describeUrlProblem(url) || describeKeyProblem(anonKey);
}

/**
 * Verify a Supabase access token and return the Google identity behind it.
 *
 * The token is checked by Supabase itself (`GET /auth/v1/user`), so the API
 * never needs the project's JWT secret, works with both HMAC and asymmetric
 * signing keys, and cannot be fooled by a locally decoded payload: a token
 * that Supabase rejects is rejected here too.
 *
 * Only Google identities are accepted. Afterglow's own accounts live in its
 * database, so this endpoint is proof of "the same person controls this Google
 * account" and nothing else — it must not become a way to claim an account by
 * presenting an email address (an unconfirmed Supabase email/password account,
 * for example, knows an address but has not proved it owns the mailbox).
 */
async function fetchGoogleIdentity(accessToken) {
  const misconfiguration = describeConfigurationProblem();
  if (misconfiguration) {
    // OAUTH_NOT_CONFIGURED means "never set up"; OAUTH_MISCONFIGURED means
    // "set up with the wrong value, or with only half of the pair", which is
    // worth separating in logs. Keying this on `configured` would be wrong:
    // it is false both when nothing is set and when exactly one of the two
    // values is, so a deployment missing only the key would answer "not
    // configured" — hiding the one variable that has to be added.
    const partlyConfigured = config.supabase.present;
    throw new ApiError(
      503,
      partlyConfigured ? 'OAUTH_MISCONFIGURED' : 'OAUTH_NOT_CONFIGURED',
      partlyConfigured
        ? `Google sign-in is misconfigured: ${misconfiguration}.`
        : 'Google sign-in is not configured on this deployment.',
    );
  }

  let response;
  try {
    response = await fetch(`${config.supabase.url}/auth/v1/user`, {
      headers: {
        apikey: config.supabase.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS),
    });
  } catch (error) {
    // Network failure or timeout: the identity was not verified, and saying so
    // is not the same as saying the token was bad.
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ApiError(504, 'OAUTH_UNAVAILABLE', 'Google sign-in timed out. Please try again.');
    }
    throw new ApiError(503, 'OAUTH_UNAVAILABLE', 'Google sign-in is unavailable right now.');
  }

  if (!response.ok) {
    throw ApiError.unauthorized('That Google sign-in could not be verified. Please try again.');
  }

  let profile;
  try {
    profile = await response.json();
  } catch {
    throw ApiError.unauthorized('That Google sign-in could not be verified. Please try again.');
  }

  const sub = typeof profile?.id === 'string' ? profile.id.trim() : '';
  const rawEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';
  const provider = profile?.app_metadata?.provider;

  if (!sub || !rawEmail) {
    throw ApiError.unauthorized('That Google sign-in could not be verified. Please try again.');
  }
  if (provider !== 'google') {
    throw ApiError.badRequest(
      'Only Google sign-in is accepted here. Use the Afterglow sign-in form for this account.',
    );
  }

  const metadata = profile.user_metadata || {};
  const name =
    [metadata.full_name, metadata.name].find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    ) ||
    [metadata.given_name, metadata.family_name]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join(' ') ||
    '';

  return {
    sub,
    email: rawEmail.toLowerCase(),
    name: typeof name === 'string' ? name.trim().slice(0, 120) : '',
    avatar: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
  };
}

module.exports = { fetchGoogleIdentity, describeConfigurationProblem, describeKeyProblem };
