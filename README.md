# Amaar Shop

A lightweight Shopify-style platform for small Bangladeshi businesses who currently sell on Facebook. Each seller gets their own storefront at `/s/{slug}` which they paste into their Facebook page's "Shop Now" button.

## Stack

- **Backend:** Go (chi router, sqlx, JWT, PostgreSQL 16)
- **Frontend:** Next.js 14 (App Router) + TypeScript (Tailwind, TanStack Query)
- **Infrastructure:** Docker Compose

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env

# 2. Start everything
make up

# 3. Run migrations (once DB is healthy)
make migrate-up
```

Services:

| Service   | URL                    |
|-----------|------------------------|
| Frontend  | http://localhost:3000  |
| Backend   | http://localhost:8080  |
| Adminer   | http://localhost:8081  |
| Health    | http://localhost:8080/health |

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make logs` | Tail all service logs |
| `make migrate-up` | Run pending migrations |
| `make migrate-down` | Roll back last migration |
| `make migrate-create name=...` | Create new migration files |
| `make seed` | Load demo data |
| `make test` | Run backend tests |
| `make build-prod` | Build production images |

## Project Structure

```
backend/
├── cmd/api/main.go          # Entry point
├── internal/
│   ├── config/              # Env config loader
│   ├── domain/              # Business entities (zero external imports)
│   ├── handler/{http,dto}/  # HTTP handlers + request/response DTOs
│   ├── service/             # Business logic
│   ├── repository/{postgres}/ # Data access interfaces + implementations
│   ├── storage/{local}/     # File storage
│   ├── auth/                # JWT + bcrypt helpers
│   └── platform/{database,logger}/ # Infrastructure
├── migrations/              # SQL migrations (golang-migrate)
└── scripts/                 # Seed scripts

frontend/
├── src/
│   ├── app/                 # Next.js App Router pages (storefront, dashboard, marketplace)
│   ├── components/          # Shared UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # API client, i18n, formatters
│   └── locales/             # en.json, bn.json
└── public/
```
