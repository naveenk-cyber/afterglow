'use strict';

const crypto = require('node:crypto');
const config = require('./config');
const { ApiError } = require('./errors');

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

/**
 * Hash a password with scrypt (built into Node — no native dependency).
 * Format: scrypt$N$r$p$saltBase64$hashBase64
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(
    Buffer.from(password, 'utf8'),
    salt,
    SCRYPT_PARAMS.keylen,
    { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: SCRYPT_PARAMS.maxmem },
  );
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/** Constant-time password verification. Returns false for malformed hashes. */
function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(
      Buffer.from(password, 'utf8'),
      salt,
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT_PARAMS.maxmem },
    );
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Stored in `password_hash` for accounts created through Google.
 *
 * It is intentionally not a scrypt hash, so `verifyPassword` rejects every
 * password for those accounts rather than accepting one — a Google-only
 * account cannot be entered with the password form, and signing in with Google
 * again is the only way back in.
 */
const OAUTH_ONLY_PASSWORD_HASH = 'oauth$google';

const b64url = (input) => Buffer.from(input).toString('base64url');
const fromB64url = (input) => Buffer.from(input, 'base64url');

function sign(data) {
  return crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
}

/**
 * Issue a signed session token. `sid` references a row in `auth_sessions`
 * so tokens can be revoked server-side (real logout).
 */
function createToken({ userId, sessionId, ttlSeconds }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ sub: userId, sid: sessionId, iat: now, exp: now + ttlSeconds }),
  );
  const signature = sign(`${header}.${payload}`);
  return { token: `${header}.${payload}.${signature}`, issuedAt: now, expiresAt: now + ttlSeconds };
}

/** Verify signature + expiry. Throws ApiError(401) when invalid. */
function verifyToken(token) {
  if (typeof token !== 'string') throw ApiError.unauthorized('Invalid session token.');
  const parts = token.split('.');
  if (parts.length !== 3) throw ApiError.unauthorized('Invalid session token.');
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw ApiError.unauthorized('Invalid session token.');
  }
  let claims;
  try {
    claims = JSON.parse(fromB64url(payload).toString('utf8'));
  } catch {
    throw ApiError.unauthorized('Invalid session token.');
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) {
    throw ApiError.unauthorized('Session expired. Please sign in again.');
  }
  return claims;
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value;
}

/** Read one cookie without adding a cookie-parser dependency. */
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Session transport: browser clients use the HttpOnly cookie, API clients and
 * the existing test suite can keep sending a bearer token.
 */
function extractSessionToken(req) {
  return extractBearer(req) || readCookie(req, 'chargeease_session');
}

/**
 * Express middleware factory. `loadUser` resolves a user row from an id.
 * Attaches `req.user` (public shape) and `req.sessionId`.
 */
function requireAuth(db) {
  return async (req, res, next) => {
    try {
      const token = extractSessionToken(req);
      if (!token) return next(ApiError.unauthorized());
      let claims;
      try {
        claims = verifyToken(token);
      } catch (error) {
        return next(error);
      }
      const session = await db
        .prepare('SELECT id, user_id, expires_at, revoked FROM auth_sessions WHERE id = ?')
        .get(claims.sid);
      if (
        !session ||
        session.revoked ||
        new Date(session.expires_at).getTime() < Date.now() ||
        session.user_id !== claims.sub
      ) {
        return next(ApiError.unauthorized('Session is no longer valid.'));
      }
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(claims.sub);
      if (!user) return next(ApiError.unauthorized());
      req.user = user;
      req.sessionId = claims.sid;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** Generate a random, URL-safe token and its hash (for password resets). */
function createOpaqueToken(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, hash: sha256(token) };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  OAUTH_ONLY_PASSWORD_HASH,
  createToken,
  verifyToken,
  requireAuth,
  extractBearer,
  extractSessionToken,
  readCookie,
  createOpaqueToken,
  sha256,
};
