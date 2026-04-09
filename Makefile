.PHONY: up down logs migrate-up migrate-down migrate-create seed test build-prod

# Development
up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

# Database migrations
migrate-up:
	docker compose run --rm migrate

migrate-down:
	docker compose run --rm migrate -path /migrations -database "postgres://$${POSTGRES_USER:-amaarshop}:$${POSTGRES_PASSWORD:-amaarshop_secret}@postgres:5432/$${POSTGRES_DB:-amaarshop}?sslmode=disable" down 1

migrate-create:
	@if [ -z "$(name)" ]; then echo "Usage: make migrate-create name=create_users"; exit 1; fi
	@mkdir -p backend/migrations
	@touch backend/migrations/$$(printf "%06d" $$(($$(ls backend/migrations/*.up.sql 2>/dev/null | wc -l) + 1)))_$(name).up.sql
	@touch backend/migrations/$$(printf "%06d" $$(($$(ls backend/migrations/*.down.sql 2>/dev/null | wc -l) + 1)))_$(name).down.sql
	@echo "Created migration files for $(name)"

# Seed data
seed:
	docker compose exec postgres psql -U $${POSTGRES_USER:-amaarshop} -d $${POSTGRES_DB:-amaarshop} -f /dev/stdin < backend/scripts/seed.sql

# Testing
test:
	cd backend && go test ./...

# Production
build-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build
