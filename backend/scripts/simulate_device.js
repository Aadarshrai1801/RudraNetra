/**
 * RudraNetra — Teltonika GPS Device Simulator (protocol test tool)
 *
 * Emulates a Teltonika FMB920 streaming AVL packets over TCP to rudra-ingest:5040.
 * Supports Codec 8 (0x08), Codec 8 Extended (0x8E) and — when LISTEN_COMMANDS=on —
 * Codec 12 (0x0C) command frames from the server, replying with a Codec 12 response.
 *
 * Common frame layout (all codecs):
 *   [preamble 4B = 0x00000000][data length 4B BE][data: dataLength bytes][CRC 4B]
 *   dataLength counts only the data field (codec id .. trailing "number of data 2").
 *   CRC = CRC-16/ARC over the data field, written [crc & 0xFF, crc >> 8, 0x00, 0x00].
 *
 * Codec 8 (0x08) data:
 *   [0x08][recordCount 1B][records...][recordCount 1B]
 *   record: ts 8B (ms, int64 BE), priority 1B, lng 4B int32 (x1e7), lat 4B int32,
 *           altitude 2B, angle 2B, satellites 1B, speed 2B, eventIOID 1B, totalIO 1B,
 *           then 4 groups for sizes 1/2/4/8, each [count 1B][N x (id 1B, value)].
 *
 * Codec 8 Extended (0x8E) data:
 *   [0x8E][recordCount 1B][records...][recordCount 1B]
 *   record: same GPS part, eventIOID 1B, totalIO 2B BE, then 5 groups for sizes
 *           1/2/4/8, each [count 2B][N x (id 2B, value)], and the X group
 *           [count 2B][N x (id 2B, length 2B, bytes)].
 *
 * Codec 12 (0x0C) command/response data:
 *   [0x0C][quantity1 1B][commandSize 4B BE][command bytes][quantity2 1B]
 *
 * Usage:
 *   node backend/scripts/simulate_device.js
 *   CODEC=8e BURST=3 INTERVAL_MS=1000 node backend/scripts/simulate_device.js
 *   FRAGMENT=on CRC=off node backend/scripts/simulate_device.js
 *   LISTEN_COMMANDS=on POSITIONS=10 node backend/scripts/simulate_device.js
 *
 * Options may also be passed as CLI args, e.g. `node simulate_device.js CODEC=8e BURST=2`.
 * Env: HOST/INGEST_HOST (127.0.0.1), PORT/INGEST_PORT (5040), IMEI (866907059076488),
 *      CODEC (8), INTERVAL_MS (2500), BURST (1), FRAGMENT (off), CRC (on),
 *      LISTEN_COMMANDS (off), POSITIONS (infinite), VOLTAGE_MV (random),
 *      PARK_EVERY (random), PARK_RECORDS (5), PARK_IGNITION (off).
 */

'use strict';

const net = require('net');

// ─── Options (CLI KEY=VALUE overrides env, env overrides defaults) ───────────

const cliArgs = {};
for (const arg of process.argv.slice(2)) {
  const m = /^([A-Za-z_]+)=(.*)$/.exec(arg);
  if (m) cliArgs[m[1].toUpperCase()] = m[2];
}
const opt = (name, fallback) => cliArgs[name] ?? process.env[name] ?? fallback;
const isOn = (name) => ['on', '1', 'true', 'yes'].includes(String(opt(name, 'off')).toLowerCase());
const isOff = (name) => ['off', '0', 'false', 'no'].includes(String(opt(name, 'on')).toLowerCase());

const HOST = opt('HOST') || opt('INGEST_HOST') || '127.0.0.1';
const PORT = parseInt(opt('PORT') || opt('INGEST_PORT') || '5040', 10);
const IMEI = opt('IMEI') || '866907059076488'; // Real Teltonika tracker (Vehicle 58046 - Volvo FH400)

const CODEC_RAW = String(opt('CODEC', '8')).toLowerCase();
const EXTENDED = ['8e', '0x8e', 'extended'].includes(CODEC_RAW);
if (!EXTENDED && !['8', '0x08', 'codec8'].includes(CODEC_RAW)) {
  console.warn(`⚠️  Unknown CODEC="${opt('CODEC')}" — falling back to Codec 8 (0x08).`);
}

const INTERVAL_MS = Math.max(50, parseInt(opt('INTERVAL_MS', '2500'), 10) || 2500);
const BURST = Math.max(1, parseInt(opt('BURST', '1'), 10) || 1);
const FRAGMENT = isOn('FRAGMENT');
const USE_CRC = !isOff('CRC');
const LISTEN_COMMANDS = isOn('LISTEN_COMMANDS');
const POSITIONS_RAW = parseInt(opt('POSITIONS', '0'), 10) || 0;
const POSITIONS = POSITIONS_RAW > 0 ? POSITIONS_RAW : Infinity;
const VOLTAGE_MV = parseInt(opt('VOLTAGE_MV', '0'), 10) || 0; // force IO 7/66 value (0 = random)
const PARK_EVERY = parseInt(opt('PARK_EVERY', '0'), 10) || 0; // park after every N records (0 = random)
const PARK_RECORDS = Math.max(1, parseInt(opt('PARK_RECORDS', '5'), 10) || 5);
const PARK_IGNITION = isOn('PARK_IGNITION'); // parked with engine running (idling)

// ─── Movement model (Dubai start, advancing along heading) ────────────────────

const sim = {
  lat: 24.89521,
  lng: 55.14203,
  heading: 238,      // degrees
  speed: 65,         // km/h
  odometer: 1425800, // meters, increasing
  records: 0,
  fuel: 78,          // percent
  tempC10: -184,     // 1-wire temperature in °C x10 (signed int16, -18.4 °C)
  parkTicks: 0,
  xCounter: 0x01020304,
};

/** Advances the movement model by one record and returns its values. */
function nextRecord(timestamp) {
  sim.records++;

  let parked = false;
  if (sim.parkTicks > 0) {
    sim.parkTicks--;
    parked = true;
    sim.speed = 0;
  } else if (PARK_EVERY > 0 && sim.records % PARK_EVERY === 0) {
    sim.parkTicks = PARK_RECORDS - 1;
    parked = true;
    sim.speed = 0;
  } else if (PARK_EVERY === 0 && Math.random() < 0.02) {
    sim.parkTicks = 3 + Math.floor(Math.random() * 6); // park for 3-8 records
    parked = true;
    sim.speed = 0;
  } else {
    sim.speed = 55 + Math.floor(Math.random() * 31); // 55-85 km/h
    sim.heading = (sim.heading + Math.floor(Math.random() * 7) - 3 + 360) % 360;
    const meters = sim.speed * (INTERVAL_MS / 3600); // km/h -> m per tick
    const rad = (sim.heading * Math.PI) / 180;
    sim.lat += (meters * Math.cos(rad)) / 111320;
    sim.lng += (meters * Math.sin(rad)) / (111320 * Math.cos((sim.lat * Math.PI) / 180));
    sim.odometer += Math.round(meters);
  }

  if (!parked) sim.fuel = Math.max(3, Math.min(100, sim.fuel - 0.05));
  sim.tempC10 = Math.max(-300, Math.min(80, sim.tempC10 + Math.floor(Math.random() * 3) - 1));
  sim.xCounter = (sim.xCounter + 1) >>> 0;

  return {
    timestamp,
    priority: 0,
    lat: sim.lat,
    lng: sim.lng,
    altitude: 12 + Math.floor(Math.random() * 10),
    angle: sim.heading,
    satellites: 10 + Math.floor(Math.random() * 7),
    speed: sim.speed,
    ignition: parked ? (PARK_IGNITION ? 1 : 0) : 1,  // 1 = moving/idling, 0 = parked
    door: Math.floor((sim.records - 1) / 10) % 2,    // DIN2 toggles every ~10 records
    vehicleMv: VOLTAGE_MV > 0 ? VOLTAGE_MV : 24000 + Math.floor(Math.random() * 801),   // IO 7: 24000-24800 mV
    externalMv: VOLTAGE_MV > 0 ? VOLTAGE_MV : 23900 + Math.floor(Math.random() * 901),  // IO 66: external voltage mV
    batteryMv: 3800 + Math.floor(Math.random() * 351),    // IO 67: 3800-4150 mV
    tempC10: sim.tempC10,                                 // IO 72: signed, °C x10
    fuel: Math.round(sim.fuel),                           // IO 84: 0-100 %
    odometer: sim.odometer,                               // IO 16: meters
    xtra: sim.xCounter,                                   // IO 200: X-group counter
  };
}

// ─── CRC-16/ARC (reflected poly 0xA001, init 0x0000) ─────────────────────────

function crc16(buf) {
  let crc = 0x0000;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
  }
  return crc & 0xffff;
}

// ─── Frame encoding ──────────────────────────────────────────────────────────

function writeIOValue(buf, offset, size, value, signed) {
  switch (size) {
    case 1: buf.writeUInt8(value & 0xff, offset); break;
    case 2: signed ? buf.writeInt16BE(value, offset) : buf.writeUInt16BE(value & 0xffff, offset); break;
    case 4: buf.writeUInt32BE(value >>> 0, offset); break;
    case 8: buf.writeBigUInt64BE(BigInt(Math.round(value)), offset); break;
  }
}

/** Codec 8 group: [count 1B] then N x [id 1B][value]. */
function ioGroup8(elems) {
  const parts = [Buffer.from([elems.length])];
  for (const el of elems) {
    const b = Buffer.alloc(1 + el.size);
    b.writeUInt8(el.id, 0);
    writeIOValue(b, 1, el.size, el.value, el.signed);
    parts.push(b);
  }
  return Buffer.concat(parts);
}

/** Codec 8E group: [count 2B] then N x [id 2B][value]. */
function ioGroup8e(elems) {
  const head = Buffer.alloc(2);
  head.writeUInt16BE(elems.length, 0);
  const parts = [head];
  for (const el of elems) {
    const b = Buffer.alloc(2 + el.size);
    b.writeUInt16BE(el.id, 0);
    writeIOValue(b, 2, el.size, el.value, el.signed);
    parts.push(b);
  }
  return Buffer.concat(parts);
}

/** Codec 8E X group: [count 2B] then N x [id 2B][length 2B][bytes]. */
function ioGroupX8e(elems) {
  const head = Buffer.alloc(2);
  head.writeUInt16BE(elems.length, 0);
  const parts = [head];
  for (const el of elems) {
    const b = Buffer.alloc(4 + el.data.length);
    b.writeUInt16BE(el.id, 0);
    b.writeUInt16BE(el.data.length, 2);
    el.data.copy(b, 4);
    parts.push(b);
  }
  return Buffer.concat(parts);
}

/** GPS part shared by both codecs (24 bytes). */
function buildGpsPart(rec) {
  const b = Buffer.alloc(24);
  b.writeBigInt64BE(BigInt(Math.trunc(rec.timestamp)), 0); // timestamp (ms)
  b.writeUInt8(rec.priority, 8);                            // priority
  b.writeInt32BE(Math.round(rec.lng * 1e7), 9);             // longitude x1e7
  b.writeInt32BE(Math.round(rec.lat * 1e7), 13);            // latitude x1e7
  b.writeUInt16BE(rec.altitude & 0xffff, 17);               // altitude (m)
  b.writeUInt16BE(rec.angle & 0xffff, 19);                  // angle (deg)
  b.writeUInt8(rec.satellites, 21);                         // satellites
  b.writeUInt16BE(rec.speed & 0xffff, 22);                  // speed (km/h)
  return b;
}

/** Builds one AVL record for the selected codec. */
function buildRecord(rec) {
  const oneByte = [
    { id: 1, size: 1, value: rec.ignition },
    { id: 2, size: 1, value: rec.door },
  ];
  const twoByte = [
    { id: 7, size: 2, value: rec.vehicleMv },
    { id: 66, size: 2, value: rec.externalMv },
    { id: 67, size: 2, value: rec.batteryMv },
    { id: 72, size: 2, value: rec.tempC10, signed: true }, // negative values exercise int16
    { id: 84, size: 2, value: rec.fuel },
  ];
  const fourByte = [{ id: 16, size: 4, value: rec.odometer }];
  const eightByte = [];

  const gps = buildGpsPart(rec);

  if (EXTENDED) {
    const xCounter = Buffer.alloc(4);
    xCounter.writeUInt32BE(rec.xtra);
    const xGroup = [{ id: 200, data: xCounter }];
    const groups = [
      ioGroup8e(oneByte),
      ioGroup8e(twoByte),
      ioGroup8e(fourByte),
      ioGroup8e(eightByte),
      ioGroupX8e(xGroup),
    ];
    const totalIO = oneByte.length + twoByte.length + fourByte.length + eightByte.length + xGroup.length;
    const tail = Buffer.alloc(3);
    tail.writeUInt8(0, 0);        // eventIOID
    tail.writeUInt16BE(totalIO, 1); // total IO (2B in Codec 8E)
    return Buffer.concat([gps, tail, ...groups]);
  }

  const groups = [
    ioGroup8(oneByte),
    ioGroup8(twoByte),
    ioGroup8(fourByte),
    ioGroup8(eightByte),
  ];
  const totalIO = oneByte.length + twoByte.length + fourByte.length + eightByte.length;
  const tail = Buffer.alloc(2);
  tail.writeUInt8(0, 0);      // eventIOID
  tail.writeUInt8(totalIO, 1); // total IO (1B in Codec 8)
  return Buffer.concat([gps, tail, ...groups]);
}

/** Wraps a data field into [preamble][len][data][CRC]. */
function buildFrame(data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(0, 0);            // preamble
  header.writeUInt32BE(data.length, 4);  // data length (data field only)

  const crc = Buffer.alloc(4);
  if (USE_CRC) {
    const c = crc16(data);
    crc.writeUInt8(c & 0xff, 0);
    crc.writeUInt8((c >> 8) & 0xff, 1);
  }
  return Buffer.concat([header, data, crc]);
}

/** Builds a complete AVL frame holding `records` records of the selected codec. */
function buildAvlFrame(records) {
  const codecId = EXTENDED ? 0x8e : 0x08;
  const encoded = records.map(buildRecord);
  const count = Buffer.from([encoded.length]);
  const data = Buffer.concat([Buffer.from([codecId]), count, ...encoded, count]);
  return buildFrame(data);
}

/** Builds a Codec 12 response frame carrying `text`. */
function buildCodec12Response(text) {
  const payload = Buffer.from(text, 'utf8');
  const data = Buffer.alloc(1 + 1 + 4 + payload.length + 1);
  let o = 0;
  data.writeUInt8(0x0c, o++);            // codec 12
  data.writeUInt8(0x01, o++);            // quantity 1
  data.writeUInt32BE(payload.length, o); // command size
  o += 4;
  payload.copy(data, o);
  o += payload.length;
  data.writeUInt8(0x01, o);              // quantity 2
  return buildFrame(data);
}

// ─── Startup banner ──────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║      RudraNetra — Teltonika Device Simulator (TCP 5040)      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`  Target        : ${HOST}:${PORT}`);
console.log(`  IMEI          : ${IMEI}`);
console.log(`  Codec         : ${EXTENDED ? 'Codec 8 Extended (0x8E)' : 'Codec 8 (0x08)'}`);
console.log(`  Interval      : ${INTERVAL_MS} ms`);
console.log(`  Burst         : ${BURST} record(s)/frame`);
console.log(`  Fragment      : ${FRAGMENT ? 'on (2-4 chunks, 20-80 ms gaps)' : 'off'}`);
console.log(`  CRC           : ${USE_CRC ? 'CRC-16/ARC' : 'off (zeroes)'}`);
console.log(`  Listen cmds   : ${LISTEN_COMMANDS ? 'on (Codec 12)' : 'off'}`);
console.log(`  Positions     : ${POSITIONS === Infinity ? 'infinite' : POSITIONS}`);
console.log('');

// ─── Socket / protocol state ─────────────────────────────────────────────────

const client = new net.Socket();
client.setNoDelay(true);

let state = 'WAITING_HANDSHAKE'; // WAITING_HANDSHAKE -> STREAMING
let rxBuf = Buffer.alloc(0);
let streamTimer = null;
let emitted = 0;
let frameNo = 0;

client.connect(PORT, HOST, () => {
  console.log('🔗 TCP connection established. Sending IMEI handshake...');
  // Handshake: [2B IMEI length BE][ASCII IMEI]
  const imeiBuffer = Buffer.from(IMEI, 'ascii');
  const handshake = Buffer.alloc(2 + imeiBuffer.length);
  handshake.writeUInt16BE(imeiBuffer.length, 0);
  imeiBuffer.copy(handshake, 2);
  client.write(handshake);
});

client.on('data', (chunk) => {
  rxBuf = Buffer.concat([rxBuf, chunk]);
  pump();
});

client.on('close', () => {
  console.log('🔌 TCP connection closed.');
  process.exit(0);
});

client.on('error', (err) => {
  console.error('⚠️  Socket error:', err.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Interrupted — closing connection.');
  client.end();
});

/** Consumes complete protocol frames from rxBuf. */
function pump() {
  if (state === 'WAITING_HANDSHAKE') {
    if (rxBuf.length < 1) return;
    const response = rxBuf[0];
    rxBuf = rxBuf.subarray(1);
    if (response === 0x01) {
      console.log('🎉 Ingest server accepted IMEI (0x01).');
      state = 'STREAMING';
      startStreaming();
    } else {
      console.error(`❌ IMEI rejected by ingest server (0x${response.toString(16).padStart(2, '0')}).`);
      client.destroy();
      process.exit(1);
    }
  }

  if (state !== 'STREAMING') return;

  while (true) {
    // Codec 12 command frame: starts with 4 zero bytes and 0x0C at offset 8.
    if (LISTEN_COMMANDS && rxBuf.length >= 9 && rxBuf.readUInt32BE(0) === 0 && rxBuf[8] === 0x0c) {
      if (rxBuf.length < 13) return;
      const dataLen = rxBuf.readUInt32BE(4);
      const total = 8 + dataLen + 4; // preamble + len + data + CRC
      if (rxBuf.length < total) return;
      const frame = rxBuf.subarray(0, total);
      rxBuf = rxBuf.subarray(total);
      handleCommandFrame(frame);
      continue;
    }
    // Otherwise: 4-byte ACK holding the persisted record count.
    if (rxBuf.length >= 4) {
      const acked = rxBuf.readUInt32BE(0);
      rxBuf = rxBuf.subarray(4);
      console.log(`📥 Server acknowledged ${acked} AVL record(s).`);
      continue;
    }
    return;
  }
}

/** Parses [preamble 4][len 4][0x0C][qty1][commandSize 4][command][qty2][CRC 4]. */
function handleCommandFrame(frame) {
  const dataLen = frame.readUInt32BE(4);
  const data = frame.subarray(8, 8 + dataLen);
  const qty1 = data[1];
  const commandSize = data.readUInt32BE(2);
  const command = data.subarray(6, 6 + commandSize).toString('utf8');
  console.log(`📨 Codec 12 command received (qty1=${qty1}, size=${commandSize}): "${command}"`);

  const response = /^get/i.test(command.trim()) ? 'Yes:1' : `OK:${command}`;
  const packet = buildCodec12Response(response);
  console.log(`📤 Codec 12 response: "${response}" (${packet.length} bytes)`);
  client.write(packet);
}

function startStreaming() {
  console.log(`🚀 Streaming ${EXTENDED ? 'Codec 8 Extended' : 'Codec 8'} telemetry every ${INTERVAL_MS} ms...`);

  const sendFrame = () => {
    const base = Date.now();
    const records = [];
    for (let i = 0; i < BURST; i++) records.push(nextRecord(base + i * 1000));

    const packet = buildAvlFrame(records);
    frameNo++;
    emitted += records.length;

    const r = records[0];
    console.log(
      `📤 Frame #${frameNo}: ${records.length} record(s), ${packet.length} bytes | ` +
      `Lat ${r.lat.toFixed(5)}, Lng ${r.lng.toFixed(5)} | ${r.speed} km/h | ${r.angle}° | ign=${r.ignition}`
    );
    writePacket(packet);

    if (emitted >= POSITIONS) {
      clearInterval(streamTimer);
      console.log(`🏁 Reached POSITIONS=${POSITIONS}. Waiting briefly for the final ACK...`);
      setTimeout(() => client.end(), 1500);
    }
  };

  streamTimer = setInterval(sendFrame, INTERVAL_MS);
  sendFrame(); // send the first frame immediately
}

/** Writes a packet whole, or split into 2-4 chunks with 20-80 ms gaps. */
function writePacket(packet) {
  if (!FRAGMENT) {
    client.write(packet);
    return;
  }

  const chunkCount = 2 + Math.floor(Math.random() * 3); // 2-4
  const cuts = new Set();
  while (cuts.size < chunkCount - 1) cuts.add(1 + Math.floor(Math.random() * (packet.length - 1)));
  const points = [0, ...[...cuts].sort((a, b) => a - b), packet.length];

  client.write(packet.subarray(points[0], points[1])); // first chunk immediately
  let delay = 0;
  for (let i = 1; i < points.length - 1; i++) {
    delay += 20 + Math.floor(Math.random() * 61); // 20-80 ms
    const slice = packet.subarray(points[i], points[i + 1]);
    setTimeout(() => {
      if (!client.destroyed) client.write(slice);
    }, delay);
  }
}
