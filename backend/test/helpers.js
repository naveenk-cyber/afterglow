'use strict';

const { createMemoryDatabase } = require('../src/db');
const { createApp } = require('../src/app');
const { seedStations } = require('../src/seed');

/**
 * Start a fresh API on an ephemeral port backed by an in-memory database.
 * Returns a small client so tests read like real HTTP usage.
 */
async function startTestServer({ seed = true } = {}) {
  const db = await createMemoryDatabase();
  if (seed) await seedStations(db);

  const app = createApp(db);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(method, path, { body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    const text = await response.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }
    return { status: response.status, body: json };
  }

  return {
    db,
    baseUrl,
    request,
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    delete: (path, opts) => request('DELETE', path, opts),
    close: () =>
      new Promise((resolve) => {
        server.close(async () => {
          await db.close();
          resolve();
        });
      }),
  };
}

/** Sign up a user and return `{ token, user }`. */
async function signup(client, overrides = {}) {
  const payload = {
    firstName: 'Test',
    lastName: 'Driver',
    email: `user${Math.random().toString(36).slice(2, 10)}@example.test`,
    password: 'Passw0rd!',
    confirmPassword: 'Passw0rd!',
    ...overrides,
  };
  const res = await client.post('/auth/signup', payload);
  if (res.status !== 201) {
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.data.token, user: res.body.data.user, payload };
}

module.exports = { startTestServer, signup };
