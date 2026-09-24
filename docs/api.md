# RudraNetra API Reference

## Base URL
`/api/v1`

## Authentication
All endpoints except `/auth/login` and `/health` require a Bearer token:
```
Authorization: Bearer <access_token>
```

### POST `/auth/login`
**Request Body:**
```json
{
  "username": "admin",
  "password": "yourpassword"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "expires_at": 1727173200
}
```

---

## Live Tracking (WebSocket)
**URL:** `ws://localhost:8080/ws/tracking`

### Client -> Server Subscribe
```json
{
  "action": "subscribe",
  "device_ids": [101, 102]
}
```

### Server -> Client Telemetry Broadcast
```json
{
  "type": "position",
  "device_id": 101,
  "reg_number": "DXB-A-98124",
  "lat": 25.2048,
  "lng": 55.2708,
  "speed": 68.4,
  "heading": 45,
  "ignition": true,
  "status": "moving",
  "timestamp": "2026-09-24T10:00:00Z"
}
```

---

## Devices API
- `GET /devices`: List paginated devices for current tenant
- `GET /devices/:id`: Get device details
- `POST /devices`: Register a new tracker
- `PUT /devices/:id`: Update device metadata
- `POST /devices/:id/assign`: Link tracker to a vehicle

---

## Geofencing & Spatial API
- `GET /geofences`: List geofence boundaries
- `POST /geofences`: Create polygon boundary (WGS84 GeoJSON vertices)
- `POST /geofences/check`: Query whether a coordinate is inside any active geofences
- `GET /poi/nearest?lat=25.2048&lng=55.2708&radius=5000`: Find nearest points of interest within radius (meters) using PostGIS `ST_DWithin`
