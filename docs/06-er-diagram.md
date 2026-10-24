# 06 — Entity-Relationship Diagram and Data Dictionary

The schema is created by a single ordered migration (`core_schema`, version 1) in
`backend/src/db.js`, recorded in `schema_migrations` so re-running the server is
safe. SQLite runs with `PRAGMA foreign_keys = ON` and `journal_mode = WAL`.

**12 tables · 16 foreign-key columns · 11 indexes** (excluding the implicit
`PRIMARY KEY`/`UNIQUE` indexes).

## ER diagram

```mermaid
erDiagram
  users ||--o{ auth_sessions : "has"
  users ||--o{ password_resets : "requests"
  users ||--|| wallets : "owns"
  wallets ||--o{ wallet_transactions : "records"
  users ||--o{ wallet_transactions : "initiates"
  users ||--o{ vehicles : "registers"
  users ||--o{ favorites : "saves"
  users ||--o{ reviews : "writes"
  users ||--o{ bookings : "places"
  users ||--o{ charging_sessions : "runs"
  stations ||--o{ connectors : "offers"
  stations ||--o{ reviews : "receives"
  stations ||--o{ favorites : "is saved as"
  stations ||--o{ bookings : "is reserved at"
  stations ||--o{ charging_sessions : "serves"
  bookings |o--o| charging_sessions : "produces"

  users {
    TEXT id PK
    TEXT email UK "NOT NULL UNIQUE"
    TEXT password_hash "NOT NULL (scrypt)"
    TEXT name "NOT NULL"
    TEXT phone "nullable"
    TEXT avatar "nullable"
    TEXT membership_level "NOT NULL default 'Free'"
    TEXT preferences_json "NOT NULL default '{}'"
    TEXT created_at "NOT NULL"
    TEXT updated_at "NOT NULL"
  }

  auth_sessions {
    TEXT id PK
    TEXT user_id FK "NOT NULL → users.id ON DELETE CASCADE"
    TEXT expires_at "NOT NULL"
    INTEGER revoked "NOT NULL default 0"
    TEXT created_at "NOT NULL"
  }

  password_resets {
    TEXT token_hash PK "SHA-256 of the reset token"
    TEXT user_id FK "NOT NULL → users.id ON DELETE CASCADE"
    TEXT expires_at "NOT NULL (30 min TTL)"
    INTEGER used "NOT NULL default 0"
    TEXT created_at "NOT NULL"
  }

  stations {
    TEXT id PK
    TEXT name "NOT NULL"
    TEXT address "NOT NULL"
    TEXT city "nullable"
    TEXT postcode "nullable"
    REAL latitude "NOT NULL"
    REAL longitude "NOT NULL"
    TEXT operator "NOT NULL"
    TEXT host_type "NOT NULL"
    TEXT charging_speed "NOT NULL"
    TEXT status "NOT NULL default 'Available'"
    TEXT amenities_json "NOT NULL default '[]'"
    TEXT opening_hours_json "NOT NULL default '{}'"
    REAL price_per_kwh "nullable"
    REAL price_per_minute "nullable"
    REAL session_fee "nullable"
    TEXT currency "NOT NULL default 'USD'"
    TEXT images_json "NOT NULL default '[]'"
    TEXT data_source "NOT NULL default 'sample'"
    TEXT last_synced_at "nullable"
    TEXT created_at "NOT NULL"
    TEXT updated_at "NOT NULL"
  }

  connectors {
    TEXT id PK
    TEXT station_id FK "NOT NULL → stations.id ON DELETE CASCADE"
    TEXT type "NOT NULL"
    REAL max_power_kw "NOT NULL"
    INTEGER count "NOT NULL default 1"
    INTEGER available "NOT NULL default 0"
  }

  bookings {
    TEXT id PK
    TEXT user_id FK "NOT NULL → users.id ON DELETE CASCADE"
    TEXT station_id FK "NOT NULL → stations.id ON DELETE CASCADE"
    TEXT connector_type "NOT NULL"
    TEXT start_time "NOT NULL"
    TEXT end_time "NOT NULL"
    INTEGER duration_minutes "NOT NULL"
    TEXT status "NOT NULL default 'confirmed'"
    REAL estimated_cost "NOT NULL default 0"
    REAL energy_kwh "nullable"
    TEXT currency "NOT NULL default 'USD'"
    INTEGER simulated "NOT NULL default 1"
    TEXT created_at "NOT NULL"
    TEXT updated_at "NOT NULL"
  }

  charging_sessions {
    TEXT id PK
    TEXT booking_id FK "nullable → bookings.id ON DELETE SET NULL"
    TEXT user_id FK "NOT NULL → users.id ON DELETE CASCADE"
    TEXT station_id FK "NOT NULL → stations.id ON DELETE CASCADE"
    TEXT connector_type "NOT NULL"
    TEXT started_at "NOT NULL"
    TEXT ended_at "nullable"
    REAL energy_kwh "NOT NULL default 0"
    REAL cost "NOT NULL default 0"
    TEXT currency "NOT NULL default 'USD'"
    INTEGER simulated "NOT NULL default 1"
    INTEGER operator_confirmed "NOT NULL default 0"
    TEXT created_at "NOT NULL"
  }

  wallets {
    TEXT id PK
    TEXT user_id FK "NOT NULL UNIQUE → users.id ON DELETE CASCADE"
    INTEGER balance_minor "NOT NULL default 0"
    TEXT currency "NOT NULL default 'USD'"
    INTEGER simulated "NOT NULL default 1"
    TEXT updated_at "NOT NULL"
  }

  wallet_transactions {
    TEXT id PK
    TEXT wallet_id FK "NOT NULL → wallets.id ON DELETE CASCADE"
    TEXT user_id FK "NOT NULL → users.id ON DELETE CASCADE"
    TEXT type "NOT NULL: topup | charge | refund | adjustment | membership"
    INTEGER amount_minor "NOT NULL (signed)"
    INTEGER balance_after_minor "NOT NULL"
    TEXT description "NOT NULL"
    TEXT reference "nullable"
    INTEGER simulated "NOT NULL default 1"
    TEXT created_at "NOT NULL"
  }

  vehicles {
    TEXT id PK
    TEXT user_id FK "NOT NULL → users.id ON DELETE CASCADE"
    TEXT make "NOT NULL"
    TEXT model "NOT NULL"
    INTEGER year "nullable"
    REAL battery_capacity_kwh "nullable"
    TEXT connector_types_json "NOT NULL default '[]'"
    REAL estimated_range_km "nullable"
    INTEGER is_default "NOT NULL default 0"
    TEXT created_at "NOT NULL"
    TEXT updated_at "NOT NULL"
  }

  reviews {
    TEXT id PK
    TEXT station_id FK "NOT NULL → stations.id ON DELETE CASCADE"
    TEXT user_id FK "NOT NULL → users.id ON DELETE CASCADE"
    INTEGER rating "NOT NULL CHECK 1..5"
    TEXT title "NOT NULL"
    TEXT comment "NOT NULL"
    TEXT created_at "NOT NULL"
    TEXT updated_at "NOT NULL"
  }

  favorites {
    TEXT user_id PK_FK "→ users.id ON DELETE CASCADE"
    TEXT station_id PK_FK "→ stations.id ON DELETE CASCADE"
    TEXT created_at "NOT NULL"
  }
```

## Indexes

| Index | Table | Columns | Purpose |
| --- | --- | --- | --- |
| `idx_auth_sessions_user` | `auth_sessions` | `user_id` | Validate and revoke a user's sessions |
| `idx_stations_city` | `stations` | `city` | City filter |
| `idx_stations_geo` | `stations` | `latitude, longitude` | Geographic lookups and "near me" |
| `idx_stations_operator` | `stations` | `operator` | Operator filter |
| `idx_connectors_station` | `connectors` | `station_id` | Detail page and booking validation |
| `idx_reviews_station` | `reviews` | `station_id` | Review list and rating aggregation |
| `idx_vehicles_user` | `vehicles` | `user_id` | Profile vehicle list |
| `idx_bookings_user_start` | `bookings` | `user_id, start_time` | "My bookings" list and history |
| `idx_bookings_station_start` | `bookings` | `station_id, start_time` | Overlap detection |
| `idx_sessions_user_started` | `charging_sessions` | `user_id, started_at` | Session history and analytics |
| `idx_wallet_tx_user` | `wallet_transactions` | `user_id, created_at` | Ledger pagination |

Plus the primary keys above, `users.email` (UNIQUE), `wallets.user_id` (UNIQUE) and
`reviews(station_id, user_id)` (UNIQUE) which enforce the one-review-per-user rule.

## Integrity and business rules expressed in the schema

| Rule | Mechanism |
| --- | --- |
| Deleting a user removes their sessions, reset tokens, vehicles, favourites, reviews, bookings, sessions, wallet and ledger | `ON DELETE CASCADE` on every `user_id` reference |
| Deleting a booking keeps the charging record | `charging_sessions.booking_id … ON DELETE SET NULL` (+ nullable column) |
| A user has exactly one wallet | `wallets.user_id … UNIQUE` and `users ||--|| wallets` |
| One review per user per station | `UNIQUE (station_id, user_id)` |
| Rating is meaningful | `CHECK (rating BETWEEN 1 AND 5)` |
| Money is exact | Integer minor units (`balance_minor`, `amount_minor`, `balance_after_minor`) |
| Re-running the server is safe | Ordered migrations recorded in `schema_migrations` |

## Demo versus live data

| Column | Meaning |
| --- | --- |
| `stations.data_source` | `'sample'` for everything shipped today. `'open-charge-map'` / `'operator'` are reserved for FE-2. |
| `stations.last_synced_at` | `NULL` for bundled sample data; the UI renders "This is bundled sample data… Availability is not live." |
| `bookings.simulated` | `1` for every booking the API creates. |
| `charging_sessions.simulated`, `operator_confirmed` | `1` / `0` — no real hardware or operator is involved. |
| `wallets.simulated`, `wallet_transactions.simulated` | `1` — the ledger is a demonstration; no payment provider is wired up. |

## Seeded data (`npm run seed`)

* 14 sample stations with connectors, amenities, opening hours and prices
  (`backend/src/seed-data.js`), spread across the San Francisco Bay Area and Austin.
* Demo account `demo@afterglow.test` / `Demo1234!` with one vehicle
  (2023 Demo Volt EV, 68 kWh, CCS + J1772, 410-range) and a simulated opening
  balance of **$50.00** (`startingBalanceMinor = 5000`).
* The seeder is idempotent: it upserts by id, so running it twice does not create
  duplicates.
