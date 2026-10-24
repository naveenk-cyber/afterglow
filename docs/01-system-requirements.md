# 01 — System Requirements Specification (SRS)

**Project:** Afterglow — EV charging-station finder
**Version:** 1.0 (matches `backend/package.json` and `frontend/package.json`)
**Type:** Academic CASE project — a runnable, self-hostable demonstration, not a
commercial service.

---

## 1. Purpose and scope

Afterglow lets a driver find charging stations, inspect connectors and prices,
reserve a time window on a specific connector, run a simulated charging session,
and track the resulting spend. It also gives each signed-in user a profile,
saved vehicles, favourites, reviews, a dashboard and a wallet.

The system is deliberately **local-first**:

* station records are bundled sample data (14 stations, `backend/src/seed-data.js`);
* bookings, charging sessions and wallet movements are stored in the local SQLite
  database and are labelled *simulated* everywhere they appear;
* no external paid service is required to run it.

**In scope:** authentication and session management, station search/filter/sort,
map and list views, station detail, bookings with conflict detection, simulated
charging and wallet ledger, reviews, favourites, vehicles, profile, dashboard
analytics, membership comparison, CASE documentation and automated tests.

**Out of scope (Future Enhancements):**

| ID | Deferred item | Why deferred |
| --- | --- | --- |
| FE-1 | HttpOnly-cookie sessions + CSRF protection | Changes the auth contract; current token-in-localStorage flow is preserved deliberately |
| FE-2 | Live station provider integration (e.g. Open Charge Map) | Needs an API key and network access; provider interface already exists |
| FE-3 | Real operator-confirmed reservations | Requires an operator partnership/API |
| FE-4 | Real payment gateway | Needs a payment provider account |
| FE-5 | Email delivery for password resets | Needs an SMTP/email provider; reset link is surfaced in the UI instead |

## 2. Actors

| Actor | Description | Entry points |
| --- | --- | --- |
| **Visitor** | Unauthenticated user | `/`, `/search`, `/station/:id`, `/membership`, `/about`, `/login`, `/signup` |
| **Registered driver** | Authenticated user (created via sign-up or the seeded demo account) | everything above plus `/dashboard`, `/bookings`, `/wallet`, `/profile` |
| **Demo account holder** | The seeded `demo@afterglow.test` account with sample bookings and a simulated balance | same as driver |
| **Operator / network** | External charging network that would confirm availability | *not integrated* — represented by labelled sample data |
| **Developer / demonstrator** | Runs migrations, seeds data, executes the test suites | `npm run seed`, `npm test` |

## 3. Functional requirements

Requirement IDs are used by the traceability matrix in
[09-test-cases.md](09-test-cases.md).

### 3.1 Authentication and session management

| ID | Requirement |
| --- | --- |
| FR-1 | A visitor can create an account with first/last name, email, phone (optional), password and password confirmation. |
| FR-2 | Passwords are stored only as salted **scrypt** hashes and never returned by the API. |
| FR-3 | Sign-up rejects duplicate emails and passwords that fail the documented policy (≥ 8 chars, upper, lower, digit). |
| FR-4 | A registered user can sign in and receives a server-issued session token with an expiry. |
| FR-5 | Sign-in errors do not reveal which field was wrong. |
| FR-6 | A signed-in user can sign out; the session is **revoked server-side**, not merely forgotten by the browser. |
| FR-7 | On reload, a stored token is validated against `GET /auth/me`; an expired/revoked token is discarded. |
| FR-8 | A visitor can request a password reset; the response does not reveal whether an account exists. |
| FR-9 | A reset token is single-use, expires after 30 minutes, and revokes existing sessions when used. |
| FR-10 | Protected routes (`/dashboard`, `/bookings`, `/wallet`, `/profile`) redirect anonymous visitors to the sign-in page, preserving the intended destination. |

### 3.2 Station discovery

| ID | Requirement |
| --- | --- |
| FR-11 | Search by free text across name, address, city, postcode and operator. |
| FR-12 | Filter by charging speed, connector type, amenity, operator, availability and maximum price; filter values come from `GET /stations/meta/filters`. |
| FR-13 | Sort by distance, price, rating, charging speed or name. |
| FR-14 | Results are paginated (default 12 per page, max 50) and report the total. |
| FR-15 | "Near me" uses browser geolocation and reports distance from the supplied origin. |
| FR-16 | List and map views show the same result set; selecting a card highlights its marker and vice versa. |
| FR-17 | Station detail shows connectors with power, availability, pricing, amenities, operator, opening hours and data-freshness labels. |
| FR-18 | If the API is unreachable, search falls back to bundled sample stations and clearly marks the result **Demo mode**. |

### 3.3 Bookings and charging `[DEMO]`

| ID | Requirement |
| --- | --- |
| FR-19 | A signed-in user can book a connector for a start time and duration of 15–480 minutes. |
| FR-20 | Bookings in the past, durations outside the range, or a connector the station does not offer are rejected. |
| FR-21 | Overlapping bookings on the same station + connector are rejected with an explanation. |
| FR-22 | Bookings are scoped to their owner; another user's booking returns `403 FORBIDDEN`, never data. |
| FR-23 | A booking can be cancelled; cancellation is a validated state transition. |
| FR-24 | An owner can start a charging session from a confirmed booking and stop it later. |
| FR-25 | Stopping a session computes cost from energy and price and debits the simulated wallet inside a transaction. |
| FR-26 | If the wallet balance is insufficient, the stop is refused and the session stays open. |
| FR-27 | Booking history lists stored charging sessions separately from reservations. |

### 3.4 Account, vehicles, favourites, reviews, wallet, analytics

| ID | Requirement |
| --- | --- |
| FR-28 | A user can read and update their profile (name, phone, units, notification preferences). |
| FR-29 | Vehicles can be created, updated and deleted; each operation is scoped to the owner. |
| FR-30 | Favourites can be added and removed idempotently and are per-user. |
| FR-31 | A user can review a station with 1–5 stars, a title (3–120 chars) and a comment (5–2000 chars); re-submitting updates that user's existing review, and the station's rating and review count are computed from stored reviews. |
| FR-32 | The wallet exposes a balance and an append-only ledger; the client can never set a balance directly. |
| FR-33 | Top-ups are validated (bounds) and recorded as ledger entries. |
| FR-34 | The dashboard reports sessions, energy, spend, bookings and monthly usage computed from stored records. |
| FR-35 | The membership page compares Free/Premium/Elite plans; only Free is purchasable, paid tiers are labelled as planned. |

### 3.5 Presentation, feedback and accessibility

| ID | Requirement |
| --- | --- |
| FR-36 | Every route sets a descriptive document title. |
| FR-37 | A keyboard user can skip the header to the main content; focus moves to main content on navigation. |
| FR-38 | Form validation errors are shown next to the field and announced to assistive technology. Every form opts out of native browser validation (`noValidate`) so the application's own message is what the user sees, while `required`/`aria-invalid`/`aria-describedby` semantics are preserved. |
| FR-39 | Async results (search count, favourite, booking actions) are announced through live regions. |
| FR-40 | The interface works in light and dark themes, and the choice persists. |
| FR-41 | Layout is responsive from 360 px to desktop width, with a mobile navigation menu. |

## 4. Non-functional requirements

| ID | Requirement | How it is satisfied |
| --- | --- | --- |
| NFR-1 | **Runnable locally with zero paid services** | Node ≥ 22.5 + npm only; `node:sqlite`; bundled sample data |
| NFR-2 | **Security — credential storage** | scrypt hashing with per-password salt (`backend/src/security.js`) |
| NFR-3 | **Security — transport headers** | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production |
| NFR-4 | **Security — abuse control** | Rate limiting (600 requests / 5 min per IP) on the whole API |
| NFR-5 | **Security — injection safety** | All SQL uses bound parameters; request bodies capped at 100 kB |
| NFR-6 | **Data integrity** | Foreign keys enforced, `PRAGMA foreign_keys = ON`, single migration record in `schema_migrations` |
| NFR-7 | **Consistency** | Money is stored in minor units (`balance_minor`) to avoid floating-point drift; multi-step writes run in a transaction |
| NFR-8 | **Usability** | Loading, empty and error states on every data screen; demo data labelled wherever it appears |
| NFR-9 | **Accessibility** | Semantic landmarks, labelled controls, visible focus, live regions, reduced-motion supported (WCAG 2.1 AA intent) |
| NFR-10 | **Performance** | Route-level code splitting, vendor chunk splitting, lazy Leaflet loading, query caching and stale times |
| NFR-11 | **Maintainability** | Layered backend (routes → validate → repo → db), typed frontend, per-entity services |
| NFR-12 | **Testability** | 33 backend API tests on an in-memory database; 40 frontend unit/integration tests; both run with one command |
| NFR-13 | **Documentation** | README + this CASE set, kept in sync with the code |

## 5. Constraints and assumptions

1. The backend requires Node ≥ 22.5 because it uses the built-in `node:sqlite`
   module; there is no native dependency to compile.
2. SQLite is a single-file database — sufficient for a single-node demo, not for
   horizontal scaling.
3. Sample stations cover the San Francisco Bay Area and Austin; distance values are
   straight-line (Haversine) unless a routing provider is added (FE-2).
4. Wallet and payment behaviour is simulated. No card data is collected or stored.
5. Email is not configured, so password-reset links are shown in the UI in
   development and never sent.
6. Session tokens are held in `localStorage` for local/demo convenience; moving
   them to HttpOnly cookies is FE-1.

## 6. Success criteria

* `npm test` passes in both `backend/` and `frontend/` (33 + 40 tests).
* `npm run lint` reports 0 errors and `npm run type-check` and `npm run build` succeed.
* A visitor can sign up, sign in, search, book, run a simulated session, see the
  wallet debit, and sign out — with every simulated value labelled as such.
* No screen claims real stations, real payments or real availability.
