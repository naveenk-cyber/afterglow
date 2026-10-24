'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, signup } = require('./helpers');

test('station list is paginated and reports totals', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const res = await client.get('/stations?limit=5&page=1');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.stations.length, 5);
  assert.ok(res.body.data.total >= 14);
  assert.equal(res.body.data.hasMore, true);
  assert.equal(res.body.data.source, 'database');
});

test('text search matches name, city, and operator', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const byCity = await client.get('/stations?q=Austin');
  assert.ok(byCity.body.data.stations.length >= 1);
  assert.equal(byCity.body.data.stations[0].city, 'Austin');

  const byOperator = await client.get('/stations?q=EVgo');
  assert.ok(byOperator.body.data.stations.every((s) => /evgo/i.test(s.operator)));

  const noMatch = await client.get('/stations?q=zzzznotarealplace');
  assert.equal(noMatch.body.data.total, 0);
});

test('filters by connector type, price, and amenities', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const chademo = await client.get('/stations?connectorType=CHAdeMO');
  assert.ok(chademo.body.data.stations.length >= 1);
  assert.ok(
    chademo.body.data.stations.every((s) => s.connectorTypes.some((c) => c.type === 'CHAdeMO')),
  );

  const cheap = await client.get('/stations?maxPrice=0.25');
  assert.ok(cheap.body.data.stations.every((s) => s.pricing.perKwh <= 0.25));

  const wifi = await client.get('/stations?amenity=WiFi');
  assert.ok(wifi.body.data.stations.every((s) => s.amenities.includes('WiFi')));
});

test('distance filtering and sorting use the supplied origin', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const res = await client.get('/stations?lat=37.7749&lng=-122.4194&radius=8&sort=distance');
  const stations = res.body.data.stations;
  assert.ok(stations.length > 0);
  for (const station of stations) {
    assert.ok(typeof station.distance === 'number');
    assert.ok(station.distance <= 8, `${station.name} should be within 8 miles`);
  }
  for (let i = 1; i < stations.length; i += 1) {
    assert.ok(stations[i].distance >= stations[i - 1].distance, 'sorted by distance ascending');
  }
});

test('sorting by price and rating works', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const byPrice = await client.get('/stations?sort=price&limit=50');
  const prices = byPrice.body.data.stations
    .map((s) => s.pricing.perKwh)
    .filter((p) => typeof p === 'number');
  for (let i = 1; i < prices.length; i += 1) {
    assert.ok(prices[i] >= prices[i - 1], 'prices ascending');
  }

  const byRating = await client.get('/stations?sort=rating&limit=50');
  assert.equal(byRating.status, 200);
});

test('sorting by availability prioritises the largest free share', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const response = await client.get('/stations?sort=availability&limit=50');
  assert.equal(response.status, 200);

  const shares = response.body.data.stations.map((station) => {
    const { availableConnectors, totalConnectors } = station.availability;
    return totalConnectors > 0 ? availableConnectors / totalConnectors : 0;
  });
  for (let i = 1; i < shares.length; i += 1) {
    assert.ok(shares[i] <= shares[i - 1] + 1e-9, 'free connector share is non-increasing');
  }
});

test('station detail returns connectors and 404 for unknown ids', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const detail = await client.get('/stations/st-001');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.station.id, 'st-001');
  assert.ok(detail.body.data.station.connectorTypes.length >= 1);
  assert.equal(detail.body.data.station.dataSource, 'sample');

  const missing = await client.get('/stations/does-not-exist');
  assert.equal(missing.status, 404);
});

test('ratings are aggregated from stored reviews', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const { token } = await signup(client);
  const created = await client.post(
    '/stations/st-001/reviews',
    { rating: 4, title: 'Solid stop', comment: 'Fast and reliable on a weekday morning.' },
    { token },
  );
  assert.equal(created.status, 201);

  const detail = await client.get('/stations/st-001');
  assert.equal(detail.body.data.station.reviewCount, 1);
  assert.equal(detail.body.data.station.rating, 4);

  // Second user adds a review; average must update.
  const second = await signup(client);
  await client.post(
    '/stations/st-001/reviews',
    { rating: 2, title: 'Busy', comment: 'Long wait at peak time.' },
    { token: second.token },
  );
  const after = await client.get('/stations/st-001');
  assert.equal(after.body.data.station.reviewCount, 2);
  assert.equal(after.body.data.station.rating, 3);

  // A user can update their own review without creating a duplicate.
  await client.post(
    '/stations/st-001/reviews',
    { rating: 5, title: 'Updated', comment: 'Better on a second visit.' },
    { token },
  );
  const final = await client.get('/stations/st-001');
  assert.equal(final.body.data.station.reviewCount, 2);

  const reviews = await client.get('/stations/st-001/reviews');
  assert.equal(reviews.body.data.total, 2);
  assert.ok(reviews.body.data.reviews[0].userName);
});

test('reviews require authentication and valid input', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const anonymous = await client.post('/stations/st-001/reviews', {
    rating: 5,
    title: 'Nice',
    comment: 'Great spot here.',
  });
  assert.equal(anonymous.status, 401);

  const { token } = await signup(client);
  const invalid = await client.post(
    '/stations/st-001/reviews',
    { rating: 9, title: 'x', comment: 'short' },
    { token },
  );
  assert.equal(invalid.status, 400);
});

test('favorites are per-user and idempotent', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const alice = await signup(client);
  const bob = await signup(client);

  const add = await client.post('/stations/st-002/favorite', undefined, { token: alice.token });
  assert.equal(add.status, 201);
  const addAgain = await client.post('/stations/st-002/favorite', undefined, { token: alice.token });
  assert.equal(addAgain.status, 201);

  const aliceFavorites = await client.get('/users/favorites', { token: alice.token });
  assert.equal(aliceFavorites.body.data.stations.length, 1);

  const bobFavorites = await client.get('/users/favorites', { token: bob.token });
  assert.equal(bobFavorites.body.data.stations.length, 0, 'favorites must not leak across users');

  await client.delete('/stations/st-002/favorite', { token: alice.token });
  const cleared = await client.get('/users/favorites', { token: alice.token });
  assert.equal(cleared.body.data.stations.length, 0);
});

test('filter metadata lists distinct values for the UI', async (t) => {
  const client = await startTestServer();
  t.after(() => client.close());

  const res = await client.get('/stations/meta/filters');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.connectorTypes.includes('CCS'));
  assert.ok(res.body.data.amenities.includes('WiFi'));
  assert.ok(res.body.data.operators.length > 0);
  assert.ok(res.body.data.priceRange.max > 0);
});
