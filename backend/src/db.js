'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * Ordered, idempotent migrations. Applied in `version` order and recorded in
 * `schema_migrations`, so running the server twice is safe.
 *
 * The SQL is valid SQLite/libSQL and is also used by the hosted Turso database.
 */
const MIGRATIONS = [
  {
    version: 1,
    name: 'core_schema',
    sql: `
      CREATE TABLE users (
        id                TEXT PRIMARY KEY,
        email             TEXT NOT NULL UNIQUE,
        password_hash     TEXT NOT NULL,
        name              TEXT NOT NULL,
        phone             TEXT,
        avatar            TEXT,
        membership_level  TEXT NOT NULL DEFAULT 'Free',
        preferences_json  TEXT NOT NULL DEFAULT '{}',
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL
      );

      CREATE TABLE auth_sessions (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at  TEXT NOT NULL,
        revoked     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

      CREATE TABLE password_resets (
        token_hash  TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at  TEXT NOT NULL,
        used        INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
      );

      CREATE TABLE stations (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        address            TEXT NOT NULL,
        city               TEXT,
        postcode           TEXT,
        latitude           REAL NOT NULL,
        longitude          REAL NOT NULL,
        operator           TEXT NOT NULL,
        host_type          TEXT NOT NULL,
        charging_speed     TEXT NOT NULL,
        status             TEXT NOT NULL DEFAULT 'Available',
        amenities_json     TEXT NOT NULL DEFAULT '[]',
        opening_hours_json TEXT NOT NULL DEFAULT '{}',
        price_per_kwh      REAL,
        price_per_minute   REAL,
        session_fee        REAL,
        currency           TEXT NOT NULL DEFAULT 'USD',
        images_json        TEXT NOT NULL DEFAULT '[]',
        data_source        TEXT NOT NULL DEFAULT 'sample',
        last_synced_at     TEXT,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
      );
      CREATE INDEX idx_stations_city ON stations(city);
      CREATE INDEX idx_stations_geo ON stations(latitude, longitude);
      CREATE INDEX idx_stations_operator ON stations(operator);

      CREATE TABLE connectors (
        id           TEXT PRIMARY KEY,
        station_id   TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        type         TEXT NOT NULL,
        max_power_kw REAL NOT NULL,
        count        INTEGER NOT NULL DEFAULT 1,
        available    INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_connectors_station ON connectors(station_id);

      CREATE TABLE favorites (
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, station_id)
      );

      CREATE TABLE reviews (
        id         TEXT PRIMARY KEY,
        station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        title      TEXT NOT NULL,
        comment    TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (station_id, user_id)
      );
      CREATE INDEX idx_reviews_station ON reviews(station_id);

      CREATE TABLE vehicles (
        id                   TEXT PRIMARY KEY,
        user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        make                 TEXT NOT NULL,
        model                TEXT NOT NULL,
        year                 INTEGER,
        battery_capacity_kwh REAL,
        connector_types_json TEXT NOT NULL DEFAULT '[]',
        estimated_range_km   REAL,
        is_default           INTEGER NOT NULL DEFAULT 0,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL
      );
      CREATE INDEX idx_vehicles_user ON vehicles(user_id);

      CREATE TABLE bookings (
        id               TEXT PRIMARY KEY,
        user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        station_id       TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        connector_type   TEXT NOT NULL,
        start_time       TEXT NOT NULL,
        end_time         TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        status           TEXT NOT NULL DEFAULT 'confirmed',
        estimated_cost   REAL NOT NULL DEFAULT 0,
        energy_kwh       REAL,
        currency         TEXT NOT NULL DEFAULT 'USD',
        simulated        INTEGER NOT NULL DEFAULT 1,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      );
      CREATE INDEX idx_bookings_user_start ON bookings(user_id, start_time);
      CREATE INDEX idx_bookings_station_start ON bookings(station_id, start_time);

      CREATE TABLE charging_sessions (
        id                 TEXT PRIMARY KEY,
        booking_id         TEXT REFERENCES bookings(id) ON DELETE SET NULL,
        user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        station_id         TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        connector_type     TEXT NOT NULL,
        started_at         TEXT NOT NULL,
        ended_at           TEXT,
        energy_kwh         REAL NOT NULL DEFAULT 0,
        cost               REAL NOT NULL DEFAULT 0,
        currency           TEXT NOT NULL DEFAULT 'USD',
        simulated          INTEGER NOT NULL DEFAULT 1,
        operator_confirmed INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL
      );
      CREATE INDEX idx_sessions_user_started ON charging_sessions(user_id, started_at);

      CREATE TABLE wallets (
        id            TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        balance_minor INTEGER NOT NULL DEFAULT 0,
        currency      TEXT NOT NULL DEFAULT 'USD',
        simulated     INTEGER NOT NULL DEFAULT 1,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE wallet_transactions (
        id                  TEXT PRIMARY KEY,
        wallet_id           TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type                TEXT NOT NULL,
        amount_minor        INTEGER NOT NULL,
        balance_after_minor INTEGER NOT NULL,
        description         TEXT NOT NULL,
        reference           TEXT,
        simulated           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT NOT NULL
      );
      CREATE INDEX idx_wallet_tx_user ON wallet_transactions(user_id, created_at);
    `,
  },
];

/** Routes each query to the active transaction, otherwise to the adapter. */
const transactionStorage = new AsyncLocalStorage();

function splitStatements(sql) {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Wrap a query target (adapter or transaction) with the familiar prepare API. */
function prepareOn(target, sql) {
  return {
    get: async (...params) => (await target.execute(sql, params)).rows[0],
    all: async (...params) => (await target.execute(sql, params)).rows,
    run: async (...params) => {
      const result = await target.execute(sql, params);
      return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
    },
  };
}

/** Build a local SQLite adapter (used for tests and local development). */
function createSqliteAdapter(file) {
  const { DatabaseSync } = require('node:sqlite');
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') sqlite.exec('PRAGMA journal_mode = WAL;');

  return {
    kind: 'sqlite',
    async execute(sql, params = []) {
      const statement = sqlite.prepare(sql);
      if (/^\s*(select|with|values|pragma)/i.test(sql)) {
        return { rows: statement.all(...params), rowsAffected: 0 };
      }
      const info = statement.run(...params);
      return {
        rows: [],
        rowsAffected: Number(info.changes),
        lastInsertRowid: info.lastInsertRowid,
      };
    },
    async exec(sql) {
      sqlite.exec(sql);
    },
    async applyMigration(migration) {
      sqlite.exec('BEGIN');
      try {
        sqlite.exec(migration.sql);
        sqlite
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async beginTransaction() {
      sqlite.exec('BEGIN IMMEDIATE');
      const target = this;
      return {
        target,
        commit: async () => sqlite.exec('COMMIT'),
        rollback: async () => sqlite.exec('ROLLBACK'),
      };
    },
    async close() {
      sqlite.close();
    },
  };
}

/** Build a Turso/libSQL adapter for the hosted database on Vercel. */
function createLibsqlAdapter({ url, authToken }) {
  const { createClient } = require('@libsql/client');
  const client = createClient({ url, authToken });

  return {
    kind: 'libsql',
    execute: async (sql, params = []) => client.execute({ sql, args: params }),
    exec: async (sql) => {
      await client.executeMultiple(sql);
    },
    async applyMigration(migration) {
      const statements = splitStatements(migration.sql).map((sql) => ({ sql, args: [] }));
      statements.push({
        sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        args: [migration.version, migration.name, new Date().toISOString()],
      });
      await client.batch(statements, 'write');
    },
    async beginTransaction() {
      const tx = await client.transaction('write');
      const target = {
        execute: async (sql, params = []) => tx.execute({ sql, args: params }),
        exec: async (sql) => {
          await tx.execute(sql);
        },
      };
      return {
        target,
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
      };
    },
    async close() {
      client.close();
    },
  };
}

/** Public database handle used by routes and repositories. */
function makeDatabase(adapter) {
  return {
    kind: adapter.kind,
    prepare: (sql) => prepareOn(transactionStorage.getStore() || adapter, sql),
    exec: (sql) => (transactionStorage.getStore() || adapter).exec(sql),
    beginTransaction: () => adapter.beginTransaction(),
    applyMigration: (migration) => adapter.applyMigration(migration),
    close: () => adapter.close(),
  };
}

async function migrate(db) {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (' +
      'version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
  );

  const applied = new Set(
    (await db.prepare('SELECT version FROM schema_migrations').all()).map((row) => row.version),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    await db.applyMigration(migration);
  }
  return db;
}

/**
 * Run `fn` inside a transaction, rolling back on any thrown error.
 * Nested calls use SAVEPOINTs so helper functions can be composed safely.
 * All queries issued through the shared database handle inside `fn` are routed
 * to the transaction connection via AsyncLocalStorage.
 */
async function transaction(db, fn) {
  const active = transactionStorage.getStore();
  if (active) {
    const name = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await active.exec(`SAVEPOINT ${name}`);
    try {
      const result = await fn();
      await active.exec(`RELEASE ${name}`);
      return result;
    } catch (error) {
      await active.exec(`ROLLBACK TO ${name}`);
      await active.exec(`RELEASE ${name}`);
      throw error;
    }
  }

  const { target, commit, rollback } = await db.beginTransaction();
  try {
    const result = await transactionStorage.run(target, fn);
    await commit();
    return result;
  } catch (error) {
    try {
      await rollback();
    } catch {
      // Transaction was already rolled back.
    }
    throw error;
  }
}

let sharedPromise = null;

/** Lazily create a single process-wide database handle. */
function getDatabase() {
  if (!sharedPromise) {
    sharedPromise = (async () => {
      const url = process.env.TURSO_DATABASE_URL;
      const adapter = url
        ? createLibsqlAdapter({ url, authToken: process.env.TURSO_AUTH_TOKEN })
        : createSqliteAdapter(require('./config').databaseFile);
      return migrate(makeDatabase(adapter));
    })().catch((error) => {
      sharedPromise = null;
      throw error;
    });
  }
  return sharedPromise;
}

/** Test helper: build an isolated in-memory database with the schema applied. */
async function createMemoryDatabase() {
  return migrate(makeDatabase(createSqliteAdapter(':memory:')));
}

module.exports = {
  MIGRATIONS,
  transaction,
  getDatabase,
  createMemoryDatabase,
  createSqliteAdapter,
  createLibsqlAdapter,
  makeDatabase,
};
