.PHONY: build run test

build:
	go build -o tmp/api ./cmd/api

run:
	@set -a && . ../.env && set +a && go run ./cmd/api

test:
	go test ./...
