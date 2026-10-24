# 09 — Test Cases, Results and Traceability

All results below were produced by running the suites in this repository on
**15 October 2026**. Nothing in this document is estimated.

| Suite | Command | Result |
| --- | --- | --- |
| Backend API | `cd backend && npm test` | **33 / 33 passed**, 0 failed |
| Frontend unit + integration | `cd frontend && npm test` | **76 / 76 passed** across 9 files |
| Frontend lint | `npm run lint` | **0 errors**, 4 pre-existing warnings |
| Frontend types | `npm run type-check` | clean (`tsc -b --noEmit`) |
| Frontend production build | `npm run build` | succeeded |

The backend suite runs against an isolated in-memory SQLite database
(`createMemoryDatabase`), so it needs no server and no fixture files. The frontend
suite runs on jsdom with a shared setup file (`frontend/src/test/setup.ts`) and a
provider render helper (`frontend/src/test/renderWithProviders.tsx`).

> **Suite configuration.** jsdom environments are heavy, so `vite.config.ts` caps
the pool at `maxWorkers: 2` with a 15 s test timeout. Running every file in
parallel starved the renderer and caused interaction tests to time out — the cap
removed that flakiness (two consecutive full runs: 76/76, ~20 s).

---

## 1. Automated backend test cases

`backend/test/*.test.js` — 33 tests containing 162 assertions, all executed over real HTTP requests.

### Authentication (`backend/test/auth.test.js`)

| # | Test case | Checks | Requirement |
| --- | --- | --- | --- |
| TC-B01 | password hashing is salted and verifiable | Two hashes of the same password differ; verification succeeds; wrong password fails | FR-2, NFR-2 |
| TC-B02 | signup creates a user, wallet, and session | Rows created in `users`, `wallets`, `auth_sessions`; token returned | FR-1, FR-4 |
| TC-B03 | signup rejects duplicate email and weak passwords | `409 CONFLICT` for a taken email; `400` for a weak password | FR-3 |
| TC-B04 | login succeeds with correct credentials and fails otherwise | `200` with token vs `401` for a wrong password/unknown email | FR-4, FR-5 |
| TC-B05 | protected routes require a valid token and logout revokes sessions | `401` without a token, `401` after logout with the same token | FR-6, NFR-4 |
| TC-B06 | password reset token works once and revokes existing sessions | Second use fails; previously issued sessions become invalid | FR-9 |
| TC-B07 | forgot-password does not reveal whether an account exists | Identical response for a known and an unknown email | FR-8 |

### Bookings and sessions (`backend/test/bookings.test.js`)

| # | Test case | Checks | Requirement |
| --- | --- | --- | --- |
| TC-B08 | creates a booking with an estimated cost and marks it simulated | `201`, `simulated = 1`, estimated cost > 0 | FR-19 |
| TC-B09 | rejects a connector the station does not offer | `400 VALIDATION_ERROR` | FR-20 |
| TC-B10 | rejects bookings in the past and out-of-range durations | `400` for a past start and for 10/600-minute durations | FR-20 |
| TC-B11 | prevents overlapping bookings on the same connector | Second overlapping booking → `409 CONFLICT` | FR-21 |
| TC-B12 | bookings are scoped to the owner | Another user's booking is not returned/editable (`403`) | FR-22 |
| TC-B13 | cancellation is a valid state transition | `confirmed → cancelled` allowed, cancelling again → `409` | FR-23 |
| TC-B14 | starting an unconfirmed booking is rejected | `409 CONFLICT` | FR-24 |
| TC-B15 | full session lifecycle debits the wallet and records history | Balance decreases by exactly the session cost; ledger entry appended; history lists the session | FR-25, FR-27, NFR-7 |
| TC-B16 | stopping without funds is refused and leaves the session open | `409 CONFLICT`, balance unchanged, session still open | FR-26 |
| TC-B17 | booking list supports status filters and pagination | `upcoming`/`completed`/`cancelled` filters and paging | FR-14 |

### Stations (`backend/test/stations.test.js`)

| # | Test case | Checks | Requirement |
| --- | --- | --- | --- |
| TC-B18 | station list is paginated and reports totals | `page`/`limit` honoured, `total` and `hasMore` correct | FR-14 |
| TC-B19 | text search matches name, city, and operator | Free-text search across the documented columns | FR-11 |
| TC-B20 | filters by connector type, price, and amenities | Only matching stations returned | FR-12 |
| TC-B21 | distance filtering and sorting use the supplied origin | `radius` applied; nearest first | FR-13, FR-15 |
| TC-B22 | sorting by price and rating works | Ascending price, descending rating | FR-13 |
| TC-B23 | station detail returns connectors and 404 for unknown ids | Connector details present; `404 NOT_FOUND` | FR-17 |
| TC-B24 | ratings are aggregated from stored reviews | Average and count recomputed from `reviews` rows | FR-31 |
| TC-B25 | reviews require authentication and valid input | `401` signed out; `400` for a rating of 9 or an empty comment | FR-31 |
| TC-B26 | favorites are per-user and idempotent | Repeated add does not duplicate; another user is unaffected | FR-30 |
| TC-B27 | filter metadata lists distinct values for the UI | Operators, connectors, speeds, amenities, price range | FR-12 |

### Users, wallet and analytics (`backend/test/users.test.js`)

| # | Test case | Checks | Requirement |
| --- | --- | --- | --- |
| TC-B28 | profile can be read and updated, and rejects invalid values | Name update persists; too-short name → `400` | FR-28 |
| TC-B29 | vehicles are created, updated, and scoped to the owner | CRUD works; another user's vehicle is not reachable | FR-29 |
| TC-B30 | simulated wallet top-ups are recorded with a consistent ledger | `balanceAfterMinor` chains correctly | FR-32, FR-33 |
| TC-B31 | wallet top-up validates bounds and isolates users | `$0.50` and `$5,000` rejected; balances are per user | FR-33 |
| TC-B32 | analytics are computed from stored records, not hardcoded | Totals change after a session is recorded | FR-34 |
| TC-B33 | unauthenticated access to user data is denied | Profile, wallet, vehicles and analytics all `401` | FR-10, NFR-4 |

## 2. Automated frontend test cases

| File | Tests | What it proves |
| --- | --- | --- |
| `src/utils/helpers.test.ts` | 14 | Price/distance/date formatting, Haversine distance, password/email/phone validation, grouping/sorting/de-duplication, query-string round-trip, **station filter logic**, status colours, error extraction |
| `src/services/api.test.ts` | 11 | Envelope unwrapping, `Bearer` header, `ApiError` code/status, token cleared on `401`, network errors reported as status 0, token stored on login, token cleared on logout even when the call fails, **demo fallback only for network errors**, filter → query-parameter mapping, booking POST body |
| `src/components/auth/ProtectedRoute.test.tsx` | 4 | Anonymous visitor redirected to `/login`; valid session renders the page; expired session cleared; **network failure does not sign the driver out** |
| `src/components/ui/Button.test.tsx` | 6 | Label, click, loading → disabled + `aria-busy`, disabled blocks clicks, `type` defaults to `button`, icon-only button needs an accessible name |
| `src/pages/auth/LoginPage.test.tsx` | 5 | Form renders with accessible fields; invalid email is caught **before** any request; successful sign-in stores the token and navigates to the dashboard; API error surfaces in a `role="alert"`; the demo-account hint fills and submits the seeded credentials |
| `src/pages/BookingPage.test.tsx` | 13 | Station + connector load with an honest cost estimate; booking creation posts the right payload and reports it is a demo reservation; **conflict** (409) keeps the form open with the API message; station-load failure; booking list with status/simulated labels; cancel; start and stop of a simulated session with the wallet debit; refusing a start; status filter reaches the API; empty, error and signed-out states |
| `src/pages/SearchPage.test.tsx` | 14 | Result cards + count announced in a live region (plural and singular); free-text query; empty state; failed search with retry; demo-mode labelling; connector / charging-speed / availability filters; sort reset to page 1; filter count on the toggle; map view replacing the list; signed-out heart as a sign-in link; favourite save confirmation |
| `src/pages/ResetPasswordPage.test.tsx` | 5 | Missing token, missing password and mismatched passwords produce the app's own messages (no request sent); a valid submission calls the API and announces success politely; an expired token surfaces the API message as an alert |
| `src/pages/ProfilePage.test.tsx` | 4 | Saving without a name is blocked with an explanation and no request; a valid save confirms; a vehicle without make/model is blocked; saved stations from the API are listed with an identifying remove button |

Representative frontend test cases:

| # | Test case | Expected | Requirement |
| --- | --- | --- | --- |
| TC-F01 | Sign in with `demo@afterglow.test` | Token stored, navigation to `/dashboard`, `POST /auth/login` called once | FR-4 |
| TC-F02 | Submit an invalid email | Field message shown, **no** request sent | FR-38 |
| TC-F03 | API replies `401` on sign-in | Alert region shows the API message, no token stored | FR-5 |
| TC-F04 | Open a protected page with no token | Redirect to sign-in, protected content absent | FR-10 |
| TC-F05 | Stored token rejected with `401` | Token removed from storage | FR-7 |
| TC-F06 | API unreachable while restoring a session | Token kept (no spurious sign-out) | FR-7 |
| TC-F07 | Search API unreachable | Sample stations returned and marked as demo | FR-18 |
| TC-F08 | Server error (500) during search | Error propagates; sample data is **not** substituted | FR-18, NFR-8 |
| TC-F09 | Filter by amenity `[WiFi, Cafe]` | Only stations offering all requested amenities | FR-12 |
| TC-F10 | Rating filter ≥ 4 | Stations below the threshold excluded | FR-12 |
| TC-F11 | Confirm a booking | `POST /bookings` payload has station, connector and duration; success text says it is a demo reservation | FR-19 |
| TC-F12 | API answers `409 CONFLICT` for an overlapping slot | Conflict message shown, form stays open | FR-21 |
| TC-F13 | Cancel a confirmed booking | `cancelBooking` called with the id, confirmation shown | FR-23 |
| TC-F14 | Stop an active session | Cost is reported as a wallet debit | FR-25 |
| TC-F15 | Search returns `source: 'demo'` | Demo-mode banner shown | FR-18 |
| TC-F16 | Non-network search failure | Error state with Retry; sample data is not substituted | FR-18 |
| TC-F17 | Connector / speed / availability filters | Correct filter object sent to the API, chip marked `aria-pressed` | FR-12 |
| TC-F18 | Reset password with an empty token | App message shown, no request (no native browser bubble) | FR-38 |
| TC-F19 | Save profile without a name | Blocked with an explanation, no `PUT /users/profile` | FR-28, FR-38 |
| TC-F20 | Review with a missing title or comment | Blocked with an announced message, no `POST` | FR-31, FR-38 |

## 3. Manual test cases (executed against the running app)

Performed in a real browser against Vite `:5173` and the API `:5000`.

| # | Scenario | Steps | Observed result | Requirement |
| --- | --- | --- | --- | --- |
| TC-M01 | Sign in with the demo account | `/login` → *Use the demo account* → *Sign in with demo account* | Redirected to `/dashboard`, "Welcome back, Demo", title "Dashboard · Afterglow" | FR-4, FR-36 |
| TC-M02 | Excellent-practice form feedback | Submit `not-an-email` | Field shows "Please enter a valid email address", `aria-invalid="true"`, `aria-describedby` wired, **no request sent** (this was a real defect — the fix is `noValidate` on the zod-driven forms) | FR-38 |
| TC-M03 | Search and result announcement | Open `/search` | "14 stations" in a `role="status"` live region; 14 cards from the database | FR-11, FR-39 |
| TC-M04 | Skip link and landmarks | Focus the first element / inspect the DOM | `a.skip-link` visible on focus at `top ≈ 8px`; `<main id="main-content" tabindex="-1">`; focus moves to main on navigation | FR-37 |
| TC-M05 | Station detail honesty | Open `/station/st-002` | "Sample data" badge, "This is bundled sample data… Availability is not live.", connector power, price, amenities, OSM map with attribution | FR-17, NFR-8 |
| TC-M06 | Booking creation | `/bookings?stationId=st-001` → *Confirm booking* | "Booking saved in your account. This is a demo reservation — no real station was contacted." Status `confirmed`, badge `simulated` | FR-19 |
| TC-M07 | Booking conflict | Repeat the same connector/date/time | `409 CONFLICT` → "That connector is already reserved for part of this time window. Pick another time or connector." | FR-21 |
| TC-M08 | Charging session and wallet | *Start charging*, then *Stop charging* | "Charging session started (simulated — no real hardware is involved.)" → "Session ended. Estimated cost $1.28 was deducted from your demo wallet." | FR-24, FR-25 |
| TC-M09 | Ledger consistency | Open `/wallet` | $50.00 − $2.03 − $1.09 − $1.28 = **$45.60**, matching `balance_after_minor` for all four entries | FR-32, NFR-7 |
| TC-M10 | Wallet labelling | Read `/wallet` | "This wallet is not real. It holds no money, stores no card details, and cannot move real funds." | NFR-8 |
| TC-M11 | Review submission and aggregation | Station page → 5 stars, title, comment → *Submit review* | "Thanks — your review was saved." → "Reviews (1)", "5 average from 1 review" | FR-31 |
| TC-M12 | Favourite round trip | Station page *Save* → `/profile` | Button becomes "Saved"; the station appears under *Saved stations* and in `GET /users/favorites` | FR-30 |
| TC-M13 | Dashboard uses stored data | `/dashboard`, compare with `GET /users/analytics` | Numbers match exactly (2 sessions, 7.2 kWh, $3.12, 2 bookings) and are labelled "estimated from session duration" | FR-34 |
| TC-M14 | Profile and vehicles | `/profile` | Account details, units, notifications, vehicles (2023 Demo Volt EV, 68 kWh, CCS/J1772), saved stations all render | FR-28, FR-29 |
| TC-M15 | Route titles | Navigate several routes | Title follows the route, e.g. "Station details · Afterglow", "My bookings · Afterglow" | FR-36 |
| TC-M16 | 404 route | Open an unknown path | `NotFoundPage` renders with a route back | FR-37 |
| TC-M17 | Membership honesty | `/membership` | Free is available; paid tiers are marked *Planned* and cannot be purchased (no billing endpoint exists) | FR-35 |
| TC-M18 | Demo mode fallback | Stop the API and search | Amber "Demo mode — showing bundled sample stations because the API is unreachable. These are not real stations." | FR-18 |
| TC-M19 | Reset form validation | `/reset-password`, submit empty | App alert "Paste the reset token from your reset link.", `form.noValidate = true`, **no** `/auth/reset-password` request in the network log | FR-38 |
| TC-M20 | Profile form validation | `/profile`, clear the name, *Save changes* | App alert "Add your full name before saving."; only the favourites request is made | FR-28, FR-38 |
| TC-M21 | Review form validation | Station page, submit an empty review | Announced message "Add a title and a comment before submitting."; no POST | FR-31, FR-38 |
| TC-M22 | Unknown station id | `/station/does-not-exist` in a fresh tab | "Station unavailable" with the API message "Station not found." and *Retry* / *Back to search* | FR-17, NFR-8 |
| TC-M23 | Unknown route | `/this-route-does-not-exist` | "404" page, title "Page not found · Afterglow", links to home and search | FR-37 |
| TC-M24 | Navigation sweep | Collect every `href` on the home page | All 21 internal links resolve to declared routes; protected links redirect signed-out visitors to sign-in | FR-10, FR-41 |

## 4. Traceability matrix

| Requirement | Implementation | Test coverage |
| --- | --- | --- |
| FR-1…FR-3 sign-up | `routes/auth.js`, `pages/SignupPage.tsx` | TC-B02, TC-B03 |
| FR-4…FR-7 sign-in, sessions | `security.js`, `hooks/useAuth.tsx`, `services/api.ts` | TC-B04, TC-B05, TC-F01, TC-F05, TC-F06, TC-M01 |
| FR-8, FR-9 password reset | `routes/auth.js`, `ForgotPasswordPage`, `ResetPasswordPage` | TC-B06, TC-B07 |
| FR-10 protected routes | `components/auth/ProtectedRoute.tsx` | TC-B33, TC-F04, TC-M01 |
| FR-11…FR-14 search/filter/sort/paging | `routes/stations.js`, `pages/SearchPage.tsx`, `utils/helpers.ts` | TC-B18…TC-B22, TC-F09, TC-F10, TC-M03 |
| FR-15 "near me" | `hooks/useGeolocation.ts`, `GET /stations/nearby` | TC-B21, TC-M03 |
| FR-16 list/map sync | `SearchPage`, `components/common/StationMap.tsx` | TC-M03 (manual; Leaflet is not mounted in jsdom) |
| FR-17 station detail | `pages/StationDetailsPage.tsx`, `serializers.js` | TC-B23, TC-M05 |
| FR-18 demo fallback | `services/api.ts` (`withDemoFallback`), `data/sampleStations.ts` | TC-F07, TC-F08, TC-M18 |
| FR-19…FR-23 bookings | `routes/bookings.js`, `pages/BookingPage.tsx` | TC-B08…TC-B13, TC-B17, TC-F11…TC-F14, TC-M06, TC-M07 |
| FR-24…FR-27 charging + wallet | `routes/bookings.js`, `repo.js` (`applyWalletTransaction`) | TC-B14, TC-B15, TC-B16, TC-M08, TC-M09 |
| FR-28, FR-29 profile, vehicles | `routes/users.js`, `pages/ProfilePage.tsx` | TC-B28, TC-B29, TC-M14 |
| FR-30 favourites | `POST/DELETE /stations/:id/favorite`, `GET /users/favorites` | TC-B26, TC-M12 |
| FR-31 reviews | `routes/stations.js`, station page review form | TC-B24, TC-B25, TC-M11 |
| FR-32, FR-33 wallet | `routes/users.js`, `repo.js` | TC-B30, TC-B31, TC-M09, TC-M10 |
| FR-34 dashboard | `repo.js` analytics, `pages/DashboardPage.tsx` | TC-B32, TC-M13 |
| FR-35 membership | `pages/MembershipPage.tsx` | TC-M17 |
| FR-36 route titles | `hooks/useDocumentTitle.ts`, `MainLayout.tsx` | TC-M01, TC-M15 |
| FR-37 skip link / focus / 404 | `MainLayout.tsx`, `index.css`, `NotFoundPage.tsx` | TC-M04, TC-M16 |
| FR-38 validation feedback | `components/ui/Input.tsx`; `noValidate` on every form (zod-driven and hand-written alike) so the app-owned message always wins | TC-F02, TC-F18…TC-F20, TC-M02, TC-M19…TC-M21 |
| FR-39 live regions | `SearchPage` count + favourite notice, `LoginPage` alert | TC-M03 |
| FR-40, FR-41 theme and responsive layout | `context/ThemeContext.tsx`, Tailwind breakpoints, mobile menu | Manual review at 360 px / tablet / desktop widths |
| NFR-1 zero-cost stack | No paid dependency in either `package.json` | — |
| NFR-2…NFR-7 security and integrity | `security.js`, `app.js`, `db.js`, bound SQL | TC-B01, TC-B05, TC-B33 |
| NFR-10 performance | route-level `lazy`, `manualChunks`, React Query caching | `npm run build` chunk split |
| NFR-12 testability | `backend/test`, `frontend/src/**/*.test.ts(x)` | 33 + 40 automated tests |

## 5. Known coverage gaps (declared, not hidden)

1. **Leaflet map interaction** is verified manually only — jsdom has no layout
   engine, so `SearchPage` mocks `StationMap` and the real tile rendering plus
   marker/selection sync is checked in the browser (TC-M03).
2. **Password-reset end-to-end** with a delivered email cannot be tested: no email
   provider is configured (FE-5). The token flow itself is covered by TC-B06.
3. **No visual-regression or cross-browser suite** (single-browser manual pass).
4. **Live-provider behaviour** cannot be tested because no provider is integrated
   (FE-2); the demo fallback path is tested instead.
5. Paid membership purchase cannot be tested because no billing endpoint exists by
   design (FE-4).
