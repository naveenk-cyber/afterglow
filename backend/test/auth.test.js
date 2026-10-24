'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signup } = require('./helpers');
const { hashPassword, verifyPassword } = require('../src/security');

test('password hashing is salted and verifiable', () => {
  const hash = hashPassword('Passw0rd!');
  assert.match(hash, /^scrypt\$/);
  assert.ok(verifyPassword('Passw0rd!', hash));
  assert.ok(!verifyPassword('wrong', hash));
  assert.notEqual(hash, hashPassword('Passw0rd!'), 'each hash must use a unique salt');
});

test('signup creates a user, wallet, and session', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const res = await client.post('/auth/signup', {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    password: 'Passw0rd!',
    confirmPassword: 'Passw0rd!',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.token);
  assert.equal(res.body.data.user.email, 'ada@example.test');
  assert.equal(res.body.data.user.membershipLevel, 'Free');
  // Never leak the hash.
  assert.equal(res.body.data.user.password_hash, undefined);

  const walletCount = client.db.prepare('SELECT COUNT(*) AS c FROM wallets').get().c;
  assert.equal(walletCount, 1);
});

test('signup rejects duplicate email and weak passwords', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const { payload } = await signup(client);
  const duplicate = await client.post('/auth/signup', payload);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'CONFLICT');

  const weak = await client.post('/auth/signup', {
    firstName: 'Weak',
    lastName: 'Password',
    email: 'weak@example.test',
    password: 'password',
  });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.error.code, 'VALIDATION_ERROR');
});

test('login succeeds with correct credentials and fails otherwise', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const { payload } = await signup(client);

  const ok = await client.post('/auth/login', {
    email: payload.email,
    password: payload.password,
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.token);

  const badPassword = await client.post('/auth/login', {
    email: payload.email,
    password: 'Nope1234!',
  });
  assert.equal(badPassword.status, 401);

  const unknown = await client.post('/auth/login', {
    email: 'nobody@example.test',
    password: 'Nope1234!',
  });
  assert.equal(unknown.status, 401);
  // Identical message prevents account enumeration.
  assert.equal(unknown.body.error.message, badPassword.body.error.message);
});

test('protected routes require a valid token and logout revokes sessions', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const anonymous = await client.get('/auth/me');
  assert.equal(anonymous.status, 401);

  const { token } = await signup(client);
  const me = await client.get('/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email.endsWith('@example.test'), true);

  const forged = await client.get('/auth/me', { token: 'not.a.token' });
  assert.equal(forged.status, 401);

  const logout = await client.post('/auth/logout', undefined, { token });
  assert.equal(logout.status, 200);

  const afterLogout = await client.get('/auth/me', { token });
  assert.equal(afterLogout.status, 401, 'revoked session must be rejected');
});

test('browser cookie sessions authenticate, survive requests, and are cleared by logout', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const signupRes = await fetch(`${client.baseUrl}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Cookie',
      lastName: 'Driver',
      email: 'cookie@example.test',
      password: 'Passw0rd!',
      confirmPassword: 'Passw0rd!',
    }),
  });
  assert.equal(signupRes.status, 201);

  const cookieHeader = signupRes.headers.get('set-cookie') || '';
  assert.match(cookieHeader, /chargeease_session=/);
  assert.match(cookieHeader, /HttpOnly/i, 'the browser token must not be readable by JavaScript');
  assert.match(cookieHeader, /SameSite=Lax/i);
  const cookie = cookieHeader.split(';')[0];

  // No Authorization header: the cookie alone must authenticate the request.
  const me = await fetch(`${client.baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.data.user.email, 'cookie@example.test');

  const logout = await fetch(`${client.baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 200);
  const cleared = logout.headers.get('set-cookie') || '';
  assert.match(cleared, /chargeease_session=;/, 'logout must expire the cookie');

  const afterLogout = await fetch(`${client.baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(afterLogout.status, 401, 'the revoked cookie must not authenticate again');
});

test('password reset token works once and revokes existing sessions', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const { token, payload } = await signup(client);

  const forgot = await client.post('/auth/forgot-password', { email: payload.email });
  assert.equal(forgot.status, 200);
  const resetToken = forgot.body.data.devResetToken;
  assert.ok(resetToken, 'development reset token should be returned when email is unavailable');

  const reset = await client.post('/auth/reset-password', {
    token: resetToken,
    password: 'BrandNew1!',
  });
  assert.equal(reset.status, 200);

  // Old session is invalidated after a credential change.
  const staleSession = await client.get('/auth/me', { token });
  assert.equal(staleSession.status, 401);

  // Token cannot be reused.
  const reuse = await client.post('/auth/reset-password', {
    token: resetToken,
    password: 'Another1!',
  });
  assert.equal(reuse.status, 400);

  const login = await client.post('/auth/login', { email: payload.email, password: 'BrandNew1!' });
  assert.equal(login.status, 200);
});

test('forgot-password does not reveal whether an account exists', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const known = await client.post('/auth/forgot-password', { email: 'demo@afterglow.test' });
  const unknown = await client.post('/auth/forgot-password', { email: 'ghost@example.test' });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(known.body.data.message, unknown.body.data.message);
});
