# RudraNetra Architecture Reference

## 1. Real-Time Data Pipeline
1. **Device Connection**: Teltonika FMB920 establishes a TCP socket connection to `:5040`.
2. **IMEI Handshake**: Device sends 2-byte length prefix + ASCII IMEI string. `rudra-ingest` accepts and responds with `0x01` acknowledge byte.
3. **AVL Packet Parsing**: Codec 8 records are decoded into typed Go structures:
   - Timestamp (milliseconds since Unix epoch)
   - Coordinates (scaled by 10,000,000 to standard degrees WGS84)
   - Speed, Angle, Altitude, Satellites
   - IO Elements (Ignition / ACC, Battery Voltage, RFID reader, Temperature sensors)
4. **Ingestion & Fanout**:
   - Written to TimescaleDB `positions` hypertable.
   - Cached in Redis key `device:pos:{id}`.
   - Evaluated against PostGIS `geofences` using `ST_Contains`.
   - Broadcasted to connected frontend clients via WebSocket hub.

## 2. Multi-Tenancy Design
Unlike the legacy ASP.NET application which performed `ChangeDatabase(companyDbName)` dynamically on SQL Server, RudraNetra uses a unified single database partitioned cleanly by `company_id` foreign keys with PostgreSQL Row-Level Security (RLS) support.

## 3. Storage Optimization with TimescaleDB
- Partition interval: 7-day chunks.
- Older chunks (> 90 days) can be automatically compressed with TimescaleDB column-oriented compression, reducing disk usage by up to 90%.
