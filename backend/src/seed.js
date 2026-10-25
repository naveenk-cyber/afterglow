'use strict';

const config = require('./config');
const { getDatabase, transaction } = require('./db');
const { hashPassword } = require('./security');
const { SAMPLE_STATIONS, DEMO_USER } = require('./seed-data');
const { newId, nowIso, ensureWallet, applyWalletTransaction, findUserByEmail } = require('./repo');

const iso = () => nowIso();

/** Upsert sample stations and their connectors. Safe to run repeatedly. */
async function seedStations(db) {
  const timestamp = iso();
  return transaction(db, async () => {
    const insertStation = db.prepare(
      `INSERT INTO stations
        (id, name, address, city, postcode, latitude, longitude, operator, host_type, charging_speed,
         status, amenities_json, opening_hours_json, price_per_kwh, price_per_minute, session_fee,
         currency, images_json, data_source, last_synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sample', NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, address = excluded.address, city = excluded.city,
         postcode = excluded.postcode, latitude = excluded.latitude, longitude = excluded.longitude,
         operator = excluded.operator, host_type = excluded.host_type,
         charging_speed = excluded.charging_speed, status = excluded.status,
         amenities_json = excluded.amenities_json, opening_hours_json = excluded.opening_hours_json,
         price_per_kwh = excluded.price_per_kwh, price_per_minute = excluded.price_per_minute,
         session_fee = excluded.session_fee, currency = excluded.currency,
         images_json = excluded.images_json, updated_at = excluded.updated_at`,
    );
    const deleteConnectors = db.prepare('DELETE FROM connectors WHERE station_id = ?');
    const insertConnector = db.prepare(
      `INSERT INTO connectors (id, station_id, type, max_power_kw, count, available)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let count = 0;
    for (const station of SAMPLE_STATIONS) {
      await insertStation.run(
        station.id,
        station.name,
        station.address,
        station.city,
        station.postcode,
        station.latitude,
        station.longitude,
        station.operator,
        station.hostType,
        station.chargingSpeed,
        station.status,
        JSON.stringify(station.amenities || []),
        JSON.stringify(station.openingHours || { isOpen24Hours: true }),
        station.pricePerKwh ?? null,
        station.pricePerMinute ?? null,
        station.sessionFee ?? null,
        config.currency,
        JSON.stringify(station.images || []),
        timestamp,
        timestamp,
      );
      await deleteConnectors.run(station.id);
      for (const connector of station.connectors) {
        await insertConnector.run(
          `${station.id}-${connector.type}-${connector.maxPowerKw}`,
          station.id,
          connector.type,
          connector.maxPowerKw,
          connector.count,
          connector.available,
        );
      }
      count += 1;
    }
    return count;
  });
}

/** Create the demo driver account if it does not exist yet. */
async function seedDemoUser(db) {
  const existing = await findUserByEmail(db, DEMO_USER.email);
  if (existing) return { created: false, userId: existing.id };

  const id = newId();
  const timestamp = iso();
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, phone, membership_level, preferences_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Free', ?, ?, ?)`,
    )
    .run(
      id,
      DEMO_USER.email,
      hashPassword(DEMO_USER.password),
      `${DEMO_USER.firstName} ${DEMO_USER.lastName}`,
      DEMO_USER.phone,
      JSON.stringify({
        units: 'imperial',
        language: 'en',
        notifications: { email: true, push: false, sms: false },
      }),
      timestamp,
      timestamp,
    );

  for (const vehicle of DEMO_USER.vehicles) {
    await db
      .prepare(
        `INSERT INTO vehicles
          (id, user_id, make, model, year, battery_capacity_kwh, connector_types_json,
           estimated_range_km, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId(),
        id,
        vehicle.make,
        vehicle.model,
        vehicle.year,
        vehicle.batteryCapacity,
        JSON.stringify(vehicle.connectorTypes),
        vehicle.estimatedRange,
        vehicle.isDefault ? 1 : 0,
        timestamp,
        timestamp,
      );
  }

  await ensureWallet(db, id);
  if (DEMO_USER.startingBalanceMinor > 0) {
    await applyWalletTransaction(db, id, {
      type: 'topup',
      amountMinor: DEMO_USER.startingBalanceMinor,
      description: 'Welcome credit (simulated)',
      reference: 'demo-seed',
    });
  }
  return { created: true, userId: id };
}

/** Seed stations on boot when the table is empty (development convenience). */
async function seedIfEmpty(db) {
  const row = await db.prepare('SELECT COUNT(*) AS c FROM stations').get();
  if (Number(row.c) === 0) await seedStations(db);
}

async function runSeed(db) {
  const stations = await seedStations(db);
  const demo = await seedDemoUser(db);
  return { stations, demoUserCreated: demo.created };
}

module.exports = { seedStations, seedDemoUser, seedIfEmpty, runSeed };

if (require.main === module) {
  (async () => {
    const db = await getDatabase();
    const result = await runSeed(db);
    const stationTotal = await db.prepare('SELECT COUNT(*) AS c FROM stations').get();
    console.log('Seed complete.');
    console.log(`  Stations in database: ${stationTotal.c} (upserted ${result.stations}).`);
    console.log(
      `  Demo account: ${DEMO_USER.email} / ${DEMO_USER.password} ${
        result.demoUserCreated ? '(created)' : '(already existed)'
      }`,
    );
    console.log('  Sample data is clearly labelled "sample" and is not a live station feed.');
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
