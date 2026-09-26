# RudraNetra API Contract (DB-only)

All endpoints return `{"success": true, ...}` on success and
`{"success": false, "error": "..."}` on failure.
Status codes: 400 validation, 401/403 auth, 404 not found for tenant,
409 conflict, 503 database unavailable.

There is **no mock/in-memory mode**. Lists return `[]` when the database has
no rows. Fields marked `?` may be `null`/absent when the database column is
NULL — display `—` or hide, never invent a value.

## Auth

- `POST /api/v1/auth/login` `{username,password}` →
  `{token, access_token, refresh_token, expires_at, user:{id, username, full_name, email, role, company_id, company_name}}`
- `POST /api/v1/auth/signup` / `register` `{username,password,full_name,email,phone,company_id}` → 201, same shape.
- `GET /api/v1/auth/companies` →
  `data:[{id,name,code,contactPerson,contactEmail,contactPhone,dbShard,city,address,status,createdAt,maxDevices,maxUsers,siraRelay,apiKey,devices,users}]`
- `POST /api/v1/auth/refresh` `{refresh_token}` → token pair
- `POST /api/v1/auth/change-password` `{old_password,new_password}`

## Vehicles

- `GET /api/v1/vehicles?company_id=&limit=&offset=` →
  `{total,count,data:[Vehicle]}`
  Vehicle: `id, company_id, device_id?, reg_number, make, model, variant, body_type,
  fuel_type, fuel_capacity, max_speed, odometer, icon_type,
  status: last known state from the database "moving"|"idle"|"stopped"|"offline"
  (offline only when the vehicle has never reported), online (bool: position
  within 15 min, informational),
  driver_name?, driver_phone?, lat?, lng?, speed?, heading?, ignition?,
  temperature?, fuel_pct?, battery_v?, timestamp?`
- `GET /api/v1/vehicles/:id` → `{data:Vehicle}` / 404
- `POST /api/v1/vehicles` `{regNumber,make,model,variant,bodyType,fuelType,fuelCapacity,maxSpeed,odometer,iconType,deviceId}`
- `PUT /api/v1/vehicles/:id` (same fields)
- `PUT /api/v1/vehicles/:id/config` `{maxSpeed,fuelCapacity,iconType}`
- `GET /api/v1/vehicles/:id/logs?limit=60` (also `/devices/:id/logs`) →
  `{vehicle_id,device_id,reg_number,count,
    vehicle:{reg_number,make,model,fuel_capacity,max_speed},
    device:{id,imei,device_type,sim_no,sim_operator,port,firmware,status,last_heartbeat},
    data:[{id,time,time_str,date_str,interval_str,delta_seconds,speed,
           temp?,fuel_pct?,fuel_liters?,ext_battery?,backup_battery?,
           ignition:"ON"|"OFF",door:""|"Open"|"Closed",
           lat,lng,altitude,satellites,heading,odometer,trigger,status}]}`

## Tracking

- `GET /api/v1/tracking/positions` →
  `{count,data:[{device_id,vehicle_id,reg_number,make,model,driver_name,driver_phone,
    lat?,lng?,speed?,heading?,ignition?,status,temperature?,timestamp}]}`
- `GET /api/v1/tracking/history/:id` →
  `{vehicle_id,reg_number,total_points,data:[{lat,lng,speed,time,timestamp}]}`
- `GET /api/v1/tracking/clusters` → `{data:[{lat,lng,vehicles}]}`

## Devices

- `GET /api/v1/devices` → `data:[{id,imei,protocol,simNo,port,status,warrantyEnd,
  firmware,simOperator,lastHeartbeat,assignedVehicle}]`
- `GET /api/v1/devices/:id` → `{data:{...}}`
- `POST /api/v1/devices` `{imei,protocol,simNo,simOperator,port,firmware,warrantyEnd,assignedVehicle}`
- `PUT /api/v1/devices/:id` `{protocol,simNo,simOperator,port,status,firmware,warrantyEnd}`
- `DELETE /api/v1/devices/:id`
- `POST /api/v1/devices/:id/assign` `{vehicleId|vehicleReg}`
- `GET/PUT /api/v1/devices/:id/config` — `{port,protocol,firmware,status,settings:{idleThresholdMinutes,speedThresholdKmh,timezone,language}}`
- `GET /api/v1/devices/:id/commands` → `data:[{id,deviceId,vehicleReg,commandType,commandStr,sentBy,status,sentAt,deliveredAt?,ackAt?,response?}]`
- `POST /api/v1/devices/:id/commands` `{commandType,pin,notes}` → `{commandId,status:"Sent",rawCommand,queued,message}`; wrong PIN → 401.
  Lifecycle: `Sent` (stored) → `Delivered` (written to the device socket as a
  Codec 12 frame) → `Acknowledged` (device replied; `ackAt`/`response` set).
  Delivery requires the device to be online and Redis to be reachable; commands
  for offline devices stay `Sent`.

## Drivers

- `GET /api/v1/drivers` → `data:[{id,name,phone,licenseNo,licenseExpiry,status,assignedVehicle,rfidTag}]`
- `GET/POST/PUT/DELETE` with the same fields.

## Geofences & POI

- `GET /api/v1/geofences` → `data:[{id,company_id,name,type,speedLimit,alertOnEnter,
  alertOnExit,isActive,areaKm2,activeVehicles,geoJson}]`
- `POST /api/v1/geofences` `{name,type,speedLimit,alertOnEnter,alertOnExit,isActive,geoJson|coordinates}` — geometry is required (no default polygon).
- `PUT /api/v1/geofences/:id`, `DELETE /api/v1/geofences/:id`
- `POST /api/v1/geofences/check` `{lat,lng}` → `{data:{is_inside,zones:[{id,name,speedLimit}]}}`
- `GET /api/v1/poi` → `data:[{id,name,category,address,phone,lat,lng}]`
- `POST/PUT/DELETE /api/v1/poi` `{name,category,address,phone,lat,lng}`
- `GET /api/v1/poi/nearest?lat=&lng=&radius=` → `data:[{id,name,category,address,phone,lat,lng,distanceKm}]`

## Reminders

`GET /api/v1/reminders` → `data:[{id,vehicleId,vehicleReg,reminderType,dueDate,dueKm,
alertBeforeDays,alertBeforeKm,notes,isAcknowledged,status,daysRemaining}]`
`POST` `{vehicleId,reminderType,dueDate,dueKm,alertBeforeDays,alertBeforeKm,notes}`,
`PUT /:id` `{isAcknowledged,dueDate,notes,alertBeforeDays}`, `DELETE /:id`.

## Fleet operations

- `GET /api/v1/fleet/dashboard` → `data:{totalVehicles,totalDevices,activeTrips,
  pendingLoadingReceipts,openGatePasses,pendingReminders,unacknowledgedAlerts,tyresInUse,tyresScrapped}`
- Parties: `GET /api/v1/fleet/parties` → `[{id,name,phone,email,address,contact}]`; `POST`, `PUT /:id`
- Loading receipts: `GET /api/v1/fleet/lr` → `[{id,lrNo,party,vehicle,weightKg,freightAmt,advanceAmt,status}]`; `POST` `{lrNo,party,vehicle,weightKg,freightAmt,advanceAmt}`; `PUT /fleet/lr/:id`
- Fleet trips: `GET /api/v1/fleet/trips` → `[{id,tripNo,vehicleId,vehicleReg,driver1,driver2,
  partyName,source,destination,plannedStart,plannedArrival,freightAmount,advanceAmount,
  expenseAmount,balanceAmount,status}]`; `POST`; `PUT /:id` `{status,expenseAmount}`
- Party routes: `GET /api/v1/fleet/party-routes` → `[{id,partyName,source,destination,
  standardKm,standardRate,billingRate}]`; `POST`
- Vouchers: `GET /api/v1/fleet/vouchers` → `[{id,tripId,tripNo,voucherType,amount,billNo,
  receiptUrl,notes,date}]`; `POST` `{tripId,voucherType,amount,billNo,receiptUrl,notes}`
- Gate passes: `GET /api/v1/fleet/gate-passes` → `[{id,passNo,vehicle,driver,destination,issuedAt,status}]`; `POST` `{vehicle,driver,destination,purpose}`
- Tyres: `GET /api/v1/fleet/tyres` → `[{id,vehicleId,vehicleReg,tyreNumber,axlePosition,
  brand,model,size,treadDepthMm,plyRating,status,openingKm,currentKm,lifeKmLimit,
  retreadingCount,healthPct}]`; `POST` `{vehicleId,tyreNumber,axlePosition,brand,model,size,treadDepthMm,plyRating,status,openingKm,lifeKmLimit,retreadingCount}`; `PUT /:id` `{axlePosition,treadDepthMm,status,retreadingCount,currentKm}`; `DELETE /:id`

## Alerts

- `GET /api/v1/alerts` → `{total, count, data:[{id,type,severity:"critical"|"warning"|"info",vehicle,
  driver,driverPhone,message,time,timestamp,acknowledged,lat?,lng?}]}` — one row per alert id
  (no join fan-out); `total` is the number of alerts stored for the tenant.
  Alert types: `overspeed`, `over_idle`, `thirty_min`, `immobilizer_release`, `sla_alert`,
  `trip_start`, `power_cut`, `harsh_braking`, `harsh_cornering`, `temperature`, `geofence`.
- `PUT /api/v1/alerts/:id/acknowledge`
- `POST /api/v1/alerts/acknowledge-all` → `{acknowledged: <rows>}` — marks every
  unacknowledged alert of the tenant as read (backs the notification bell's
  "Mark all read"); persists across refreshes.
- `GET /api/v1/alerts/rules` → `data:[{id,name,type,description,smsEnabled,emailEnabled,
  smsTemplate,config,isActive}]`; `POST`, `PUT /:id`, `DELETE /:id`
- `GET /api/v1/alerts/sms-config` → `data:{provider,senderId,apiKey(masked),enabled}`; `PUT`

## Reports

`GET /api/v1/reports/:type` →
`{type,count,columns:[{key,label}],data:[row,...]}` — render exactly the
returned `columns`/`data`; do not hardcode rows or fall back to demo data.

Types and row keys:
- `distance` | `mileage` | `daily-distance`: `regNumber,driver,startOdo,endOdo,distanceKm,maxSpeed,avgSpeed,runningMin,idleMin,stopMin`
- `idling` | `idle`: `regNumber,driver,from,to,idleMinutes`
- `overspeed`: `regNumber,driver,time,speed,speedLimit,exceedBy`
- `temperature`: `regNumber,minTemp,maxTemp,avgTemp,readings`
- `distance-matrix`: `regNumber,day,distanceKm`
- `trips`: `tripNo,vehicleReg,driver,party,source,destination,freight,advance,expense,balance,status,plannedStart`
- `fuel`: `regNumber,liters,cost,lastOdometer,receipts`
- `driver`: `name,phone,licenseNo,assignedVehicle,status,tripCount`
- `reminders` | `maintenance`: `vehicleReg,reminderType,dueDate,daysRemaining,status`
- `stoppage`: `regNumber,driver,from,to,stopMinutes`
- `geofence`: `name,type,areaKm2,activeVehicles`
- `summary`: `metric,value`
- any other type: `regNumber,make,model,driver,speed,temperature,lastUpdate,odometer`

`GET /api/v1/reports/export/:type` returns the same data as CSV.

## Dashboard

- `GET /api/v1/dashboard/summary` →
  `data:{totalVehicles,online,moving,idle,stopped,offline,unacknowledgedAlerts}`
  `moving/idle/stopped` come from the **last known position stored in the
  database** (state is kept regardless of age); `offline` means the vehicle has
  never reported. `online` is informational (position within the last 15 min).
- `GET /api/v1/dashboard/analytics` →
  `data:{fleetOccupancyPct,activeVehicles,onlineVehicles,idleVehicles,stoppedVehicles,
  runningVehicles,offlineVehicles,avgDistancePerDay,...}`
  `activeVehicles` counts vehicles with a recorded position; `running/idle/stopped`
  use their last known state and `offlineVehicles` have never reported.
  `onlineVehicles` is the fresh (15 min) subset.

## Trips / Routes / Groups

- `GET /api/v1/trips` → `data:[{id,vehicle_id,vehicle_reg,driver_id,driver_name,start_lat,
  start_lng,end_lat,end_lng,start_time,end_time,distance_km,status}]`
- `GET /api/v1/trips/dashboard` → `data:{totalTrips,planned,inProgress,completed,cancelled,totalDistanceKm}`
- `GET/POST/PUT/DELETE /api/v1/trips`
- `GET /api/v1/routes` → `data:[{id,name,source,destination,distanceKm,estimatedMinutes,isActive}]`; `POST`, `PUT /:id`, `DELETE /:id`
- `GET /api/v1/groups` → `data:[{id,name,description,vehicleIds}]`; `POST`, `PUT /:id`, `DELETE /:id`, `POST /:id/devices` `{vehicleIds}`

## Guest access (`/temp-users`)

`GET` → `data:[{id,guestName,shareLink,accessToken,vehicleIds,expiresAt,createdAt,status}]`
`POST` `{guestName,durationHours,vehicleIds}` → 201 `{id,accessToken,shareLink,expiresAt}`
`DELETE /:id`.

## RFID, Invoices, Complaints, Masters, Settings

- `GET /api/v1/rfid/tags` → `data:[{driverId,tag,driverName,driverPhone,vehicleReg,status}]`;
  `POST /api/v1/rfid/tags` `{driverId,tag}`; `POST /api/v1/rfid/assign` (same body).
- `GET /api/v1/invoices` → `data:[{id,companyId,companyName,invoiceNo,invDate,dueDate,
  amount,taxAmount,totalAmount,paidAmount,status,plan,deviceCount,ratePerDevice,notes}]`;
  `GET /:id`, `POST`, `PUT /:id`, `GET /:id/pdf`.
- `GET /api/v1/complaints` → `data:[{id,ticketNo,vehicleReg,title,category,priority,status,
  technicianAssigned,resolutionNotes,createdAt}]`;
  `POST` `{vehicleId,title,category,priority}`; `PUT /:id` `{status,technicianAssigned,resolutionNotes}`.
- `GET /api/v1/masters/:type` → `data:[{id,type,code,name,isDefault}]`. Types:
  `tyre-brands`, `axle-positions`, `voucher-categories`, `complaint-categories`,
  `device-models`, `sim-operators`. `POST`, `PUT /:id`, `DELETE /:id`.
- `GET /api/v1/settings` → `data:{company:{id,name,code,contactPerson,contactEmail,
  contactPhone,city,address,apiKey,maxDevices,maxUsers,siraRelay},
  settings:{idleThresholdMinutes,speedThresholdKmh,timezone,language,vatPercent},
  usage:{devices,users,vehicles}}`
- `PUT /api/v1/settings` `{companyName,contactPerson,contactEmail,contactPhone,city,address,
  idleThresholdMinutes,speedThresholdKmh,timezone,language,vatPercent}`

## SuperAdmin (`/api/v1/admin`, requires role `superadmin`)

- `GET /admin/dashboard` → `data:{totalTenants,totalDevices,onlineDevices,totalVehicles,
  systemUsers,unacknowledgedAlerts,activeTrips,totalInvoices,positionsLast24h}`
- `GET /admin/stats` → `data:{totalTenants,activeVehicles,systemUsers,siraRelayActive}`
- `GET /admin/mis-report` → `data:[{companyId,companyName,code,devices,vehicles,users,alerts,trips,paidRevenue}]`
- `GET /admin/companies` → same as `/auth/companies`
- `POST /admin/companies` `{name,code,contactPerson,contactEmail,contactPhone,dbShard,city,address,status,maxDevices,maxUsers,siraRelay}` → `{id,apiKey}`
- `PUT /admin/companies/:id` same fields + `{regenerateKey:true}` → `{apiKey}` when regenerated
- `GET /admin/users` → `data:[{id,username,fullName,email,role,companyId,companyName,status,phone}]`
- `POST /admin/users` `{username,password,fullName,email,phone,role,companyId}`
- `PUT /admin/users/:id` `{fullName,email,phone,role,companyId,isActive,password}`
- `GET /admin/devices` → `data:[{id,imei,simCardNo,operator,model,protocol,firmware,
  assignedTenant,vehicleReg,lastPing,status:"Online"|"Offline"|"Unassigned"}]`
- `POST /admin/devices` `{imei,simCardNo,operator,model,protocol,firmware,companyName}`
- `PUT /admin/devices/:id` `{simCardNo,operator,firmware,status}`
- `GET /admin/extensions` → `data:[{id,companyId,companyName,deviceId?,deviceImei?,
  extensionType,oldExpiryDate,newExpiryDate,startDate,endDate,extendedBy,reason,amountPaid,createdAt}]`
- `POST /admin/extensions` `{companyId,deviceId,extensionType,months,reason,amountPaid}` → 201 `{startDate,newExpiryDate}`
- `GET /admin/warranty` → `data:[{id,deviceImei,deviceModel,companyName,purchaseDate,
  warrantyEnd,amcStartDate,amcEndDate,amcStatus,vendorContact}]`
- `POST /admin/warranty` `{deviceId,companyId,warrantyPeriod,vendorName,startDate,endDate,amcActive,amcExpiry,remarks}`
- `GET /admin/raw-data` → `data:[{id,imei,protocol,length,hexPacket,decodedAt,sourceIp,status}]`
- `GET /admin/toll-data` → `data:[{id,tollName,systemType,rateStandard,latitude,longitude,city,status}]`
- `POST /admin/toll-data` `{tollName,systemType,rateStandard,latitude,longitude,city}`
- `GET /admin/roles` → `data:[{id,roleName,description,permissions:{module:mask}}]` (modules:
  `tracking, reports, fleet, control_panel, reminders, billing, users`; mask bits 1=view 2=add 4=edit 8=delete)
- `POST /admin/roles` `{roleName,description,permissions}`; `PUT /admin/roles/:id` (same)
- `GET /admin/billing` → `data:[{id,invoiceNo,companyName,billingPlan,deviceCount,subTotal,
  taxVat,totalAmount,status:"Paid"|"Unpaid"|"Overdue",dueDate}]`
- `POST /admin/billing` `{companyId|companyName,billingPlan,deviceCount,ratePerDevice,dueDate,notes}`
- `GET/POST/PUT/DELETE /admin/masters/:type`

## WebSocket

`ws://<host>/ws/tracking?token=<JWT>` — the token query parameter is
**required**; unauthenticated sockets get HTTP 401. The client should treat
polling (`GET /tracking/positions`, `/vehicles`) as the reliable refresh path.

Live positions are pushed as soon as the ingestion tier stores them
(ingest → Redis `rudra.positions` → API hub):

```json
{ "type": "position",
  "payload": {
    "company_id": 1, "device_id": 139, "reg_number": "58046",
    "lat": 24.89521, "lng": 55.14203, "speed": 64, "heading": 238,
    "ignition": true, "status": "moving",
    "temperature": -18.4, "voltage": 24.1, "fuel_pct": 57,
    "battery_v": 3.95, "door_open": false,
    "odometer": 1425800, "timestamp": "2026-09-26T10:00:00Z"
  } }
```

Alerts raised by the worker's live engine are pushed the same way
(worker → Redis `rudra.alerts` → API hub):

```json
{ "type": "alert",
  "payload": { "id": 101, "company_id": 1, "device_id": 139, "vehicle": "58046",
               "type": "overspeed", "severity": "critical",
               "message": "Vehicle 58046 overspeeding at 92 km/h (limit 80 km/h)",
               "lat": 24.89, "lng": 55.14, "timestamp": "2026-09-26T10:05:00Z" } }
```

## Device ingestion (TCP :5040)

- Teltonika **Codec 8 (`0x08`)** and **Codec 8 Extended (`0x8E`)** are decoded;
  Codec 16 is recognised but not decoded yet.
- **Device-fed telemetry:** on a fresh install `positions`, `alerts`,
  `raw_packets`, `device_commands` and `fuel_records` are empty; they only ever
  contain frames received from registered trackers (or explicit manual test
  runs). The fleet registry (companies, users, vehicles, devices, drivers,
  geofences, POI, business records) is seeded separately.
- TCP stream framing reassembles fragmented reads, multiple frames per read and
  buffered bursts, and resynchronises automatically after corruption.
- CRC-16 is validated when present; `CRC=off` devices are still accepted.
- Unknown IMEIs are rejected (`0x00`); registered devices get `0x01` and their
  AVL frames are acknowledged with the accepted record count.
- Sensor IOs mapped to columns: ignition (1/239), door DIN2 (2), voltage
  (7/66), backup battery (67), 1-wire temperature (72), fuel level (84),
  odometer (16), RFID (207). Every element is preserved in `positions.raw_data`.
- **Socket-tier metrics:** `GET http://localhost:5041/stats` (frames, records,
  positions stored, CRC mismatches, resyncs, batch errors, connected devices,
  commands sent/acked) and `GET http://localhost:5041/healthz`.
- Host ports: `5040` (primary) and `15040` (alternate, useful when a Windows
  Docker port forwarder goes stale). `compose` also health-checks both services
  and caps container logs at 10 MB × 3 files.
- **Live alert engine (worker):** subscribes to `rudra.positions` and raises
  `overspeed`, `over_idle`, `power_cut` and `temperature` alerts with per-device
  cooldowns (5–30 min), using `company_settings.speed_threshold_kmh` and
  `idle_threshold_minutes` (15/80 defaults).
- **TimescaleDB lifecycle:** `positions` is compressed after 30 days
  (segmented by `device_id`) and retained for 730 days.

### Device simulator (no hardware needed)

```bash
# Codec 8 Extended, fragmented frames, bursts of 3, command listener
CODEC=8e BURST=3 FRAGMENT=on LISTEN_COMMANDS=on POSITIONS=30 node backend/scripts/simulate_device.js

# Assert the API WebSocket delivers live positions
EXPECT=3 TIMEOUT_MS=30000 node backend/scripts/test_ws_client.mjs
```
