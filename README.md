# Amaar Shop

> A multi-tenant e-commerce platform that gives small Bangladeshi Facebook sellers a real storefront — replacing comment-thread ordering with a proper catalog, checkout, and order pipeline.

Each seller gets a hosted storefront at `/s/{slug}` to drop into their Facebook page's **Shop Now** button. Built MVP-first: cash-on-delivery, Bangladesh-only, optimised for shops under 100 SKUs.

---

## Highlights

- **Stdlib-first Go backend** — Go 1.25 with `net/http` (no chi), `database/sql` with `lib/pq` (no ORM). Deliberately minimal dependencies.
- **Clean layered architecture** — `domain → repository → service → handler` with interfaces at every seam. Service layer is fully unit-tested with table-driven tests.
- **17 SQL migrations** managed via `golang-migrate`, including Postgres full-text search vectors and trigger-maintained denormalisations.
- **Cart-reservation system** — short-lived stock holds during checkout with a background sweeper goroutine that reclaims expired reservations.
- **PDF invoice generation** server-side via `gofpdf`.
- **JWT auth + bcrypt** with role-based middleware (customer / seller / admin) and per-route rate limiting.
- **Graceful shutdown**, liveness (`/health`) and readiness (`/ready`) probes, Docker multi-stage builds.

---

## Stack

| Layer       | Technology                                                       |
| ----------- | ---------------------------------------------------------------- |
| Backend     | **Go 1.25**, `net/http`, `database/sql`, `golang-jwt`, `gofpdf` |
| Database    | **PostgreSQL 16** (FTS, triggers, golang-migrate)                |
| Frontend    | Next.js 14 (App Router) · TypeScript · TanStack Query · Tailwind |
| Infra       | Docker Compose (dev + prod), Adminer                             |

---

## Backend Architecture

```
backend/
├── cmd/api/                 Bootstrap + graceful shutdown
└── internal/
    ├── app/                 Dependency wiring (composition root)
    ├── config/              Env-driven config loader
    ├── domain/              19 entities — zero external imports
    ├── repository/postgres/ Concrete SQL implementations
    ├── service/             Business logic + unit tests
    ├── handler/
    │   ├── http/            Per-feature route groups + middleware
    │   ├── dto/             Request/response shapes
    │   └── httputil/        Error mapping (lives here to avoid cycles)
    ├── auth/                JWT + bcrypt
    ├── pdf/                 Invoice rendering
    ├── storage/local/       File uploads
    └── platform/            database, logger
```

**Domain modules:** users · shops · categories · products (with variants & images) · orders · reviews · customer notes · delivery zones · payment methods · cart reservations · billing · analytics · admin · seller reports

---

## Notable Backend Work

| Area                  | What it does                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Cart reservations     | Atomic stock holds during checkout; background goroutine sweeps expired holds back to inventory.          |
| Full-text search      | Postgres `tsvector` columns with trigger-maintained indices for product search.                           |
| Multi-tenant routing  | Slug-based shop isolation enforced at the repository layer — sellers cannot read each other's orders.     |
| Rate limiting         | Token-bucket middleware applied to auth endpoints to blunt credential-stuffing.                           |
| Error mapping         | Domain errors translated to HTTP status codes in a single isolated package, no cross-layer leakage.       |
| Invoice PDFs          | Server-rendered PDF receipts streamed straight from the order handler.                                    |

---

## Quick Start

```bash
cp .env.example .env
make up              # boots Postgres, backend, frontend, adminer
make migrate-up      # apply migrations
make seed            # optional: demo data
```

| Service  | URL                          |
| -------- | ---------------------------- |
| Frontend | http://localhost:3000        |
| API      | http://localhost:8080        |
| Health   | http://localhost:8080/health |
| Adminer  | http://localhost:8081        |

### Make targets

`up` · `down` · `logs` · `migrate-up` · `migrate-down` · `migrate-create name=...` · `seed` · `test` · `build-prod`

---

## Tests

```bash
make test
```

Service layer is covered by table-driven unit tests using interface mocks of the repository layer — see `internal/service/*_test.go`.

---

## Docs

- [`docs/API.md`](docs/API.md) — full endpoint reference (~1.5k lines)
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — database schema
- [`docs/API_MANUAL_CHECKLIST.md`](docs/API_MANUAL_CHECKLIST.md) — manual QA checklist

---

## Status

MVP — actively developed. Built solo as a portfolio project demonstrating production-shape Go backend design (clean architecture, testable seams, minimal dependencies) with a thin pragmatic Next.js frontend on top.
