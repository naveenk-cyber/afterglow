# Afterglow — CASE Documentation

Software-engineering artefacts for the Afterglow EV charging-station finder.
Everything in this folder describes the code that is actually in this repository:
every endpoint, table, screen and test named below exists in the tree today.

> **Source of truth.** The diagrams are written in [Mermaid](https://mermaid.js.org/)
> so they live next to the code and stay reviewable in a diff. Where a diagram and
> the code disagree, the code wins — and the diagram should be fixed.

## Documents

| # | Document | Covers |
| --- | --- | --- |
| 01 | [System Requirements](01-system-requirements.md) | Scope, actors, functional (FR-xx) and non-functional (NFR-xx) requirements, constraints, assumptions |
| 02 | [Use Case Diagram & Catalogue](02-use-case-diagram.md) | Actors, use-case diagram, UC-01…UC-18 with pre/post-conditions |
| 03 | [Class Diagram](03-class-diagram.md) | Domain entities, frontend view models, service layer |
| 04 | [Sequence Diagrams](04-sequence-diagrams.md) | Sign-up, sign-in/session restore, search, booking, charging + wallet, review |
| 05 | [Activity Diagrams](05-activity-diagrams.md) | Booking activity, password reset, search/filter activity |
| 06 | [ER Diagram & Data Dictionary](06-er-diagram.md) | The 12 SQLite tables, keys, indexes, integrity rules |
| 07 | [Architecture](07-architecture.md) | Layered architecture, component and deployment views, tech stack, module map |
| 08 | [API Reference](08-api-reference.md) | All 34 routes (32 under `/api/v1` + 2 health), auth, validation, errors |
| 09 | [Test Cases & Traceability](09-test-cases.md) | Automated and manual test cases with real results, FR → test → code matrix |

## How to reproduce the evidence

```bash
# Backend (Node ≥ 22.5, uses node:sqlite)
cd backend
npm install
npm run seed      # sample stations + demo account
npm test          # 33 tests — API contract, auth, booking, wallet, analytics

# Frontend (React 19 + Vite)
cd ../frontend
npm install
npm test          # 76 tests in 9 files — Vitest + Testing Library
npm run lint      # 0 errors
npm run type-check
npm run build
```

Then start both processes (`npm run dev` in each) and open <http://localhost:5173>.

## Documentation conventions

* **FR-xx / NFR-xx** — requirement identifiers, traceable to tests in document 09.
* **UC-xx** — use cases; every use case names the route or handler that implements it.
* **Demo-data labels** — features backed by sample or simulated data are marked
  `[DEMO]`. They must never be presented as real-world availability or payment.
* **Deferred work** — items deliberately out of scope are listed under *Future
  Enhancements* in document 01 and are never described as implemented.
