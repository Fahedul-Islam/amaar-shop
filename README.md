# Amaar Shop

> A multi-tenant commerce platform for Bangladeshi social-media sellers — replacing
> comment-thread ordering with a real storefront, a cash-on-delivery order pipeline,
> automated courier booking, and the profit numbers Facebook ads are actually judged on.

Each seller gets a hosted storefront at `/s/{slug}` to drop into their Facebook page's
**Shop Now** button. Built for the realities of the market it serves: cash on delivery,
parcel refusals, Bangla-first buyers, and ad budgets spent on Facebook and TikTok.

---

## Why it exists

A typical Bangladeshi Facebook seller takes orders in comments and DMs, tracks them in a
notebook, hands parcels to a courier, and has no idea whether their ads make money. This
platform closes that loop:

| Problem | What the platform does |
| ------- | ---------------------- |
| Orders lost in comment threads | Real storefront, catalog and checkout |
| Parcels handed over blind | One-click **Steadfast** booking with tracking |
| ~25% of COD orders refused | Delivery-outcome tracking; only delivered orders count as revenue |
| "Am I making money?" | Cost price + ad spend → net profit, ROAS, break-even ROAS, CAC |
| Facebook ads optimise for the wrong people | **Conversions API** reports *deliveries*, not just orders |

---

## Stack

| Layer | Technology |
| ----- | ---------- |
| Backend | **Go 1.25** — `net/http`, `database/sql`, `golang-jwt`, `gofpdf` |
| Database | **PostgreSQL 16** — full-text search, triggers, `golang-migrate` |
| Frontend | **Next.js 14** (App Router) · TypeScript · TanStack Query · Tailwind |
| Infra | Docker Compose (dev + prod), Adminer |

Deliberately minimal dependencies: **five direct Go modules**, no router framework, no ORM.

---

## At a glance

| | |
| --- | --- |
| Go source | ~21,000 lines (+2,800 lines of tests) |
| SQL migrations | 22 |
| Domain entities | 21 |
| Services | 20 |
| HTTP routes | 125 |
| Frontend pages | 39 |

---

## Features

### Storefront & checkout
Slug-based storefront, product catalog with images and variants, cart **reservations**
that hold stock during checkout, COD and advance-payment flows (bKash/Nagad proof upload),
buyer order lookup and self-service edits, reviews with seller replies, PDF invoices,
EN/BN localisation.

### Seller dashboard
Action-oriented home ("today's tasks"), order pipeline, product and category management,
customer CRM with segments and lifetime value, analytics with visit tracking and
conversion rates, billing.

### Courier — Steadfast
Per-shop API credentials. **Book courier** creates the consignment and writes the tracking
code back onto the order; buyers see live tracking on their lookup page. Manual entry
remains for the other couriers (Pathao, RedX, Paperfly, …).

### Unit economics
Product **cost price** (snapshotted onto each order line, so later edits never rewrite past
profit) plus daily **ad spend** → net profit, gross margin, ROAS, **break-even ROAS**, cost
per order, CAC per *delivered* order, and delivery success rate.

> Revenue counts **delivered orders only**. Under cash on delivery a pending order isn't
> income and a returned one never will be. Booked revenue is reported separately as
> "still in flight".

Sellers with a steady budget set it once (`৳500/day`) and a background job fills each day's
spend automatically, flagged as an estimate until confirmed.

### Meta Conversions API
Server-side conversion tracking. Reports `Purchase` on checkout and **`OrderDelivered`
when the parcel is actually accepted** — teaching Meta to find buyers who take delivery
rather than ones who refuse at the door. Customer identifiers are SHA-256 hashed; events go
through a durable outbox so Meta can never delay or fail a checkout.
See [`docs/META_TRACKING_SETUP.md`](docs/META_TRACKING_SETUP.md).

### Admin console
Shops, users, orders, products, analytics, financials, team roles, abuse reports, billing
approvals.

---

## Architecture

```
backend/
├── cmd/api/                  Bootstrap + graceful shutdown
└── internal/
    ├── app/                  Composition root (all wiring lives here)
    ├── config/               Env-driven configuration
    ├── domain/               21 entities + sentinel errors — zero external imports
    ├── repository/           Interfaces
    │   └── postgres/         SQL implementations
    ├── service/              Business logic + background workers
    ├── handler/
    │   ├── http/             20 per-feature route groups + middleware
    │   ├── dto/              Request/response shapes and mappers
    │   └── httputil/         Error mapping, shared request helpers
    ├── courier/              Steadfast client
    ├── meta/                 Conversions API client
    ├── auth/                 JWT + bcrypt
    ├── pdf/                  Invoice rendering
    ├── storage/local/        File uploads
    └── platform/             Database, logger
```

Dependencies point inward: `domain → repository → service → handler`, with an interface at
every seam. The error mapper lives in `httputil/` (not `http/`) to avoid an import cycle
with middleware.

### Background workers

| Worker | Interval | Purpose |
| ------ | -------- | ------- |
| Visit worker | continuous | Batches product-view events off a buffered channel |
| Visit aggregator | daily 00:30 UTC | Rolls raw visits into daily summaries |
| Reservation sweeper | 1 min | Expires stock holds and restores inventory |
| Ad-spend filler | 1 hour | Materialises daily spend from recurring budgets |
| Meta dispatcher | 30 sec | Delivers queued conversions with retry |

All are idempotent and self-healing after downtime.

### Notable engineering

| Area | What it does |
| ---- | ------------ |
| Cart reservations | Atomic stock holds during checkout; a sweeper reclaims expired ones |
| Multi-tenant isolation | Shop scoping enforced at the repository layer — sellers cannot read each other's data |
| Outbox pattern | Conversions are persisted then dispatched, so a third-party outage never touches the request path |
| Price/cost snapshots | Order lines freeze name, price and supplier cost at purchase time |
| Full-text search | Postgres `tsvector` columns maintained by triggers |
| Error mapping | Domain errors → HTTP status codes in one isolated package |
| Rate limiting | Token-bucket middleware on auth endpoints |

### Bangladesh timezone rule

Every seller-facing date boundary is computed in **Bangladesh time (UTC+6)** via
`domain.BDLocation` and `httputil.ParseDateRange`, never in UTC. Between midnight and 6am
in Dhaka a UTC "today" still points at yesterday — which silently hid a seller's freshly
logged ad spend before this was fixed. In SQL, `DATE` columns are compared against date
*strings* and timestamps against explicit instants so no implicit conversion can creep in.

---

## Quick start

```bash
cp .env.example .env
make up              # Postgres, backend, frontend, Adminer
make seed            # optional demo data
```

Migrations run automatically on backend startup.

| Service | URL |
| ------- | --- |
| Frontend | http://localhost:3000 |
| API | http://localhost:8080 |
| Health | http://localhost:8080/health |
| Adminer | http://localhost:8081 |

### Make targets

`up` · `down` · `logs` · `migrate-up` · `migrate-down` · `migrate-create name=...` · `seed` · `test` · `build-prod`

### Environment

Required: `DATABASE_URL`, `JWT_SECRET`.
Optional: `PORT`, `ENV`, `UPLOAD_DIR`, `CORS_ALLOWED_ORIGINS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`STEADFAST_BASE_URL`, `META_GRAPH_BASE_URL` (the last two override third-party endpoints for
testing; leave unset in production).

Third-party credentials are **per shop**, entered by each seller in Settings — there are no
platform-wide Steadfast or Meta keys.

---

## Tests

```bash
make test          # or: cd backend && go test ./...
```

Table-driven unit tests over interface mocks cover the service layer and both third-party
clients — order state machine, profit and ROAS formulas, courier booking, Conversions API
hashing (including a check that no raw customer data reaches the payload), and retry
classification.

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit   # type-check
```

---

## Docs

- [`docs/API.md`](docs/API.md) — endpoint reference
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — database schema
- [`docs/META_TRACKING_SETUP.md`](docs/META_TRACKING_SETUP.md) — seller guide for Facebook ad tracking
- [`docs/API_MANUAL_CHECKLIST.md`](docs/API_MANUAL_CHECKLIST.md) — manual QA checklist

---

## Status

Actively developed. Built solo as a portfolio project demonstrating production-shape Go
backend design — clean architecture, testable seams, minimal dependencies — with a
pragmatic Next.js frontend on top.

**Known gaps:** no browser pixel yet (server-side conversions only); ad spend is
seller-declared rather than imported from Meta's Insights API (that needs App Review);
courier auto-booking is Steadfast-only.
