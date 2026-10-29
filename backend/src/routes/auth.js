'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { ApiError, asyncHandler } = require('../errors');
const { requireAuth, hashPassword, verifyPassword, createToken, createOpaqueToken, sha256 } = require('../security');
const { fetchGoogleIdentity } = require('../supabase');
const v = require('../validate');
const {
  nowIso,
  newId,
  findUserByEmail,
  findUserById,
  findUserByGoogleSub,
  attachGoogleIdentity,
  createOAuthUser,
  publicUser,
  ensureWallet,
} = require('../repo');

const PASSWORD_MIN = 8;
const RESET_TTL_MINUTES = 30;

function assertPasswordStrength(password) {
  const problems = [];
  if (password.length < PASSWORD_MIN) problems.push(`at least ${PASSWORD_MIN} characters`);
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[0-9]/.test(password)) problems.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('a special character');
  if (problems.length) {
    throw ApiError.badRequest(`Password must contain ${problems.join(', ')}.`);
  }
}

const SESSION_COOKIE = 'chargeease_session';

/**
 * Browser sessions use an HttpOnly, SameSite=Lax cookie so JavaScript (and
 * therefore an XSS payload) cannot read the token. `rememberMe` controls
 * whether the cookie survives a browser restart; server-side expiry is the
 * same either way.
 */
function setSessionCookie(res, token, { remember = false } = {}) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    ...(remember ? { maxAge: config.sessionTtlHours * 3600 * 1000 } : {}),
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  });
}

async function createSession(db, userId) {
  const sessionId = newId();
  const ttlSeconds = config.sessionTtlHours * 3600;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db
    .prepare(
      'INSERT INTO auth_sessions (id, user_id, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, ?)',
    )
    .run(sessionId, userId, expiresAt, nowIso());
  const { token } = createToken({ userId, sessionId, ttlSeconds });
  return { token, expiresAt };
}

/** Tight limits on credential endpoints to slow brute-force attempts. */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
    });
  },
});

function createAuthRouter(db) {
  const router = express.Router();
  const auth = requireAuth(db);

  router.post(
    '/signup',
    credentialLimiter,
    asyncHandler(async (req, res) => {
      const body = v.requireObjectBody(req.body);
      const firstName = v.str(body.firstName, 'First name', { min: 1, max: 60 });
      const lastName = v.str(body.lastName, 'Last name', { min: 1, max: 60 });
      const email = v.email(body.email);
      const phone = v.str(body.phone, 'Phone', { required: false, max: 32 });
      const password = v.str(body.password, 'Password', { min: PASSWORD_MIN, max: 200 });
      assertPasswordStrength(password);

      if (body.confirmPassword !== undefined && body.confirmPassword !== password) {
        throw ApiError.badRequest('Passwords do not match.');
      }
      if (await findUserByEmail(db, email)) {
        throw ApiError.conflict('An account with this email already exists.');
      }

      const preferences = JSON.stringify({
        units: 'imperial',
        language: 'en',
        notifications: { email: true, push: Boolean(body.newsletter), sms: false },
      });

      const id = newId();
      const timestamp = nowIso();
      await db
        .prepare(
          `INSERT INTO users (id, email, password_hash, name, phone, membership_level, preferences_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'Free', ?, ?, ?)`,
        )
        .run(
          id,
          email,
          hashPassword(password),
          v.sanitizeText(`${firstName} ${lastName}`),
          phone ? v.sanitizeText(phone) : null,
          preferences,
          timestamp,
          timestamp,
        );

      await ensureWallet(db, id);
      const session = await createSession(db, id);
      setSessionCookie(res, session.token, { remember: body.rememberMe !== false });
      res.status(201).json({
        success: true,
        data: {
          user: await publicUser(db, await findUserById(db, id)),
          token: session.token,
          expiresAt: session.expiresAt,
        },
      });
    }),
  );

  router.post(
    '/login',
    credentialLimiter,
    asyncHandler(async (req, res) => {
      const body = v.requireObjectBody(req.body);
      const email = v.email(body.email);
      const password = v.str(body.password, 'Password', { min: 1, max: 200 });
      const user = await findUserByEmail(db, email);

      // Same error for unknown email and wrong password (no account enumeration).
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw ApiError.unauthorized('Invalid email or password.');
      }
      const session = await createSession(db, user.id);
      setSessionCookie(res, session.token, { remember: body.rememberMe !== false });
      res.json({
        success: true,
        data: {
          user: await publicUser(db, user),
          token: session.token,
          expiresAt: session.expiresAt,
        },
      });
    }),
  );

  /**
   * Google sign-in, brokered by Supabase.
   *
   * The browser finishes the OAuth dance with Supabase and posts the resulting
   * access token here. Supabase itself verifies that token (see ../supabase),
   * the matching Afterglow account is found or created, and the usual HttpOnly
   * session cookie is issued — so protected routes, the dashboard and every
   * other API contract behave exactly as they do for password sign-in, and no
   * Google secret is ever needed in the browser or in this service.
   */
  router.post(
    '/oauth/supabase',
    credentialLimiter,
    asyncHandler(async (req, res) => {
      const body = v.requireObjectBody(req.body);
      const accessToken = v.str(body.accessToken, 'Google access token', { min: 20, max: 4096 });

      const identity = await fetchGoogleIdentity(accessToken);

      // Prefer the stored Google subject: it survives an email change on
      // either side. Fall back to the email so an existing Afterglow account
      // is linked instead of a duplicate being created.
      let user = await findUserByGoogleSub(db, identity.sub);
      if (!user) {
        const existing = await findUserByEmail(db, identity.email);
        if (existing) {
          if (existing.google_sub && existing.google_sub !== identity.sub) {
            throw ApiError.conflict(
              'This Afterglow account is already linked to a different Google account.',
            );
          }
          user = await attachGoogleIdentity(db, existing.id, {
            sub: identity.sub,
            avatar: identity.avatar,
          });
        } else {
          user = await createOAuthUser(db, {
            email: identity.email,
            name: identity.name || identity.email.split('@')[0],
            avatar: identity.avatar,
            googleSub: identity.sub,
          });
        }
      }

      const session = await createSession(db, user.id);
      setSessionCookie(res, session.token, { remember: true });
      res.json({
        success: true,
        data: {
          user: await publicUser(db, user),
          token: session.token,
          expiresAt: session.expiresAt,
        },
      });
    }),
  );

  router.post(
    '/logout',
    auth,
    asyncHandler(async (req, res) => {
      await db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE id = ?').run(req.sessionId);
      clearSessionCookie(res);
      res.json({ success: true, data: { message: 'Signed out.' } });
    }),
  );

  router.get(
    '/me',
    auth,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: { user: await publicUser(db, req.user) } });
    }),
  );

  /**
   * Password reset. Sending email needs an SMTP provider which is not
   * configured here, so outside production we return the token directly and
   * document that no email was sent.
   */
  router.post(
    '/forgot-password',
    credentialLimiter,
    asyncHandler(async (req, res) => {
      const body = v.requireObjectBody(req.body);
      const email = v.email(body.email);
      const user = await findUserByEmail(db, email);
      const response = {
        message:
          'If an account exists for that email, a password reset link has been generated.',
      };

      if (user) {
        const { token, hash } = createOpaqueToken();
        await db
          .prepare(
            'INSERT INTO password_resets (token_hash, user_id, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)',
          )
          .run(
          hash,
          user.id,
          new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString(),
          nowIso(),
        );
        if (!config.isProduction) {
          // Development-only convenience. A real deployment must email this link.
          response.devResetToken = token;
          response.devResetUrl = `${config.publicAppUrl}/reset-password?token=${token}`;
          response.emailSent = false;
        }
      }

      res.json({ success: true, data: response });
    }),
  );

  router.post(
    '/reset-password',
    credentialLimiter,
    asyncHandler(async (req, res) => {
      const body = v.requireObjectBody(req.body);
      const token = v.str(body.token, 'Reset token', { min: 10, max: 500 });
      const password = v.str(body.password, 'Password', { min: PASSWORD_MIN, max: 200 });
      assertPasswordStrength(password);

      const record = await db
        .prepare('SELECT * FROM password_resets WHERE token_hash = ?')
        .get(sha256(token));
      if (!record || record.used || new Date(record.expires_at).getTime() < Date.now()) {
        throw ApiError.badRequest('This reset link is invalid or has expired.');
      }

      await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        hashPassword(password),
        nowIso(),
        record.user_id,
      );
      await db
        .prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?')
        .run(record.token_hash);
      // Invalidate every existing session after a credential change.
      await db
        .prepare('UPDATE auth_sessions SET revoked = 1 WHERE user_id = ?')
        .run(record.user_id);

      res.json({ success: true, data: { message: 'Password updated. Please sign in again.' } });
    }),
  );

  return router;
}

module.exports = { createAuthRouter, SESSION_COOKIE };
