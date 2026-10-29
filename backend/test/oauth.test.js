'use strict';

/**
 * Google sign-in (Supabase as the OAuth broker).
 *
 * Supabase's `/auth/v1/user` endpoint is stubbed at the `fetch` level: the
 * suite never talks to a real project, and everything downstream — account
 * creation, linking, the session cookie, the API contracts — runs for real
 * against an in-memory database.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signup } = require('./helpers');
const config = require('../src/config');
const { verifyPassword, OAUTH_ONLY_PASSWORD_HASH } = require('../src/security');

const originalFetch = globalThis.fetch;
const SUPABASE_ORIGIN = 'https://afterglow-test.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_test-key-not-a-secret';

/** A JWT with an arbitrary payload; only the `role` claim is ever read. */
const fakeJwt = (payload) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

const googleProfile = (overrides = {}) => ({
  id: '8f14e45f-ea0a-4a4a-9d2f-2b1c6a7e1f22',
  email: 'driver@example.test',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: { full_name: 'Ada Lovelace', avatar_url: 'https://example.test/avatar.png' },
  ...overrides,
});

/**
 * Point the API at a fake Supabase and return the requests it makes.
 * Every non-Supabase request (the test client's own HTTP calls) is untouched.
 */
function installSupabaseStub(t, { profile, status = 200, failure } = {}) {
  config.supabase.url = SUPABASE_ORIGIN;
  config.supabase.anonKey = PUBLISHABLE_KEY;
  config.supabase.configured = true;
  config.supabase.present = true;

  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith(SUPABASE_ORIGIN)) return originalFetch(input, init);
    calls.push({ url, headers: init?.headers });
    if (failure) throw failure;
    return new Response(JSON.stringify(profile ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    config.supabase.url = '';
    config.supabase.anonKey = '';
    config.supabase.configured = false;
    config.supabase.present = false;
  });
  return calls;
}

function unconfigure() {
  config.supabase.url = '';
  config.supabase.anonKey = '';
  config.supabase.configured = false;
  config.supabase.present = false;
}

test('a secret key configured as the anon key is refused before any request', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  const calls = installSupabaseStub(t, { profile: googleProfile() });
  const secret = 'sb_secret_this-must-never-be-used';
  config.supabase.anonKey = secret;

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'l'.repeat(40) });

  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'OAUTH_MISCONFIGURED');
  assert.match(res.body.error.message, /secret key/i);
  // Supabase is never called, so a privileged key cannot leak through an
  // outbound request or an error message.
  assert.equal(calls.length, 0);
  assert.equal(res.body.error.message.includes(secret), false);
});

test('a legacy service_role JWT is refused too', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  installSupabaseStub(t, { profile: googleProfile() });
  config.supabase.anonKey = fakeJwt({ role: 'service_role' });

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'm'.repeat(40) });

  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'OAUTH_MISCONFIGURED');
  assert.match(res.body.error.message, /service_role/);
});

test('a legacy anon JWT is still accepted, and a URL without a scheme is not', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  installSupabaseStub(t, { profile: googleProfile({ email: 'legacy@example.test' }) });
  config.supabase.anonKey = fakeJwt({ role: 'anon' });

  const ok = await client.post('/auth/oauth/supabase', { accessToken: 'n'.repeat(40) });
  assert.equal(ok.status, 200);

  config.supabase.url = 'afterglow-test.supabase.co';
  const badUrl = await client.post('/auth/oauth/supabase', { accessToken: 'o'.repeat(40) });
  assert.equal(badUrl.status, 503);
  assert.equal(badUrl.body.error.code, 'OAUTH_MISCONFIGURED');
  assert.match(badUrl.body.error.message, /https:\/\//);
});

test('the endpoint refuses to run without Supabase configuration', async (t) => {
  unconfigure();
  const client = await startTestServer();
  t.after(() => client.close());

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'a'.repeat(40) });

  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'OAUTH_NOT_CONFIGURED');
});

/**
 * A deployment holding only half of the pair is *misconfigured*, not
 * unconfigured. Reporting the generic "not configured on this deployment" there
 * would name neither the missing variable nor the fix, so the reason has to
 * point at the value that is actually absent.
 */
test('a half-configured pair names the variable that is missing', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  const calls = installSupabaseStub(t, { profile: googleProfile() });

  // URL present, key missing: the exact state of a deployment that has copied
  // SUPABASE_URL but not SUPABASE_ANON_KEY.
  config.supabase.anonKey = '';
  config.supabase.configured = false;
  const missingKey = await client.post('/auth/oauth/supabase', { accessToken: 'q'.repeat(40) });
  assert.equal(missingKey.status, 503);
  assert.equal(missingKey.body.error.code, 'OAUTH_MISCONFIGURED');
  assert.match(missingKey.body.error.message, /SUPABASE_ANON_KEY is not set/);

  // Key present, URL missing: names the URL instead.
  config.supabase.url = '';
  config.supabase.anonKey = PUBLISHABLE_KEY;
  const missingUrl = await client.post('/auth/oauth/supabase', { accessToken: 'r'.repeat(40) });
  assert.equal(missingUrl.status, 503);
  assert.equal(missingUrl.body.error.code, 'OAUTH_MISCONFIGURED');
  assert.match(missingUrl.body.error.message, /SUPABASE_URL is not set/);

  // Neither state is "not configured", and neither reaches Supabase.
  assert.equal(calls.length, 0);
});

test('nothing configured is still reported as not configured, not as misconfigured', async (t) => {
  unconfigure();
  const client = await startTestServer();
  t.after(() => client.close());

  const res = await client.post('/auth/oauth/supabase', { accessToken: 's'.repeat(40) });

  assert.equal(res.status, 503);
  assert.equal(res.body.error.code, 'OAUTH_NOT_CONFIGURED');
  assert.match(res.body.error.message, /not configured on this deployment/);
  // The generic message must not leak the variable names when none exist.
  assert.equal(res.body.error.message.includes('SUPABASE_ANON_KEY'), false);
});

test('an unverified token is rejected and creates nothing', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  installSupabaseStub(t, { status: 401, profile: { message: 'invalid claim' } });

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'b'.repeat(40) });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
  assert.equal((await client.db.prepare('SELECT COUNT(*) AS c FROM users').get()).c, 0);
});

test('a Google identity creates the account, wallet and a working session', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  const calls = installSupabaseStub(t, { profile: googleProfile() });

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'c'.repeat(40) });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, 'driver@example.test');
  assert.equal(res.body.data.user.name, 'Ada Lovelace');
  assert.equal(res.body.data.user.avatar, 'https://example.test/avatar.png');
  assert.equal(res.body.data.user.membershipLevel, 'Free');
  // The Google subject and the password column stay server-side.
  assert.equal(res.body.data.user.google_sub, undefined);
  assert.equal(res.body.data.user.password_hash, undefined);

  // The token is verified against Supabase with the anon key, never decoded
  // locally, and the access token is the caller's.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${SUPABASE_ORIGIN}/auth/v1/user`);
  assert.equal(calls[0].headers.apikey, PUBLISHABLE_KEY);
  assert.equal(calls[0].headers.Authorization, `Bearer ${'c'.repeat(40)}`);

  const row = await client.db.prepare('SELECT * FROM users WHERE email = ?').get('driver@example.test');
  assert.ok(row.google_sub);
  assert.equal(verifyPassword('anything', row.password_hash), false);
  assert.equal(row.password_hash, OAUTH_ONLY_PASSWORD_HASH);
  assert.equal((await client.db.prepare('SELECT COUNT(*) AS c FROM wallets').get()).c, 1);

  // The issued session is a normal Afterglow session: protected routes accept it.
  const me = await client.get('/auth/me', { token: res.body.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, 'driver@example.test');
});

test('signing in twice with Google reuses the same account', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  installSupabaseStub(t, { profile: googleProfile() });

  const first = await client.post('/auth/oauth/supabase', { accessToken: 'd'.repeat(40) });
  const second = await client.post('/auth/oauth/supabase', { accessToken: 'e'.repeat(40) });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.data.user.id, first.body.data.user.id);
  assert.equal((await client.db.prepare('SELECT COUNT(*) AS c FROM users').get()).c, 1);
  assert.notEqual(second.body.data.token, first.body.data.token, 'each sign-in gets its own session');
});

test('an existing password account is linked instead of duplicated', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  const { user } = await signup(client, { email: 'linked@example.test' });
  installSupabaseStub(t, { profile: googleProfile({ email: 'linked@example.test' }) });

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'f'.repeat(40) });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.id, user.id);
  assert.equal((await client.db.prepare('SELECT COUNT(*) AS c FROM users').get()).c, 1);
  // The password still works, so linking adds a way in rather than replacing one.
  const login = await client.post('/auth/login', {
    email: 'linked@example.test',
    password: 'Passw0rd!',
  });
  assert.equal(login.status, 200);
});

test('a Google-only account cannot be entered with the password form', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  installSupabaseStub(t, { profile: googleProfile({ email: 'googleonly@example.test' }) });

  const created = await client.post('/auth/oauth/supabase', { accessToken: 'g'.repeat(40) });
  assert.equal(created.status, 200);

  // Every guess — including the sentinel that sits in the column — is refused.
  for (const password of ['anything', OAUTH_ONLY_PASSWORD_HASH, 'oauth$google']) {
    const res = await client.post('/auth/login', { email: 'googleonly@example.test', password });
    assert.equal(res.status, 401, `password ${JSON.stringify(password)} must not sign in`);
  }
  // An empty password never reaches the comparison at all.
  const blank = await client.post('/auth/login', { email: 'googleonly@example.test', password: '' });
  assert.equal(blank.status, 400);
});

test('a Supabase identity from another provider is refused', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  installSupabaseStub(t, {
    profile: googleProfile({ app_metadata: { provider: 'email', providers: ['email'] } }),
  });

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'h'.repeat(40) });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.equal((await client.db.prepare('SELECT COUNT(*) AS c FROM users').get()).c, 0);
});

test('a profile without an email is refused', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  installSupabaseStub(t, { profile: googleProfile({ email: undefined }) });

  const res = await client.post('/auth/oauth/supabase', { accessToken: 'i'.repeat(40) });

  assert.equal(res.status, 401);
  assert.equal((await client.db.prepare('SELECT COUNT(*) AS c FROM users').get()).c, 0);
});

test('the identity comes from the verified token, never from the request body', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  const { user: victim } = await signup(client, { email: 'victim@example.test' });
  installSupabaseStub(t, { profile: googleProfile({ email: 'google-driver@example.test' }) });

  const res = await client.post('/auth/oauth/supabase', {
    accessToken: 'p'.repeat(40),
    // Every one of these is ignored: only the token decides who signs in.
    email: 'victim@example.test',
    userId: victim.id,
    id: victim.id,
    sub: 'made-up-subject',
    name: 'Someone Else',
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'google-driver@example.test');
  assert.notEqual(res.body.data.user.id, victim.id);
  assert.equal((await client.db.prepare('SELECT COUNT(*) AS c FROM users').get()).c, 2);
  // The victim's account was not linked to the attacker's Google subject.
  const victimRow = await client.db
    .prepare('SELECT google_sub FROM users WHERE id = ?')
    .get(victim.id);
  assert.equal(victimRow.google_sub, null);
});

test('an unreachable Supabase is reported as unavailable, not as a bad token', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  installSupabaseStub(t, { failure: new Error('socket hang up') });
  const offline = await client.post('/auth/oauth/supabase', { accessToken: 'j'.repeat(40) });
  assert.equal(offline.status, 503);
  assert.equal(offline.body.error.code, 'OAUTH_UNAVAILABLE');

  globalThis.fetch = originalFetch;
  installSupabaseStub(t, {
    failure: Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
  });
  const slow = await client.post('/auth/oauth/supabase', { accessToken: 'k'.repeat(40) });
  assert.equal(slow.status, 504);
  assert.equal(slow.body.error.code, 'OAUTH_UNAVAILABLE');
});

test('a missing or malformed access token is rejected before Supabase is called', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());
  const calls = installSupabaseStub(t, { profile: googleProfile() });

  for (const body of [{}, { accessToken: 'short' }, { accessToken: 42 }]) {
    const res = await client.post('/auth/oauth/supabase', body);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(calls.length, 0);
});
