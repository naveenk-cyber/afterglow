# ⚡ Afterglow

Afterglow — a modern EV charging station discovery and session management platform.

An EV charging-station finder and account-management web app. It is a full-stack,
local-first project built entirely on free and open-source tools — no paid APIs,
no paid map tiles, and no paid AI services.

> **Honesty note.** Station availability, reservations, and payments require live
> operator and payment integrations. **None are connected.** Station data ships as
> clearly labelled sample data, and bookings, charging sessions, and the wallet
> are simulated and labelled as such everywhere they appear in the UI.

---

## Contents

- [What works today](#what-works-today)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Environment variables](#environment-variables)
- [Database](#database)
- [API](#api)
- [Maps and station data](#maps-and-station-data)
- [Security](#security)
- [Testing](#testing)
- [Free deployment notes](#free-deployment-notes)
- [Known limitations](#known-limitations)
- [Next improvements](#next-improvements)

---

## What works today

| Area | Status |
| --- | --- |
| Email + password auth (signup, login, logout, session revocation) | ✅ Implemented, scrypt hashing |
| Password reset | ✅ Implemented; **no email is sent** (see [limitations](#known-limitations)) |
| Station search: address / city / postcode / coordinates | ✅ Server-side |
| Filters: connector, speed, price, amenities, operator, availability | ✅ Server-side |
| Sorting: distance, price, rating, speed, name | ✅ Server-side |
| Pagination | ✅ Server-side |
| List ↔ map view with synchronized selection | ✅ Leaflet + OpenStreetMap |
| Station detail: connectors, power, pricing, hours, operator, data freshness | ✅ |
| Reviews with stored averages | ✅ Server-side, one per user per station |
| Favourites | ✅ Per-user, persisted |
| Bookings with connector compatibility + time-conflict checks | ✅ Server-side, transactional |
| Charging sessions (start / stop, energy + cost estimate) | ✅ **Simulated** |
| Demo wallet with ledger | ✅ **Simulated**, server-computed balances |
| Vehicles, profile, preferences | ✅ Persisted |
| Dashboard with charts and analytics | ✅ Computed from stored records |
| Membership comparison | ✅ **Purchases disabled** (no billing provider) |
| Light / dark theme with persistence | ✅ |
| Backend test suite | ✅ 33 tests via `node --test` |
| Frontend test suite | ✅ 76 tests via Vitest + Testing Library |

## Tech stack

**Frontend** — React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7,
TanStack Query 5, React Hook Form + Zod, Leaflet / react-leaflet on
OpenStreetMap tiles, lucide-react icons.

**Backend** — Node.js 22+, Express 4, SQLite through the built-in `node:sqlite`
module (no native build step), scrypt password hashing and HMAC-SHA256 session
tokens from `node:crypto`, `express-rate-limit`.

No ORM, no database server, and no external service is required to run it.

## Quick start

Requirements: **Node.js ≥ 22.5** (for `node:sqlite`) and npm.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env            # optional in dev; see Environment variables
npm run seed                    # creates data/chargeease.db + sample stations + demo account
npm run dev                     # http://localhost:5000  (API under /api/v1)

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to the backend,
so no CORS configuration is needed locally.

### Demo account

Created by `npm run seed`:

```
email:    demo@afterglow.test
password: Demo1234!
```

It starts with a **simulated** wallet balance so you can exercise a full
booking → charging → payment cycle. It is local demo data, not a real account.

## Commands

### Backend (`backend/`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with `--watch` |
| `npm start` | Start the API |
| `node server.js` | Legacy entry point (equivalent to `npm start`) |
| `npm run seed` | Apply migrations and upsert sample stations + the demo account |
| `npm test` | Run the test suite (`node --test`) |

### Frontend (`frontend/`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint (0 errors) |
| `npm run type-check` | `tsc -b --noEmit` |
| `npm test` | Run the Vitest suite (unit + component tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with a V8 coverage report |

## Environment variables

### backend/.env

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | `production` enforces a real `JWT_SECRET` |
| `API_PREFIX` | `/api/v1` | Mount point for the API |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `JWT_SECRET` | *(generated in dev)* | **Required in production.** `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SESSION_TTL_HOURS` | `168` | Session lifetime |
| `DATABASE_FILE` | `./data/chargeease.db` | SQLite file path |
| `PUBLIC_APP_URL` | `http://localhost:5173` | Used to build password-reset links |
| `CURRENCY` | `USD` | Currency code stored with prices |
| `DISTANCE_UNIT` | `miles` | Distance unit hint |
| `SEED_ON_START` | unset | Set to `false` to skip auto-seeding an empty database |

### frontend/.env

Both variables are optional; see [frontend/.env.example](frontend/.env.example).
`VITE_API_URL` defaults to the same-origin path `/api/v1`.

**Never commit `.env`, the SQLite database, or any real credential.**

## Database

SQLite, versioned through migration entries in [backend/src/db.js](backend/src/db.js).
Migrations run automatically on startup and are idempotent.

Tables: `schema_migrations`, `users`, `auth_sessions`, `password_resets`,
`stations`, `connectors`, `favorites`, `reviews`, `vehicles`, `bookings`,
`charging_sessions`, `wallets`, `wallet_transactions`.

Relationship summary:

```
users ──1:1── wallets ──1:N── wallet_transactions
  │                                 │
  ├─1:N─ vehicles                   └─(user_id, wallet_id)
  ├─1:N─ auth_sessions
  ├─1:N─ password_resets
  ├─1:N─ bookings ──1:1── charging_sessions
  ├─N:M─ stations  (favorites)
  └─1:N─ reviews ──(station_id)

stations ──1:N── connectors
```

Money is stored in **minor units** (integer cents) and converted at the API
boundary, so balances never drift from floating-point rounding.

## API

Base URL: `/api/v1`. Every response is `{ "success": true, "data": … }` or
`{ "success": false, "error": { "code", "message", "details?" } }`.

### Auth
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/signup` | — | Create an account, wallet, and session |
| POST | `/auth/login` | — | Exchange credentials for a session token |
| POST | `/auth/logout` | ✅ | Revoke the current session |
| GET | `/auth/me` | ✅ | Current user |
| POST | `/auth/forgot-password` | — | Create a reset token (dev returns the link) |
| POST | `/auth/reset-password` | — | Set a new password, revokes all sessions |

### Stations
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/stations` | — | Search/filter/sort/paginate (`q`, `city`, `postcode`, `lat`, `lng`, `radius`, `connectorType`, `chargingSpeed`, `amenity`, `operator`, `minPrice`, `maxPrice`, `minRating`, `available`, `sort`, `page`, `limit`) |
| GET | `/stations/meta/filters` | — | Distinct operators, connectors, speeds, amenities, price range |
| GET | `/stations/nearby` | — | Stations within a radius of `lat`/`lng` |
| GET | `/stations/:id` | — | Station detail with connectors and rating |
| GET | `/stations/:id/reviews` | — | Paginated reviews + average rating |
| POST | `/stations/:id/reviews` | ✅ | Create or update your review |
| POST | `/stations/:id/favorite` | ✅ | Save a station |
| DELETE | `/stations/:id/favorite` | ✅ | Remove a saved station |

### Bookings
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/bookings` | ✅ | Create a booking (connector + conflict validation) |
| GET | `/bookings` | ✅ | Your bookings (`status`, `page`, `limit`) |
| GET | `/bookings/history` | ✅ | Completed charging sessions |
| GET | `/bookings/:id` | ✅ | One booking (owner only) |
| POST | `/bookings/:id/cancel` | ✅ | Cancel a pending/confirmed booking |
| POST | `/bookings/:id/start` | ✅ | Open a **simulated** charging session |
| POST | `/bookings/:id/stop` | ✅ | Close the session and debit the demo wallet |

### Users
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET/PUT | `/users/profile` | ✅ | Read/update profile and preferences |
| GET/POST | `/users/vehicles` | ✅ | List/add vehicles |
| PUT/DELETE | `/users/vehicles/:id` | ✅ | Update/remove a vehicle (owner only) |
| GET | `/users/favorites` | ✅ | Your saved stations |
| GET | `/users/wallet` | ✅ | Balance + recent ledger |
| GET | `/users/wallet/transactions` | ✅ | Paginated ledger |
| POST | `/users/wallet/topup` | ✅ | **Simulated** top-up |
| GET | `/users/analytics` | ✅ | Usage statistics from stored records |

## Maps and station data

**Maps** use Leaflet with raster tiles from the public OpenStreetMap tile
servers, and attribution is rendered on the map. The OSM tile service is free
but has a [usage policy](https://operations.osmfoundation.org/policies/tiles/) —
it is not intended to back high-traffic production apps and must not be
bulk-downloaded. For production traffic, point `TILE_URL` in
[StationMap.tsx](frontend/src/components/common/StationMap.tsx) at your own tile
server or a commercial provider.

**Station data** is sample data in [backend/src/seed-data.js](backend/src/seed-data.js),
tagged `data_source = 'sample'` and labelled "Sample data" in the UI. Driving
directions link out to OpenStreetMap. Real availability would require an
operator integration or a provider such as
[Open Charge Map](https://openchargemap.org/) — check its current terms and
attribution requirements before use, and add it as an adapter next to
`seedStations()` so the provider can be swapped.

If the API is unreachable the frontend falls back to the bundled sample stations
in [sampleStations.ts](frontend/src/data/sampleStations.ts) and displays a
"Demo mode" notice. It never presents those as live results.

## Security

Implemented:

- Passwords hashed with **scrypt** (per-password salt, constant-time compare).
- Revocable sessions: tokens carry a session id checked against `auth_sessions`.
- **Server-side authorization.** Bookings, vehicles, wallet, and reviews are
  scoped to the authenticated user; another user's records return `403`.
- Server-side input validation and sanitising on every write.
- Parameterised SQL everywhere (no string-built queries).
- Rate limiting on credential endpoints (30/15 min) and the whole API (600/5 min).
- CORS restricted to configured origins; basic security headers set.
- Production refuses to start without a sufficiently long `JWT_SECRET`.
- Error responses never leak stack traces in production.

Deliberate trade-offs to revisit before a real launch:

- The session token is kept in `localStorage`. Prefer `httpOnly`, `Secure`,
  `SameSite` cookies with CSRF protection for production.
- The frontend is a static SPA; there is no CSRF token because auth is
  header-based. Adding cookie auth requires adding CSRF protection with it.
- No email verification and no email delivery.

## Testing

```bash
cd backend && npm test      # 33 API tests on an in-memory SQLite database
cd frontend && npm test     # 76 unit + component tests in 9 files (Vitest, jsdom)
```

33 tests cover password hashing, signup/login/logout, session revocation,
password reset (single use + session invalidation), account-enumeration
resistance, station search/filter/sort/pagination, review aggregation,
favourites isolation, booking conflicts, booking state transitions,
cross-user authorization, wallet ledger consistency, and analytics.

On the frontend, 76 tests in 9 files cover the shared helpers (formatting,
distance, validation, station filtering, query strings), the API client contract
(envelope handling, `Bearer` header, error codes, token clearing on `401`, demo
fallback), the `ProtectedRoute` auth guard (including the rule that a network
blip does not sign a driver out), the `Button` and `Input` accessibility
contracts, the sign-in and password-reset workflows, the booking lifecycle
(create, conflict, cancel, start/stop, filters, empty and error states), station
search and filters (live regions, demo mode, map switching, favourites) and the
profile form guards. The Leaflet map rendering and a few purely visual flows are
still verified manually in a browser (see [Known limitations](#known-limitations)).

## Documentation

The CASE documents live in [docs/](docs/README.md) and describe this codebase,
not an idealised version of it:

| Document | Contents |
| --- | --- |
| [01 — System requirements](docs/01-system-requirements.md) | Scope, actors, FR-xx/NFR-xx, future enhancements |
| [02 — Use cases](docs/02-use-case-diagram.md) | Use-case diagram and catalogue (UC-01…UC-19) |
| [03 — Class diagram](docs/03-class-diagram.md) | Entities, API resources, frontend services |
| [04 — Sequence diagrams](docs/04-sequence-diagrams.md) | Sign-up, sign-in, search, booking, charging + wallet, review, reset |
| [05 — Activity diagrams](docs/05-activity-diagrams.md) | Booking, charging, session restore, search |
| [06 — ER diagram](docs/06-er-diagram.md) | 12 tables, indexes, integrity rules, seeded data |
| [07 — Architecture](docs/07-architecture.md) | Layered, component and deployment views, module map |
| [08 — API reference](docs/08-api-reference.md) | All 34 routes with payloads and error codes |
| [09 — Test cases](docs/09-test-cases.md) | Automated + manual cases, results, traceability matrix |

## Deployment (Vercel + Turso)

This repository deploys as one Vercel project: the Vite frontend is served as
static assets and the Express API runs as a Node serverless function at
`/api/*` ([api/[...path].js](api/%5B...path%5D.js)).

**Database.** Vercel functions have no persistent filesystem, so production uses
a hosted [Turso](https://turso.tech) libSQL database. Create a free database,
then set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel. The adapter in
[db.js](backend/src/db.js) uses the same SQL and keeps local development and
tests on the bundled SQLite file (`DATABASE_FILE`). Schema migrations run
automatically on the first request.

**Required Vercel environment variables.** See [.env.example](.env.example):
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, a strong `JWT_SECRET`,
`PUBLIC_APP_URL`, `CORS_ORIGIN`, `SEED_ON_START=true`, and optionally
`SEED_DEMO_USER=true` to publish the documented demo account. Never put real
secrets in `VITE_*` variables — those are embedded in the browser bundle.

**Project settings.** Root Directory: repository root. Framework: Other. Build
command, install command, output directory and SPA rewrites come from
[vercel.json](vercel.json). The API stays same-origin, so no `VITE_API_URL` is
needed in production.

**Local development.** Run the API with `cd backend && npm run dev` and the
frontend with `cd frontend && npm run dev`; Vite proxies `/api` to port 5000.
Set `VITE_API_URL` only when the API is on a different origin, and add that
origin to the backend's `CORS_ORIGIN`.

Free tiers change and are not permanent or unlimited. Verify quotas before
relying on any of them, and add a reverse proxy plus HTTPS in front of the API.

## Known limitations

- **No live station data.** Sample data only; availability is not real-time.
- **No operator integration.** Bookings are stored in the Afterglow database
  and never sent to a charge-point operator.
- **Simulated payments.** The wallet is a demo ledger. No payment gateway, no
  card data, and no real money movement.
- **No email delivery.** Password reset returns the token directly in
  development and sends nothing. Production needs an SMTP or transactional-email
  provider.
- **Social sign-in** is not implemented (no buttons are shown for it).
- **Membership purchases are disabled.** No billing provider is connected.
- **Energy and cost are estimates** from session duration and the listed price —
  they are not meter readings. No carbon or financial "savings" are claimed.
- **Map and visual flows are verified manually.** jsdom has no layout engine, so
  Leaflet rendering under `StationMap`/`SearchPage` map mode has no automated
  test; the components around it do.
- `node:sqlite` is marked experimental by Node and prints a warning on startup.
  The data layer is isolated in [db.js](backend/src/db.js) for easy replacement.

## Next improvements

1. **Open Charge Map adapter** for real station data behind the existing service
   layer, with caching and attribution.
2. **httpOnly cookie sessions + CSRF tokens** to replace `localStorage` tokens.
3. **Email provider integration** so password reset and notifications actually
   deliver.
4. **End-to-end smoke test** (Playwright) for the sign-in → search → book → charge
   journey, plus a CI workflow running lint, type-check, build and both suites
   (the unit suites already exist).
5. **Operator integration interface** for real reservations and live
   availability, with a sandbox implementation and clear UI states.
6. **Route planning** using a free routing provider within its usage terms,
   replacing straight-line distance with real driving distance and time.
7. **Postgres migration** with a `postgres.js` query layer for managed hosting.
8. **Accessibility and performance passes**: axe audit, image optimisation,
   virtualised long result lists, and a service worker for offline favourites.

---

## Project layout

```
chargeease/
├── backend/
│   ├── server.js            # legacy entry point
│   ├── src/
│   │   ├── app.js           # Express app factory (CORS, headers, rate limits, errors)
│   │   ├── index.js         # bootstrap: migrate, seed, listen
│   │   ├── config.js        # env-driven configuration
│   │   ├── db.js            # SQLite handle, migrations, transactions
│   │   ├── security.js      # scrypt hashing, session tokens, auth middleware
│   │   ├── validate.js      # input validation helpers
│   │   ├── serializers.js   # row → API shapes
│   │   ├── repo.js          # shared data access + wallet ledger
│   │   ├── seed.js          # idempotent seeding
│   │   ├── seed-data.js     # SAMPLE stations + demo account
│   │   └── routes/          # auth, stations, bookings, users
│   └── test/                # node:test suites
├── frontend/
│   └── src/
│       ├── components/      # ui/, layout/, home/, common/, auth/
│       ├── context/         # ThemeContext
│       ├── data/            # offline sample stations (demo mode)
│       ├── hooks/           # useAuth, useGeolocation, useDocumentTitle
│       ├── pages/           # search, station detail, bookings, dashboard, wallet, profile…
│       ├── services/api.ts  # typed API client + demo fallback
│       ├── test/            # Vitest setup + provider render helper
│       └── utils/           # constants, helpers
├── docs/                    # CASE documentation (SRS, diagrams, API, tests)
└── assets/                  # screenshots
```

## License

MIT — see [LICENSE](LICENSE) if present.
