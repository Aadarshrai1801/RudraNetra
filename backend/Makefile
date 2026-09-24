.PHONY: all build test clean run-api run-ingest run-worker docker-up docker-down

all: build

build:
	@echo "Building all binaries..."
	go build -o bin/rudra-api ./cmd/rudra-api
	go build -o bin/rudra-ingest ./cmd/rudra-ingest
	go build -o bin/rudra-worker ./cmd/rudra-worker

test:
	@echo "Running tests..."
	go test -v ./...

clean:
	@echo "Cleaning up binaries..."
	rm -rf bin/

run-api:
	go run ./cmd/rudra-api

run-ingest:
	go run ./cmd/rudra-ingest

run-worker:
	go run ./cmd/rudra-worker

docker-up:
	docker compose -f ../infra/docker-compose.yml up -d

docker-down:
	docker compose -f ../infra/docker-compose.yml down

migrate-up:
	docker exec -i rudra-postgres psql -U rudra -d rudra_netra < migrations/000001_init_schema.up.sql
