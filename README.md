<p align="center">
  <img src="docs/assets/RudraNetraLogo.png" alt="RudraNetra Logo" width="280" />
</p>

<h1 align="center">RudraNetra</h1>

<p align="center">
  <strong>Real-Time Enterprise Telematics, GPS Ingestion Engine & Spatial Fleet Intelligence</strong>
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#%EF%B8%8F-system-architecture">Architecture</a> •
  <a href="#-core-capabilities">Capabilities</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-automated-testing">Testing</a> •
  <a href="#-project-layout">Layout</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.23-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go 1.23" />
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/TimescaleDB-Hypertables-FDB515?style=for-the-badge&logo=timescale&logoColor=black" alt="TimescaleDB" />
  <img src="https://img.shields.io/badge/PostGIS-3.4_Spatial-336791?style=for-the-badge&logo=postgis&logoColor=white" alt="PostGIS" />
  <img src="https://img.shields.io/badge/NATS-JetStream-27AAE1?style=for-the-badge&logo=natsdotio&logoColor=white" alt="NATS JetStream" />
  <img src="https://img.shields.io/badge/Redis-7_Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis 7" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

<p align="center">
  <img src="assets/screenshots/vehicle.png" alt="RudraNetra Real-Time Telematics & Fleet Tracking Map" width="100%" />
</p>

---

## 📖 Overview

**RudraNetra** is a cloud-native, event-driven enterprise telematics and spatial fleet intelligence platform designed to ingest hundreds of thousands of concurrent GPS telemetry pings per second with sub-second latency.

- **High-Concurrency Ingestion**: Zero-allocation Go TCP server parsing Teltonika Codec 8 and Codec 8 Extended AVL protocol frames.
- **Spatio-Temporal Time-Series**: TimescaleDB hypertables partitioned by time and vehicle for instant analytical queries across millions of coordinate records.
- **PostGIS Spatial Boundary Engine**: Spatial indexing (`ST_Contains`, `ST_DWithin`, `ST_MakeLine`) for instant geofence entry/exit detection and proximity calculations.
- **Decoupled Event Streaming**: NATS JetStream message bus streaming live AVL events to WebSocket consumers and background alert workers.
- **Modern User Experience**: A reactive, dark-mode glassmorphic client application built with React 19, TypeScript, and MapLibre GL vector maps.

---

## 📸 Screenshots

### Real-Time Fleet Telematics Map (`vehicle.png`)
*Live vector map tracking 312 fleet vehicles across Dubai & UAE with real-time status filtering (Moving, Stopped, Idle, Freezer), live speeds, cold-chain temperatures, anti-theft freeze, and nearest vehicle routing.*

<p align="center">
  <img src="assets/screenshots/vehicle.png" alt="RudraNetra Real-Time Telematics & Fleet Tracking Map" width="100%" />
</p>

---

### Teltonika Telematics & 1-Minute Live Data Logs Window (`teltonika.png`)
*Opened via the "More" action on any vehicle card. Displays all Teltonika configurable parameters (speed, 1-wire/BLE reefer temperatures, fuel level %, battery voltages, ignition DIN1, door DIN2, immobilizer DOUT1, relays) and a 60-interval minute-by-minute live telemetry log table with 15m/30m/60m time slicing and instant CSV export.*

<p align="center">
  <img src="assets/screenshots/teltonika.png" alt="Teltonika Device Telematics and 1-Minute Live Data Logs Modal" width="100%" />
</p>

---

### Executive Fleet Overview Dashboard (`dashboard.png`)
*Real-time operational KPI rollup: vehicles in motion, idle fuel waste estimations, parked depot units, priority fleet attention alerts, and instant route dispatch.*

<p align="center">
  <img src="assets/screenshots/dashboard.png" alt="RudraNetra Executive Fleet Dashboard and Operational KPIs" width="100%" />
</p>

---

### Trip History & Route Playback (`playback.png`)
*Full historical route playback with 1x–5x speed controls, distance metrics, top speed profile, and timeline step scrubbing.*

<p align="center">
  <img src="assets/screenshots/playback.png" alt="Historical GPS Route Playback and Timeline Scrubbing Interface" width="100%" />
</p>

---

### Spatial Intelligence & Fleet Logistics

| PostGIS Polygon Geofences (`geofences.png`) | Trip Operations & Gate Passes (`fleet.png`) |
| :---: | :---: |
| <img src="assets/screenshots/geofences.png" alt="PostGIS Spatial Boundary Polygon Geofences" width="100%" /> | <img src="assets/screenshots/fleet.png" alt="Trip Operations, Gate Passes, and Loading Receipts" width="100%" /> |
| *Spatial boundary polygon zones with automated enter/exit events and live containment testing.* | *Dual-driver trip dispatching, gate pass lifecycle tracking, loading receipts (LR), and tyre wear management.* |

---

### Incident Alerts & Comprehensive Telematics Reports

| Real-Time Incident Rules (`alerts.png`) | Telematics Reports & Mileage Ledger (`reports.png`) |
| :---: | :---: |
| <img src="assets/screenshots/alerts.png" alt="Real-Time Incident Rules and Telemetry Alert Configuration" width="100%" /> | <img src="assets/screenshots/reports.png" alt="Comprehensive Distance Telemetry and Fuel Audit Ledger" width="100%" /> |
| *Multi-tier telemetry alert automation: overspeed, excessive idling, cold-chain temperature breaches, and power cuts.* | *12 comprehensive reporting modules including daily distance summary, 31-day matrix, stoppage times, and fuel consumption.* |

---

### Hardware Provisioning & SuperAdmin Platform

| GPS Hardware Tracker Registry (`devices.png`) | SuperAdmin Multi-Tenant Operations Console (`admin.png`) |
| :---: | :---: |
| <img src="assets/screenshots/devices.png" alt="GPS Hardware Tracker Provisioning and Device Registry" width="100%" /> | <img src="assets/screenshots/admin.png" alt="SuperAdmin Multi-Tenant Organization and Shard Registry" width="100%" /> |
| *Teltonika AVL tracker provisioning, device status monitoring, and hardware allocations.* | *Multi-tenant organization routing, subscription validity extensions, SIRA UAE compliance relays, and billing ledger.* |

---

### System Configuration & Authenticated Portal

| System & Telematics Configuration (`settings.png`) | Authenticated Dispatch Portal (`login.png`) |
| :---: | :---: |
| <img src="assets/screenshots/settings.png" alt="System Telematics Configuration and Threshold Settings" width="100%" /> | <img src="assets/screenshots/login.png" alt="Secure Authenticated Dispatch Portal Login Screen" width="100%" /> |
| *Multi-tenant profile tuning, TCP :5040 ingestion configuration, and idle thresholds.* | *Role-based JWT authentication portal for dispatchers and fleet administrators with tenant isolation.* |

---

## 🏛️ System Architecture

<p align="center">
  <img src="docs/assets/system_architecture.png" alt="RudraNetra Distributed Real-time Telematics Architecture" width="100%" />
</p>

### Distributed Component Topology

1. **Ingestion Tier (`rudra-ingest` on TCP `:5040`)**:
   - Zero-allocation Go TCP server parsing Teltonika Codec 8 / Codec 8 Extended AVL binary packets.
   - Computes CRC16 validation, decodes variable-length IO elements (ignition, analog fuel, temperature, battery), and returns immediate binary record-count acknowledgements to IoT modems.

2. **Event Streaming Bus (NATS JetStream 2.10)**:
   - High-throughput message broker streaming decoded AVL records on subject `telemetry.positions`.
   - Decouples continuous device ingestion from database write amplification and alert processing.

3. **API & Real-Time Gateway (`rudra-api` on HTTP `:8080`)**:
   - High-performance Gin web service managing multi-tenant JWT authorization, REST query endpoints, and spatial queries.
   - Live WebSocket broadcast hub (`/ws/tracking`) delivering sub-200ms position updates directly to dispatch operators.

4. **Persistence & Spatial Storage Tier**:
   - **TimescaleDB Hypertables (PostgreSQL 16)**: Time-series hypertables partitioned into 7-day chunks with automated compression for sub-second range queries across tens of millions of coordinates.
   - **PostGIS 3.4**: Spatial indexing (`GIST`) evaluating polygon geofence containment (`ST_Contains`) and proximity triggers on every AVL ping.
   - **Redis 7 Live Cache**: Sub-millisecond in-memory cache maintaining the latest vehicle coordinate, speed, ignition, and heading vector.

5. **Operations Consoles (React 19 + TypeScript)**:
   - **Client Operations Console (`:3000`)**: Full-bleed MapLibre GL vector tracking, interactive route playback, geofence polygon testing, and automated dispatch management.
   - **SuperAdmin Console (`:3001`)**: Multi-tenant registry, hardware quota management, SIRA UAE compliance relays, and database shard routing.

---

## ⚙️ Core Capabilities

| Feature | Legacy System (`vave.uae`) | RudraNetra Architecture |
| :--- | :--- | :--- |
| **Ingestion Engine** | C# .NET Socket Single Listener | High-throughput Go TCP listener with CRC16 validation & zero-alloc frame parsing |
| **Telemetry Storage** | Single MSSQL `DeviceLogs` table | TimescaleDB Hypertables partitioned into 7-day chunks with automated compression |
| **Spatial Checks** | In-memory point bounding checks | PostGIS 3.4 Spatial Indices (`ST_Contains`, `ST_DWithin`, `GIST`) |
| **Real-time Map** | Polling HTTP AJAX every 10s | Event-driven WebSockets with sub-200ms latency |
| **Frontend Framework** | ASP.NET WebForms + Server Controls | React 19 + TypeScript + Vite monorepo with MapLibre GL vector tiles |
| **Tenancy Model** | Separate MSSQL databases switched via cookie | Row-level tenant isolation (`company_id`) with JWT context validation |

---

## 🛠️ Tech Stack

- **Backend**: Go 1.23, Gin Web Framework, Viper, `jackc/pgx/v5`
- **Database**: PostgreSQL 16 + PostGIS 3.4 + TimescaleDB (Hypertables)
- **Caching & Pub/Sub**: Redis 7, NATS JetStream 2.10
- **Frontend**: React 19, TypeScript, Vite, MapLibre GL, Zustand, Lucide React
- **DevOps & Containers**: Docker Compose, Nginx, Multi-stage Go & Node Dockerfiles

---

## ⚡ Quick Start

### 1. Launch Core Infrastructure
```bash
cd infra
docker compose up -d postgres redis nats
```

### 2. Apply Schema & Seed Dataset
```bash
# 1. Initialize schema, PostGIS extensions, and TimescaleDB hypertables
Get-Content backend\migrations\000001_init_schema.up.sql | docker exec -i rudra-postgres psql -U rudra -d rudra_netra

# 2. Seed initial multi-tenant accounts, 312 vehicles, and geofence polygons
Get-Content backend\scripts\seed.sql | docker exec -i rudra-postgres psql -U rudra -d rudra_netra
```

### 3. Run Backend Services (Go)
```bash
cd backend

# Terminal 1: GPS Ingestion Engine (TCP :5040)
go run ./cmd/rudra-ingest

# Terminal 2: REST API & Real-time WebSocket Hub (HTTP :8080)
go run ./cmd/rudra-api

# Terminal 3: Background Worker (Alerts & Reports)
go run ./cmd/rudra-worker
```

### 4. Run Frontend Applications (pnpm)
```bash
cd frontend
pnpm install

# Start Client Fleet Portal (http://localhost:3000)
pnpm dev:client

# Start Admin Management Portal (http://localhost:3001)
pnpm dev:admin
```

---

## 🧪 Automated Testing

### 1. Run Complete 53-Endpoint Integration Test Suite
Executes end-to-end integration tests across all modules (Auth, 312 Fleet Vehicles, Teltonika 1-minute logs, Geofences, POIs, Trips, Commands, Alerts, Reports, and Admin Management):

```bash
cd frontend
pnpm test

# or run directly:
node ./tests/run_all_test_cases.mjs
```

### 2. Run Backend Unit Tests (Go)
Tests the Teltonika Codec 8 binary frame parser, domain models, and geofence math:

```bash
cd backend
go test -v ./...
```

---

## 📁 Project Layout

```text
RudraNetra/
├── backend/
│   ├── cmd/
│   │   ├── rudra-api/          # REST API & WebSocket gateway (:8080)
│   │   ├── rudra-ingest/       # High-throughput TCP AVL listener (:5040)
│   │   └── rudra-worker/       # Background geofence worker & scheduled reports
│   ├── internal/
│   │   ├── codec/              # Teltonika Codec 8 / 8 Extended binary parser
│   │   ├── config/             # Viper centralized configuration
│   │   ├── domain/             # Position, Vehicle, Geofence, Device models
│   │   ├── handler/            # Gin HTTP & WebSocket route controllers
│   │   ├── repository/         # TimescaleDB & PostGIS spatial repositories
│   │   ├── service/            # Tracking, Geofence evaluation, Auth services
│   │   └── websocket/          # Real-time WebSocket client connection hub
│   ├── migrations/             # Versioned SQL migrations (PostGIS + Timescale)
│   └── scripts/                # Database seed data scripts
├── frontend/
│   ├── apps/
│   │   ├── client/             # Live tracking, playback, geofence fleet app (:3000)
│   │   └── admin/              # Multi-tenant company provisioning portal (:3001)
│   └── packages/
│       └── ui/                 # Reusable UI component library (<RudraNetraLogo />)
├── tests/                      # Automated 53-endpoint end-to-end integration test suite
├── infra/
│   ├── docker-compose.yml      # Orchestration for TimescaleDB, Redis, NATS, Apps
│   └── nginx/                  # Reverse proxy configuration
├── assets/
│   └── screenshots/            # Real application screenshots (pagename.png)
└── docs/
    └── assets/                 # Brand logos and architecture diagrams
```

---

## 📄 License
Enterprise Telematics Platform. All rights reserved.
