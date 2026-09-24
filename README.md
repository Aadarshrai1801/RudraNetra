# 🚀 RudraNetra (NextGen Telematics & Fleet Intelligence)

High-performance, modern rewrite of legacy ASP.NET / WinForms telematics platform into **Go + React + PostgreSQL/TimescaleDB/PostGIS**.

---

## 🏛️ Architecture Overview

```
                      ┌──────────────────────┐
                      │  Teltonika GPS       │
                      │  Devices (FMB920)    │
                      └──────────┬───────────┘
                                 │ TCP :5040
                                 ▼
                     ┌────────────────────────┐
                     │   rudra-ingest (Go)    │
                     │   Teltonika Codec 8    │
                     └──────────┬─────────────┘
                                │ NATS JetStream
                                ▼
  ┌────────────────────────────────────────────────────────┐
  │                    rudra-api (Go)                      │
  │  REST API (:8080)   •   WebSocket Hub (/ws/tracking)   │
  │  JWT Auth           •   PostGIS Spatial Query Engine   │
  └──────────┬─────────────────────────────┬───────────────┘
             │                             │
             ▼                             ▼
  ┌─────────────────────┐       ┌──────────────────────────┐
  │  PostgreSQL 16      │       │  Redis 7                 │
  │  + PostGIS 3.4      │       │  Live Position Cache     │
  │  + TimescaleDB      │       │  Sub-millisecond reads   │
  └─────────────────────┘       └──────────────────────────┘
             ▲                             ▲
             │                             │
  ┌──────────┴─────────────────────────────┴───────────────┐
  │                   React 19 Frontend                    │
  │  • Client Portal (:3000) - MapLibre GL live tracking  │
  │  • Admin Portal (:3001) - Multi-tenant management     │
  └────────────────────────────────────────────────────────┘
```

---

## 📦 Project Layout

- `backend/` — Go monorepo
  - `cmd/rudra-ingest/`: TCP server accepting Teltonika AVL packets on port 5040.
  - `cmd/rudra-api/`: High-speed Gin REST API and real-time WebSocket hub.
  - `cmd/rudra-worker/`: Background worker for scheduled reports and alert dispatch.
  - `internal/codec/`: Byte-accurate Teltonika Codec 8 binary protocol parser.
  - `internal/domain/`: Core business entities (positions, devices, vehicles, geofences, alerts).
  - `internal/repository/`: TimescaleDB hypertables, PostGIS polygon checks, Redis caching.
  - `internal/websocket/`: Concurrent broadcast hub with tenant-level routing.
  - `migrations/`: Versioned SQL migrations for PostgreSQL + PostGIS + TimescaleDB.
- `frontend/` — React 19 + TypeScript + Vite monorepo (pnpm workspace)
  - `apps/client/`: Live tracking dashboard with MapLibre GL vector maps and real-time telemetry drawer.
  - `apps/admin/`: Multi-tenant organization and device provisioning portal.
  - `packages/ui/`: Shared UI component primitives.
- `infra/` — Docker Compose & Nginx configuration
  - `docker-compose.yml`: Spins up TimescaleDB, PostGIS, Redis, NATS, and all Go microservices.
  - `nginx/nginx.conf`: Production reverse proxy routing API, WebSockets, and static assets.

---

## ⚡ Quick Start

### 1. Start Infrastructure (PostgreSQL + TimescaleDB + Redis + NATS)
```bash
cd rudra-netra/infra
docker compose up -d postgres redis nats
```

### 2. Run Backend Services (Go)
```bash
cd ../backend

# Run API & WebSocket server
go run ./cmd/rudra-api

# Run GPS TCP Ingest server
go run ./cmd/rudra-ingest

# Run Background Worker
go run ./cmd/rudra-worker
```

### 3. Run Frontend
```bash
cd ../frontend

# Install dependencies
pnpm install

# Start Client Live Tracking Dashboard (http://localhost:3000)
pnpm dev:client

# Start Admin Management Portal (http://localhost:3001)
pnpm dev:admin
```

---

## 🧪 Testing the Teltonika Codec
```bash
cd backend
go test -v ./internal/codec
```
