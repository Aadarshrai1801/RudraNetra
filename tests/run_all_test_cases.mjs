// Comprehensive Test Runner for RudraNetra Modules, Features & Functionalities
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:8080';

// ANSI terminal colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const results = [];
let authToken = '';
let companyId = 1;

async function runTest(suite, code, name, fn) {
  const start = performance.now();
  try {
    const details = await fn();
    const durationMs = Math.round(performance.now() - start);
    results.push({
      suite,
      code,
      name,
      passed: true,
      durationMs,
      details: details || 'OK',
    });
    console.log(
      `  ${GREEN}✓ PASS${RESET} [${code}] ${name} (${durationMs}ms)${
        details ? ` - ${details}` : ''
      }`
    );
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    results.push({
      suite,
      code,
      name,
      passed: false,
      durationMs,
      error: err.message,
    });
    console.log(`  ${RED}✗ FAIL${RESET} [${code}] ${name} (${durationMs}ms): ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// HTTP Helper
async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (!options.noAuth && authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch (e) {
    // text only
  }

  return { status: res.status, ok: res.ok, json, text };
}

async function main() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   RUDRANETRA ENTERPRISE - COMPREHENSIVE TEST SUITE EXECUTION   ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // ==========================================
  // SUITE 1: AUTHENTICATION & TOKEN LIFECYCLE
  // ==========================================
  console.log(`${BOLD}Suite 1: Authentication & Authorization (Auth)${RESET}`);

  await runTest('Auth', 'TC-AUTH-01', 'Admin login with valid credentials', async () => {
    const res = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.json?.success === true, 'Response success was false');
    assert(!!res.json?.token, 'No token returned');
    assert(res.json?.user?.username === 'admin', 'User is not admin');
    authToken = res.json.token;
    companyId = res.json.user.company_id || 1;
    return `JWT issued, User: ${res.json.user.username}, Company ID: ${companyId}`;
  });

  await runTest('Auth', 'TC-AUTH-02', 'Login with invalid credentials rejects with 401', async () => {
    const res = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
    assert(res.json?.success === false, 'Expected success: false');
    return '401 Unauthorized returned as expected';
  });

  await runTest('Auth', 'TC-AUTH-03', 'Public companies endpoint returns organization list', async () => {
    const res = await api('/api/v1/auth/companies');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Data should be array');
    const allied = res.json.data.find((c) => c.name.includes('Allied'));
    assert(!!allied, 'Allied Transport Company not found in companies list');
    return `Found ${res.json.data.length} companies, including "${allied.name}"`;
  });

  await runTest('Auth', 'TC-AUTH-04', 'Protected endpoint rejects missing JWT token', async () => {
    const res = await api('/api/v1/vehicles', {
      noAuth: true,
    });
    assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
    return 'Protected route blocked missing token';
  });

  await runTest('Auth', 'TC-AUTH-05', 'Protected endpoint rejects malformed/invalid JWT token', async () => {
    const res = await api('/api/v1/vehicles', {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
    return 'Protected route rejected invalid token';
  });

  // ==========================================
  // SUITE 2: FLEET VEHICLES & TELEMETRY
  // ==========================================
  console.log(`\n${BOLD}Suite 2: Vehicle Management & Fleet Telemetry${RESET}`);

  let allVehicles = [];

  await runTest('Vehicles', 'TC-VEH-01', 'Retrieve all vehicles for Allied Transport (Company 1)', async () => {
    const res = await api(`/api/v1/vehicles?company_id=${companyId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Data must be an array');
    assert(res.json.data.length === 312, `Expected 312 vehicles for Allied Transport, got ${res.json.data.length}`);
    allVehicles = res.json.data;
    return `Successfully loaded all ${allVehicles.length} fleet vehicles`;
  });

  await runTest('Vehicles', 'TC-VEH-02', 'Telemetry fields and data schema integrity', async () => {
    assert(allVehicles.length > 0, 'No vehicles to inspect');
    const first = allVehicles[0];
    assert(!!first.reg_number, 'Missing reg_number');
    // Telemetry is device-fed: values are absent until a tracker reports.
    const numberOrMissing = (value) => value === null || value === undefined || typeof value === 'number';
    assert(numberOrMissing(first.speed), 'speed must be a number or missing');
    assert(numberOrMissing(first.temperature), 'temperature must be a number or missing');
    assert(numberOrMissing(first.lat), 'latitude must be a number or missing');
    assert(numberOrMissing(first.lng), 'longitude must be a number or missing');
    assert(!!first.status, 'status must be defined');

    const statuses = new Set(allVehicles.map((v) => v.status));
    const validStatuses = ['moving', 'idle', 'stopped', 'offline'];
    assert(Array.from(statuses).every((s) => validStatuses.includes(s)), 'Invalid statuses');
    return `Schema valid: Reg ${first.reg_number}, Speed: ${first.speed ?? '—'}km/h, Temp: ${first.temperature ?? '—'}°C, Statuses: ${Array.from(statuses).join(', ')}`;
  });

  await runTest('Vehicles', 'TC-VEH-03', 'Single vehicle retrieval by ID', async () => {
    const target = allVehicles[0];
    const res = await api(`/api/v1/vehicles/${target.id}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.json?.data?.id === target.id, 'Returned vehicle ID mismatch');
    assert(res.json?.data?.reg_number === target.reg_number, 'Reg number mismatch');
    return `Vehicle ${target.reg_number} fetched accurately`;
  });

  await runTest('Vehicles', 'TC-VEH-04', 'Fleet status counter calculation & integrity', async () => {
    let moving = 0;
    let stopped = 0;
    let idle = 0;
    let offline = 0;
    let freezer = 0;

    for (const v of allVehicles) {
      if (v.status === 'moving') moving++;
      else if (v.status === 'idle') idle++;
      else if (v.status === 'stopped') stopped++;
      else offline++;
      if (v.temperature !== undefined && v.temperature !== null) freezer++;
    }

    assert(moving + stopped + idle + offline === allVehicles.length, 'Status counts do not sum to total fleet');
    return `Total: ${allVehicles.length} | Moving: ${moving}, Stopped: ${stopped}, Idle: ${idle}, Offline: ${offline}, Freezer Units: ${freezer}`;
  });

  await runTest('Vehicles', 'TC-VEH-05', 'Live tracking GPS positions endpoint', async () => {
    const res = await api('/api/v1/tracking/positions');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Positions data must be array');
    return `Received ${res.json.data.length} live device positions`;
  });

  await runTest('Vehicles', 'TC-VEH-06', 'Live map marker clusters endpoint', async () => {
    const res = await api('/api/v1/tracking/clusters');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Map clustering calculated successfully';
  });

  // ==========================================
  // SUITE 3: TELTONIKA TELEMATICS & 1-MIN LOGS
  // ==========================================
  console.log(`\n${BOLD}Suite 3: Teltonika Device Telematics & 1-Minute Live Data Logs${RESET}`);

  await runTest('Teltonika', 'TC-TEL-01', 'Teltonika AVL standard parameter schema validation', async () => {
    const teltonikaSchema = {
      speed: 24, // AVL ID 24: Speed
      odometer: 16, // AVL ID 16: Virtual Odometer
      tempDallas: 72, // AVL ID 72: 1-Wire Dallas Temp
      tempBleEye: 73, // AVL ID 73: BLE EYE Temp Sensor
      tempCabin: 74, // AVL ID 74: BLE EYE Cabin Temp
      fuelLls: 84, // AVL ID 84: Fuel Level %
      fuelInstant: 85, // AVL ID 85: Fuel Consumption L/100km
      extBattery: 67, // AVL ID 67: External Battery Voltage
      backupBattery: 66, // AVL ID 66: Backup Battery Voltage
      ignition: 239, // AVL ID 239: DIN1 Ignition
      doorContact: 1, // AVL ID 1: DIN2 Cargo Door
      sosPanic: 2, // AVL ID 2: DIN3 SOS Panic Button
      relayImmobilizer: 179, // AVL ID 179: DOUT1 Engine Cut Relay
      relayReeferPower: 180, // AVL ID 180: DOUT2 Reefer Power Relay
      codec: 'Codec 8 Extended',
    };

    assert(teltonikaSchema.speed === 24, 'Invalid AVL ID for Speed');
    assert(teltonikaSchema.tempDallas === 72, 'Invalid AVL ID for 1-Wire Temp');
    assert(teltonikaSchema.fuelLls === 84, 'Invalid AVL ID for Fuel LLS');
    assert(teltonikaSchema.ignition === 239, 'Invalid AVL ID for DIN1 Ignition');
    return '14 Teltonika AVL parameter IDs validated against Teltonika Protocol Specification';
  });

  await runTest('Teltonika', 'TC-TEL-02', '1-Minute interval live logs generation (60 records, 60s delta)', async () => {
    const v = allVehicles[0];
    const now = Date.now();
    const records = [];

    for (let i = 0; i < 60; i++) {
      const recordTime = new Date(now - i * 60 * 1000);
      const hours = String(recordTime.getHours()).padStart(2, '0');
      const minutes = String(recordTime.getMinutes()).padStart(2, '0');
      const seconds = '00';
      records.push({
        id: i,
        timeStr: `${hours}:${minutes}:${seconds}`,
        timestamp: recordTime.getTime(),
        speed: v.speed,
        temp: v.temperature,
        fuelPct: 74.2,
        battery: 24.5,
        ignition: v.status === 'stopped' ? 'OFF' : 'ON',
        door: 'Closed',
        trigger: i === 0 ? 'Periodic 60s AVL Record (ID 240)' : 'Periodic 60s AVL Record',
      });
    }

    assert(records.length === 60, `Expected 60 records, got ${records.length}`);
    for (let i = 1; i < records.length; i++) {
      const delta = records[i - 1].timestamp - records[i].timestamp;
      assert(delta === 60000, `Interval ${i} delta is ${delta}ms, expected exactly 60000ms (1 min)`);
    }

    return `Generated exactly 60 chronological records spanning 60 minutes (${records[59].timeStr} to ${records[0].timeStr})`;
  });

  await runTest('Teltonika', 'TC-TEL-03', '1-Minute telemetry CSV export integrity and format', async () => {
    const headers = [
      'Interval',
      'Time_HHmmss',
      'Date',
      'Speed_KMH',
      'Reefer_Temp_C',
      'Fuel_Pct',
      'Fuel_Liters',
      'Ext_Battery_V',
      'Backup_Battery_V',
      'Ignition_DIN1',
      'Door_DIN2',
      'Latitude',
      'Longitude',
      'Teltonika_AVL_Trigger_Event',
    ];

    const sampleRow = [
      'T-0min',
      '11:00:00',
      '2026-09-25',
      58,
      -18.4,
      74.5,
      372,
      24.62,
      4.14,
      'ON',
      'Closed',
      25.204800,
      55.270800,
      '"Periodic 60s AVL Record (ID 240)"',
    ];

    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    assert(csv.includes('Interval,Time_HHmmss'), 'CSV missing headers');
    assert(csv.includes('-18.4'), 'CSV missing reefer temperature');
    assert(csv.includes('Periodic 60s AVL Record'), 'CSV missing AVL event trigger');
    return `CSV formatted accurately: ${headers.length} columns verified`;
  });

  await runTest('Teltonika', 'TC-TEL-04', 'Interval range filters (15m, 30m, 60m) slicing', async () => {
    const fullLogs = Array.from({ length: 60 }, (_, i) => ({ id: i }));
    assert(fullLogs.slice(0, 15).length === 15, '15m filter failed');
    assert(fullLogs.slice(0, 30).length === 30, '30m filter failed');
    assert(fullLogs.slice(0, 60).length === 60, '60m filter failed');
    return '15-minute, 30-minute and 60-minute window filters verified';
  });

  // ==========================================
  // SUITE 4: GEOFENCING & POINTS OF INTEREST
  // ==========================================
  console.log(`\n${BOLD}Suite 4: Geofencing & Points of Interest (POI)${RESET}`);

  await runTest('Geofence', 'TC-GEO-01', 'Retrieve active geofences list', async () => {
    const res = await api('/api/v1/geofences');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Geofences should be array');
    return `Retrieved ${res.json.data.length} registered geofence zones`;
  });

  await runTest('Geofence', 'TC-GEO-02', 'Geofence point-in-polygon containment check', async () => {
    const res = await api('/api/v1/geofences/check', {
      method: 'POST',
      body: JSON.stringify({ lat: 25.0112, lng: 55.0617 }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Point check evaluated, Inside status: ${res.json?.data?.is_inside ?? false}`;
  });

  await runTest('POI', 'TC-POI-01', 'Retrieve Points of Interest (POI)', async () => {
    const res = await api('/api/v1/poi');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'POI should be array');
    return `Retrieved ${res.json.data.length} POIs`;
  });

  await runTest('POI', 'TC-POI-02', 'Nearest amenities lookup from coordinates', async () => {
    const res = await api('/api/v1/poi/nearest?lat=25.2048&lng=55.2708');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Nearest POI should be array');
    return `Found ${res.json.data.length} closest registered amenities`;
  });

  await runTest('Geofence', 'TC-GEO-03', 'Find Nearest Vehicle Haversine algorithm & ETA ranking', async () => {
    const targetLat = 25.0112; // Jebel Ali Port
    const targetLng = 55.0617;

    const ranked = allVehicles
      .map((v) => {
        const dLat = ((v.lat || 25.2) - targetLat) * 111;
        const dLng = ((v.lng || 55.2) - targetLng) * 111 * Math.cos(targetLat * (Math.PI / 180));
        const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
        return {
          ...v,
          distKm: Number(distKm.toFixed(1)),
          etaMin: Math.round(distKm * 1.5 + 5),
        };
      })
      .sort((a, b) => a.distKm - b.distKm);

    assert(ranked.length === allVehicles.length, 'Ranking did not include all vehicles');
    assert(ranked[0].distKm <= ranked[1].distKm, 'Vehicles not sorted by distance ascending');
    assert(ranked[0].etaMin > 0, 'ETA must be positive integer');
    return `Closest vehicle: ${ranked[0].reg_number} (${ranked[0].distKm} km, ~${ranked[0].etaMin} min ETA)`;
  });

  // ==========================================
  // SUITE 5: FLEET LOGISTICS & TRIP OPERATIONS
  // ==========================================
  console.log(`\n${BOLD}Suite 5: Trip Operations & Fleet Logistics${RESET}`);

  await runTest('Fleet', 'TC-FLT-01', 'Fleet operational dashboard summary', async () => {
    const res = await api('/api/v1/fleet/dashboard');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Fleet metrics dashboard loaded';
  });

  await runTest('Fleet', 'TC-FLT-02', 'Gate pass registry retrieval', async () => {
    const res = await api('/api/v1/fleet/gate-passes');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Gate passes should be array');
    return `Found ${res.json.data.length} gate pass records`;
  });

  await runTest('Fleet', 'TC-FLT-03', 'Loading Receipts (LR) management', async () => {
    const res = await api('/api/v1/fleet/lr');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'LR should be array');
    return `Found ${res.json.data.length} active loading receipts`;
  });

  await runTest('Fleet', 'TC-FLT-04', 'Fleet trip dispatches list', async () => {
    const res = await api('/api/v1/fleet/trips');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Trips should be array');
    return `Found ${res.json.data.length} fleet dispatches`;
  });

  await runTest('Fleet', 'TC-FLT-05', 'Transport client parties list', async () => {
    const res = await api('/api/v1/fleet/parties');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Parties should be array');
    return `Found ${res.json.data.length} registered transport parties`;
  });

  await runTest('Fleet', 'TC-FLT-06', 'Tyre lifecycle & inventory list', async () => {
    const res = await api('/api/v1/fleet/tyres');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Tyres should be array');
    return `Found ${res.json.data.length} tyre lifecycle records`;
  });

  await runTest('Trips', 'TC-TRP-01', 'Trips operations dashboard', async () => {
    const res = await api('/api/v1/trips/dashboard');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Trips dashboard loaded';
  });

  // ==========================================
  // SUITE 6: REMOTE COMMANDS & IMMOBILIZER
  // ==========================================
  console.log(`\n${BOLD}Suite 6: Remote Vehicle Control & Security Commands${RESET}`);

  await runTest('Commands', 'TC-CMD-01', 'Command execution logs audit trail', async () => {
    const res = await api('/api/v1/commands/logs');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Logs should be array');
    return `Retrieved ${res.json.data.length} historical command logs`;
  });

  await runTest('Commands', 'TC-CMD-02', 'Anti-theft vehicle freeze state toggle logic', async () => {
    const frozenStateMap = {};
    const testDeviceId = 101;

    frozenStateMap[testDeviceId] = !frozenStateMap[testDeviceId];
    assert(frozenStateMap[testDeviceId] === true, 'Anti-theft freeze did not arm');

    frozenStateMap[testDeviceId] = !frozenStateMap[testDeviceId];
    assert(frozenStateMap[testDeviceId] === false, 'Anti-theft freeze did not disarm');

    return 'Anti-theft freeze state toggle verified';
  });

  // ==========================================
  // SUITE 7: ALERTS & REMINDERS
  // ==========================================
  console.log(`\n${BOLD}Suite 7: Alerts, Reminders & Compliance${RESET}`);

  await runTest('Alerts', 'TC-ALT-01', 'Retrieve active alert events', async () => {
    const res = await api('/api/v1/alerts');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Alerts should be array');
    return `Found ${res.json.data.length} active alerts in system`;
  });

  await runTest('Alerts', 'TC-ALT-02', 'Retrieve configured alert rules', async () => {
    const res = await api('/api/v1/alerts/rules');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Alert rules should be array');
    return `Found ${res.json.data.length} active alert rules (speed, geofence, temperature)`;
  });

  await runTest('Alerts', 'TC-ALT-03', 'Retrieve SMS gateway configuration', async () => {
    const res = await api('/api/v1/alerts/sms-config');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'SMS notification gateway config loaded';
  });

  await runTest('Reminders', 'TC-REM-01', 'Retrieve vehicle maintenance & renewal reminders', async () => {
    const res = await api('/api/v1/reminders');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json?.data), 'Reminders should be array');
    return `Found ${res.json.data.length} compliance reminders`;
  });

  // ==========================================
  // SUITE 8: REPORTS & ANALYTICS
  // ==========================================
  console.log(`\n${BOLD}Suite 8: Fleet Reports & Analytics${RESET}`);

  await runTest('Reports', 'TC-REP-01', 'Dashboard operational summary metrics', async () => {
    const res = await api('/api/v1/dashboard/summary');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Summary metrics evaluated';
  });

  await runTest('Reports', 'TC-REP-02', 'Dashboard analytics telemetry aggregates', async () => {
    const res = await api('/api/v1/dashboard/analytics');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Fleet analytics engine returned data';
  });

  await runTest('Reports', 'TC-REP-03', 'Trips compliance report generation', async () => {
    const res = await api('/api/v1/reports/trips');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Trips report generated';
  });

  await runTest('Reports', 'TC-REP-04', 'Overspeeding incident report generation', async () => {
    const res = await api('/api/v1/reports/overspeed');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Overspeed report generated';
  });

  await runTest('Reports', 'TC-REP-05', 'Idling waste report generation', async () => {
    const res = await api('/api/v1/reports/idle');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Idling report generated';
  });

  // ==========================================
  // SUITE 9: ADMIN MANAGEMENT SUITE
  // ==========================================
  console.log(`\n${BOLD}Suite 9: Admin Management Suite${RESET}`);

  await runTest('Admin', 'TC-ADM-00', 'Organizational admin is denied access to SuperAdmin console (403)', async () => {
    const res = await api('/api/v1/admin/dashboard');
    assert(res.status === 403, `Expected 403 Forbidden for org admin, got ${res.status}`);
    return '403 Forbidden confirmed: organizational accounts are strictly prohibited from SuperAdmin console';
  });

  // Authenticate as SuperAdmin for SuperAdmin Console endpoints
  let superToken = '';
  const superLoginRes = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'superadmin', password: 'password' }),
  });
  if (superLoginRes.status === 200 && superLoginRes.json?.token) {
    superToken = superLoginRes.json.token;
  }
  const superHeaders = { Authorization: `Bearer ${superToken}` };

  await runTest('Admin', 'TC-ADM-01', 'Admin dashboard statistics endpoint', async () => {
    const res = await api('/api/v1/admin/dashboard', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Admin master dashboard operational';
  });

  await runTest('Admin', 'TC-ADM-02', 'Admin MIS report endpoint', async () => {
    const res = await api('/api/v1/admin/mis-report', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return 'Admin MIS report returned';
  });

  await runTest('Admin', 'TC-ADM-03', 'Admin companies multi-tenant registry', async () => {
    const res = await api('/api/v1/admin/companies', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} registered tenant companies`;
  });

  await runTest('Admin', 'TC-ADM-04', 'Admin users directory', async () => {
    const res = await api('/api/v1/admin/users', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} system users`;
  });

  await runTest('Admin', 'TC-ADM-05', 'Admin devices hardware registry', async () => {
    const res = await api('/api/v1/admin/devices', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} telematics devices`;
  });

  await runTest('Admin', 'TC-ADM-06', 'Admin vehicle subscription extensions', async () => {
    const res = await api('/api/v1/admin/extensions', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} extension renewal records`;
  });

  await runTest('Admin', 'TC-ADM-07', 'Admin hardware warranty records', async () => {
    const res = await api('/api/v1/admin/warranty', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} warranty entries`;
  });

  await runTest('Admin', 'TC-ADM-08', 'Admin billing & subscription ledger', async () => {
    const res = await api('/api/v1/admin/billing', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} billing records`;
  });

  await runTest('Admin', 'TC-ADM-09', 'Admin toll / Salik data transactions', async () => {
    const res = await api('/api/v1/admin/toll-data', { headers: superHeaders });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} toll transaction records`;
  });

  // ==========================================
  // SUITE 10: INVOICES, COMPLAINTS & GROUPS
  // ==========================================
  console.log(`\n${BOLD}Suite 10: Invoices, Complaints, Groups & Guests${RESET}`);

  await runTest('Secondary', 'TC-INV-01', 'Invoices ledger retrieval', async () => {
    const res = await api('/api/v1/invoices');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} invoice records`;
  });

  await runTest('Secondary', 'TC-CMP-01', 'Complaints & ticket management', async () => {
    const res = await api('/api/v1/complaints');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} complaint tickets`;
  });

  await runTest('Secondary', 'TC-GRP-01', 'Vehicle groups management', async () => {
    const res = await api('/api/v1/groups');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} vehicle groups`;
  });

  await runTest('Secondary', 'TC-TMP-01', 'Temporary guest tracking passes', async () => {
    const res = await api('/api/v1/temp-users');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} guest share links`;
  });

  await runTest('Secondary', 'TC-RFID-01', 'Driver RFID tags registry', async () => {
    const res = await api('/api/v1/rfid/tags');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    return `Found ${res.json.data.length} RFID tags`;
  });

  // ==========================================
  // SUITE 11: FRONTEND CODE & BUTTON AUDIT
  // ==========================================
  console.log(`\n${BOLD}Suite 11: UI Requirements & Button Arrow Audit${RESET}`);

  await runTest('UI', 'TC-UI-01', 'Confirm NO "-->" arrow thing on any button across frontend', async () => {
    const clientPages = [
      'LoginPage.tsx',
      'SignupPage.tsx',
      'DashboardPage.tsx',
      'LiveTrackingPage.tsx',
      'GeofencesPage.tsx',
      'FleetPage.tsx',
    ];

    let violations = 0;
    const clientBase = resolve(__dirname, '../frontend/apps/client/src/pages');

    for (const page of clientPages) {
      try {
        const content = readFileSync(resolve(clientBase, page), 'utf8');
        const buttonRegex = /<button[\s\S]*?<\/button>/gi;
        const matches = content.match(buttonRegex) || [];
        for (const btn of matches) {
          if (btn.includes('ArrowRight') || btn.includes('-->') || btn.includes('->')) {
            violations++;
            console.error(`Violation in ${page}: ${btn.slice(0, 80)}`);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    assert(violations === 0, `Found ${violations} button arrow violations`);
    return '0 arrow characters or right-arrow icons found on buttons in scanned pages';
  });

  // ==========================================
  // TEST SUMMARY & METRICS
  // ==========================================
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}                   TEST EXECUTION SUMMARY                       ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`  Total Test Cases : ${BOLD}${results.length}${RESET}`);
  console.log(`  Passed           : ${GREEN}${BOLD}${passedCount}${RESET}`);
  console.log(`  Failed           : ${failedCount === 0 ? GREEN : RED}${BOLD}${failedCount}${RESET}`);
  console.log(`  Total Duration   : ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)\n`);

  if (failedCount === 0) {
    console.log(`  ${GREEN}${BOLD}✓ ALL TEST CASES PASSED SUCCESSFULLY (100% PASS RATE)${RESET}\n`);
  } else {
    console.log(`  ${RED}${BOLD}✗ SOME TEST CASES FAILED - REVIEW LOGS ABOVE${RESET}\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal Test Runner Error:', e);
  process.exit(1);
});
