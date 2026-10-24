# 08 — API Reference

* **Base URL (development):** `http://localhost:5000/api/v1` — the Vite dev server
  proxies `/api` to it, so the browser calls same-origin `/api/v1`.
* **Content type:** `application/json` for every request body and response.
* **Authentication:** `Authorization: Bearer <session token>` on routes marked
  *auth* below. The token comes from `/auth/signup` or `/auth/login` and expires
  after `SESSION_TTL_HOURS` (default 168 h).
* **Envelope:** `{ "success": true, "data": … }` or
  `{ "success": false, "error": { "code", "message", "details"? } }`.
* **Error codes:** `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN`
  (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429),
  `INTERNAL_ERROR` (500).
* **Rate limits:** 600 requests / 5 min per IP for the whole API; sign-up and the
  two password-reset routes additionally allow 30 attempts / 15 min.

**34 routes in total:** 2 health routes plus 32 under `/api/v1` — 6 auth, 8 station,
7 booking and 11 user routes.

---

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | – | Service banner (also used by uptime checks) |
| GET | `/api/v1` | – | Same payload under the API prefix |

```json
{ "success": true, "data": { "status": "ok", "service": "chargeease-api", "version": "1.0.0", "time": "2026-10-15T05:31:39.074Z" } }
```

## Authentication — `/api/v1/auth` (6 routes)

### POST `/auth/signup`
Creates a user, an empty simulated wallet and a session in one transaction.

| Field | Type | Rules |
| --- | --- | --- |
| `firstName`, `lastName` | string | 1–60 chars |
| `email` | string | valid email, unique (case-insensitive) |
| `phone` | string | optional, ≤ 32 chars |
| `password` | string | ≥ 8 chars with at least one uppercase letter, one lowercase letter and one digit |
| `confirmPassword` | string | optional; if sent must equal `password` |
| `newsletter` | boolean | optional preference |

```json
201 { "success": true, "data": { "user": { … }, "token": "…", "expiresAt": "2026-10-22T…Z" } }
400 VALIDATION_ERROR   // invalid field, weak password, mismatched confirmation
409 CONFLICT           // "An account with this email already exists."
```

### POST `/auth/login`
Body: `{ "email", "password" }`.
Returns the same `{ user, token, expiresAt }` payload, or
`401 UNAUTHORIZED` — *"Invalid email or password."* (the message never says which
field was wrong).

### POST `/auth/logout` · *auth*
Marks the current session revoked server-side and returns
`{ "success": true, "data": { "message": "Signed out." } }`. The client clears its
token even if this call fails.

### GET `/auth/me` · *auth*
`200 { "user": … }` for a valid, unexpired, non-revoked session; otherwise
`401 UNAUTHORIZED`. Used on every app load to restore the session.

### POST `/auth/forgot-password`
Body: `{ "email" }`. Always answers the same way, so it cannot be used to discover
accounts:

```json
200 { "success": true, "data": {
  "message": "If an account exists for that email, a password reset link has been generated.",
  "devResetToken": "…",   // present only when the account exists and NODE_ENV ≠ production
  "devResetUrl": "http://localhost:5173/reset-password?token=…",
  "emailSent": false } }
```
`emailSent` is `false` because email delivery is a Future Enhancement; the UI shows
the link instead and says so.

### POST `/auth/reset-password`
Body: `{ "token", "password" }` (≥ 8 chars, same policy). Consumes the single-use
token (30-minute TTL) and revokes all existing sessions.

```json
200 { "success": true, "data": { "message": "Password updated. Please sign in again." } }
400 VALIDATION_ERROR   // "This reset link is invalid or has expired."
```
The new password must also satisfy the password policy; all existing sessions are
revoked as part of the same operation.

## Stations — `/api/v1/stations` (8 routes)

### GET `/stations`
Public. Query parameters (all optional):

| Parameter | Type | Default / bounds |
| --- | --- | --- |
| `q` | string | free text over name, address, city, postcode, operator |
| `city` | string | exact, case-insensitive |
| `postcode` | string | prefix match |
| `lat`, `lng` | number | origin for distance; with `radius` (1–500, default 25) it filters by distance |
| `chargingSpeed` | enum / repeated | `Level 1`, `Level 2`, `DC Fast`, `Supercharger` |
| `connectorType` | string / repeated | any connector type the station offers |
| `amenity` | string / repeated | station must have all requested amenities |
| `operator` | string / repeated | exact operator names |
| `available` | boolean | only stations whose status is `Available` |
| `minPrice`, `maxPrice` | number | price per kWh bounds |
| `minRating` | number | minimum average rating |
| `sort` | enum | `distance` (default), `price`, `rating`, `speed`, `name` |
| `page` | int | default 1, max 10000 |
| `limit` | int | default 12, max 50 |

```json
200 { "success": true, "data": {
  "stations": [ { "id": "st-012", "name": "Austin Congress Avenue Hub", "distance": 3.4,
                  "connectorTypes": [ { "type": "CCS", "maxPower": 180, "available": false, "count": 2 } ],
                  "pricing": { "perKwh": 0.35, "sessionFee": 0.5, "currency": "USD" },
                  "availability": { "status": "Available", "availableConnectors": 6, "totalConnectors": 8 },
                  "rating": 0, "reviewCount": 0, "dataSource": "sample", "lastSyncedAt": null, … } ],
  "total": 14, "page": 1, "limit": 12, "hasMore": true } }
400 VALIDATION_ERROR   // bad enum, out-of-range page/limit
```

### GET `/stations/meta/filters`
Public. Distinct values for the filter UI plus the price range:

```json
200 { "data": { "operators": […], "connectorTypes": […], "chargingSpeeds": […],
                "amenities": […], "priceRange": { "min": 0.22, "max": 0.55 } } }
```

### GET `/stations/nearby`
Public. Requires `lat` (−90…90) and `lng` (−180…180); optional `radius`
(1–500, default 25). Returns up to 50 stations inside the radius, ordered by
straight-line distance.

### GET `/stations/:id`
Public. Optional `lat`/`lng` add `distance` to the response.

```json
200 { "data": { "station": { …, "connectorTypes": […], "operatingHours": { "isOpen24Hours": false, "schedule": … } } } }
404 NOT_FOUND          // "Station not found."
```

### GET `/stations/:id/reviews`
Public. `page`, `limit` (default 10, max 50).

```json
200 { "data": { "reviews": [ { "id", "rating", "title", "comment", "userName", "createdAt" } ],
                "total": 1, "averageRating": 4.5 } }
```

### POST `/stations/:id/reviews` · *auth*
Body: `{ "rating": 1–5, "title": "3–120 chars", "comment": "5–2000 chars" }`.
One review per user per station — submitting again **updates** the existing review.
Returns `201 { "review": … }`; `401 UNAUTHORIZED` when signed out; `400` for invalid
values; `404` for an unknown station.

### POST `/stations/:id/favorite` · *auth*
Idempotent (`INSERT OR IGNORE`). `201 { "favorite": true }`; `404` for an unknown
station.

### DELETE `/stations/:id/favorite` · *auth*
Idempotent removal: `200 { "favorite": false }`.

## Bookings — `/api/v1/bookings` (7 routes, all require auth)

### POST `/bookings`
Body:

| Field | Type | Rules |
| --- | --- | --- |
| `stationId` | string | must exist |
| `connectorType` | string | must be offered by that station (case-insensitive) |
| `startTime` | ISO date-time | must be in the future (1-minute grace) |
| `durationMinutes` | int | 15–480 |

```json
201 { "data": { "booking": { "id", "stationId", "connectorType", "startTime", "endTime",
                             "duration": 60, "status": "confirmed", "totalCost": 46.4,
                             "simulated": true, … }, "note": "…" } }
400 VALIDATION_ERROR   // "Start time must be in the future." / duration out of range / connector not offered
404 NOT_FOUND          // "Station not found."
409 CONFLICT           // overlap: "That connector is already reserved for part of this time window…"
                       // or "This station is currently out of service."
```

### GET `/bookings`
Query: `status` = `all` (default) | `upcoming` | `active` | `completed` | `cancelled`;
`page` (max 1000), `limit` (default 10, max 50). Only the caller's bookings are
returned, newest start time first, with station details and the total count.

### GET `/bookings/history`
Stored `charging_sessions` for the caller (`page`, `limit` default 20, max 50) — kept
separate from reservations so simulated sessions are never confused with bookings.

### GET `/bookings/:id`
The caller's booking, or `403 FORBIDDEN` if it belongs to someone else,
`404 NOT_FOUND` if it does not exist.

### POST `/bookings/:id/cancel`
Legal transition from a non-final state; otherwise `409 CONFLICT`
(*"A cancelled booking cannot be cancelled."*). Returns the updated booking.

### POST `/bookings/:id/start`
Only a `confirmed` booking can start. Creates a `charging_sessions` row inside a
transaction and sets the booking `active`. `409 CONFLICT` for any other state.

### POST `/bookings/:id/stop`
Computes energy and cost, debits the simulated wallet, appends a
`wallet_transactions` row with the resulting balance, closes the session and marks
the booking `completed` — all in one transaction.

```json
200 { "data": { "chargingCost": 1.28, "charged": true, "note": "…" } }
409 CONFLICT   // "Only an active booking can be stopped." / "No open charging session found…"
               // "Insufficient wallet balance for this operation." (session stays open)
```

## Users — `/api/v1/users` (11 routes, all require auth)

### GET `/users/profile`
`200 { "user": { id, email, name, phone, avatar, vehicles, preferences, membershipLevel, createdAt, updatedAt } }`

### PUT `/users/profile`
Partial update — send only what changes: `name` (2–80), `phone` (≤ 32, empty clears),
`avatar` (≤ 500), `preferences` (`units` = `imperial`/`metric`, `language`,
`notifications.email`/`push`/`sms`). Returns the updated user. Email cannot be
changed (out of scope; stated in the UI).

### GET `/users/vehicles` · POST `/users/vehicles`
`POST` body: `make` (1–60), `model` (1–60), `year` (1990–2100, optional),
`batteryCapacity` (1–500 kWh, optional), `estimatedRange` (1–2000, optional),
`connectorTypes` (array, filtered to the known types), `isDefault` (boolean).
`201 { "vehicle": … }`.

### PUT `/users/vehicles/:id` · DELETE `/users/vehicles/:id`
Owner-scoped update and removal (`404` for another user's vehicle or unknown id).

### GET `/users/favorites`
`200 { "stations": [ … ] }` — the caller's saved stations, fully serialized.

### GET `/users/wallet`
```json
200 { "data": { "wallet": { "balanceMinor": 4560, "balance": 45.6, "currency": "USD", "simulated": true },
                "transactions": [ … ], "notice": "Simulated wallet…" } }
```

### GET `/users/wallet/transactions`
Append-only ledger for the caller: `page`, `limit` (default 20, max 50), `total`,
`hasMore`. Each entry has `type` (`topup`/`charge`/`refund`/`adjustment`/`membership`),
signed `amountMinor`, `balanceAfterMinor`, `description`, `simulated`.

### POST `/users/wallet/topup`
Body `{ "amountMinor": 100…100000 }` (i.e. $1.00–$1,000.00).
```json
201 { "data": { "transaction": …, "wallet": …, "simulated": true,
                "notice": "Simulated top-up. No real payment was processed." } }
400 VALIDATION_ERROR   // out of bounds
```
There is deliberately **no** endpoint that lets a client set a balance, and no
endpoint that moves real money.

### GET `/users/analytics`
Computed with SQL from the caller's own bookings and sessions:
`totalSessions`, `totalEnergyConsumed`, `totalCost`, `totalBookings`,
`monthlyUsage[]` (`month`, `sessions`, `energyConsumed`, `cost`) and
`favoriteStations[]`, plus a `notice` explaining that the figures are estimates.

## Not implemented (Future Enhancements)

| Missing route | Would serve | Blocked by |
| --- | --- | --- |
| Station provider sync | Live availability | FE-2 |
| Operator reservation confirmation | Real slot locking | FE-3 |
| Payment intent / card capture | Real top-ups | FE-4 |
| Transactional email | Delivering reset links | FE-5 |

## Try it with curl

```bash
# health
curl -s localhost:5000/api/v1

# sign in as the seeded demo account and capture the token
TOKEN=$(curl -s -X POST localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@afterglow.test","password":"Demo1234!"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.token))")

# search with filters, then read the wallet
curl -s "localhost:5000/api/v1/stations?q=austin&connectorType=CCS&sort=price&limit=3"
curl -s localhost:5000/api/v1/users/wallet -H "Authorization: Bearer $TOKEN"
```
