/**
 * RudraNetra — Teltonika FMB920 GPS Device Simulator
 * Emulates hardware trackers streaming Codec 8 AVL packets over TCP to rudra-ingest:5040
 */

const net = require('net');

const HOST = process.env.INGEST_HOST || '127.0.0.1';
const PORT = parseInt(process.env.INGEST_PORT || '5040', 10);
const IMEI = process.env.IMEI || '866907059076488'; // Real Teltonika tracker (Vehicle 58046 - Volvo FH400)

// Starting location in Dubai (Allied Logistics Depot, DWC Dubai)
let lat = 24.89521;
let lng = 55.14203;
let heading = 238;
let speed = 65; // km/h
let odometer = 1425800;

console.log(`🛰️  Connecting to RudraNetra GPS Ingestion at ${HOST}:${PORT}...`);
console.log(`📱 Simulating Teltonika FMB920 (IMEI: ${IMEI})`);

const client = new net.Socket();

let state = 'WAITING_HANDSHAKE'; // WAITING_HANDSHAKE -> STREAMING

client.connect(PORT, HOST, () => {
  console.log('✅ TCP connection established. Sending IMEI handshake...');

  // 1. Send IMEI Handshake packet: [2 bytes: length] + [N bytes: ASCII IMEI]
  const imeiBuffer = Buffer.from(IMEI, 'ascii');
  const handshake = Buffer.alloc(2 + imeiBuffer.length);
  handshake.writeUInt16BE(imeiBuffer.length, 0);
  imeiBuffer.copy(handshake, 2);

  client.write(handshake);
});

client.on('data', (data) => {
  if (state === 'WAITING_HANDSHAKE') {
    if (data.length >= 1 && data[0] === 0x01) {
      console.log('🎉 Ingest server accepted IMEI! (Response 0x01 received)');
      state = 'STREAMING';
      startStreaming();
    } else {
      console.error('❌ IMEI rejected by ingest server:', data);
      client.destroy();
    }
  } else if (state === 'STREAMING') {
    const recordsAcked = data.readUInt32BE(0);
    console.log(`📥 Server acknowledged ${recordsAcked} AVL record(s).`);
  }
});

client.on('close', () => {
  console.log('🔌 TCP Connection closed.');
  process.exit(0);
});

client.on('error', (err) => {
  console.error('⚠️  Socket error:', err.message);
});

function startStreaming() {
  console.log('🚀 Starting continuous telemetry position stream (every 2.5s)...');

  setInterval(() => {
    // Simulate forward vehicle motion along trajectory
    lat += 0.0003;
    lng += 0.0002;
    speed = Math.floor(60 + Math.random() * 25);
    heading = (heading + Math.floor(Math.random() * 6 - 3) + 360) % 360;
    odometer += Math.floor(speed * (2.5 / 3600));

    const packet = createCodec8Packet({
      timestamp: Date.now(),
      lat: lat,
      lng: lng,
      altitude: 15,
      angle: heading,
      satellites: 14,
      speed: speed,
      ignition: 1,
    });

    console.log(`📤 Transmitting AVL: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)} | Speed: ${speed} km/h | Heading: ${heading}°`);
    client.write(packet);
  }, 2500);
}

/**
 * Builds a Teltonika Codec 8 packet
 */
function createCodec8Packet({ timestamp, lat, lng, altitude, angle, satellites, speed, ignition }) {
  // AVL Record buffer:
  // 8 (ts) + 1 (prio) + 4 (lng) + 4 (lat) + 2 (alt) + 2 (angle) + 1 (sat) + 2 (speed) + 1 (evt) + 1 (total IO)
  // + 1 (1-byte IO count) + 2 (IO id + val)
  const avlRecord = Buffer.alloc(29);
  let offset = 0;

  // Timestamp (8 bytes)
  avlRecord.writeBigInt64BE(BigInt(timestamp), offset);
  offset += 8;

  // Priority (1 byte)
  avlRecord.writeUInt8(0, offset++);

  // Longitude (4 bytes, scaled by 10,000,000)
  avlRecord.writeInt32BE(Math.round(lng * 10000000), offset);
  offset += 4;

  // Latitude (4 bytes, scaled by 10,000,000)
  avlRecord.writeInt32BE(Math.round(lat * 10000000), offset);
  offset += 4;

  // Altitude (2 bytes)
  avlRecord.writeInt16BE(altitude, offset);
  offset += 2;

  // Angle (2 bytes)
  avlRecord.writeUInt16BE(angle, offset);
  offset += 2;

  // Satellites (1 byte)
  avlRecord.writeUInt8(satellites, offset++);

  // Speed (2 bytes)
  avlRecord.writeUInt16BE(speed, offset);
  offset += 2;

  // Event IO ID (1 byte)
  avlRecord.writeUInt8(0, offset++);

  // Total IO count (1 byte)
  avlRecord.writeUInt8(1, offset++);

  // 1-byte IO count (1 byte)
  avlRecord.writeUInt8(1, offset++);

  // IO ID 1 (ACC/Ignition) + value (1 byte)
  avlRecord.writeUInt8(1, offset++); // IO ID = 1 (ACC)
  avlRecord.writeUInt8(ignition, offset++); // value = 1 (ON)

  // 2-byte IO count = 0
  avlRecord.writeUInt8(0, offset++);

  // 4-byte IO count = 0
  avlRecord.writeUInt8(0, offset++);

  // 8-byte IO count = 0
  avlRecord.writeUInt8(0, offset++);

  // Full Packet:
  // 4 (preamble) + 4 (data length) + 1 (codec 8) + 1 (records count) + avlRecord.length + 1 (records count) + 4 (crc)
  const dataLen = 1 + 1 + avlRecord.length + 1;
  const fullPacket = Buffer.alloc(4 + 4 + dataLen + 4);
  let pOffset = 0;

  // Preamble 0x00000000
  fullPacket.writeUInt32BE(0, pOffset);
  pOffset += 4;

  // Data length
  fullPacket.writeUInt32BE(dataLen, pOffset);
  pOffset += 4;

  // Codec 8
  fullPacket.writeUInt8(0x08, pOffset++);

  // Number of Data 1
  fullPacket.writeUInt8(1, pOffset++);

  // AVL Data
  avlRecord.copy(fullPacket, pOffset);
  pOffset += avlRecord.length;

  // Number of Data 2
  fullPacket.writeUInt8(1, pOffset++);

  // CRC-16 (placeholder or standard)
  fullPacket.writeUInt32BE(0, pOffset);

  return fullPacket;
}
