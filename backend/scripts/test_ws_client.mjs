#!/usr/bin/env node
/**
 * test_ws_client.mjs — RudraNetra live-tracking WebSocket smoke test.
 *
 * Logs into the API, opens /ws/tracking with the returned JWT and waits for
 * `{"type":"position","payload":{...}}` broadcasts (run simulate_device.js in
 * another terminal to generate traffic). Exits 0 on success, 1 on timeout.
 *
 * Usage:
 *   node backend/scripts/test_ws_client.mjs
 *   BASE_URL=http://localhost:8080 USERNAME=admin PASSWORD=password \
 *     EXPECT=3 TIMEOUT_MS=30000 node backend/scripts/test_ws_client.mjs
 *
 * Env:
 *   BASE_URL    API origin            (default http://localhost:8080)
 *   USERNAME    login username        (default admin)
 *   PASSWORD    login password        (default password)
 *   EXPECT      position messages to wait for (default 1)
 *   TIMEOUT_MS  overall wait budget   (default 20000)
 *
 * Requires Node 22+ (global fetch + WebSocket). No external dependencies.
 */

import process from 'node:process';
import os from 'node:os';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

// Windows always sets USERNAME to the OS account name, which would shadow the
// documented default. Treat USERNAME as an intentional override only when it
// differs from the OS login name (or use RUDRA_USERNAME explicitly).
let osUser = null;
try {
  osUser = os.userInfo().username;
} catch {
  /* ignore */
}
const envUser = process.env.USERNAME;
const USERNAME =
  process.env.RUDRA_USERNAME ||
  (envUser && envUser !== osUser ? envUser : undefined) ||
  'admin';
const PASSWORD = process.env.RUDRA_PASSWORD || process.env.PASSWORD || 'password';
const EXPECT = Math.max(1, parseInt(process.env.EXPECT || '1', 10) || 1);
const TIMEOUT_MS = Math.max(1000, parseInt(process.env.TIMEOUT_MS || '20000', 10) || 20000);
const MESSAGE_TYPE = process.env.MESSAGE_TYPE || 'position'; // position | alert

const base = new URL(BASE_URL);
const loginUrl = new URL('/api/v1/auth/login', base).toString();

// Derive ws:// (or wss://) from the HTTP base URL.
const wsUrl = new URL('/ws/tracking', base);
wsUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';

console.log('RudraNetra — WebSocket tracking smoke test');
console.log(`  BASE_URL   : ${base.origin}`);
console.log(`  USERNAME   : ${USERNAME}`);
console.log(`  EXPECT     : ${EXPECT} ${MESSAGE_TYPE} message(s)`);
console.log(`  TIMEOUT_MS : ${TIMEOUT_MS}`);
console.log('');

let ws = null;
let timer = null;
let received = 0;
let finished = false;

function finish(code) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  try {
    ws?.close();
  } catch {
    /* already closing */
  }
  // Small grace period so buffered stdout flushes before exiting.
  setTimeout(() => process.exit(code), 50);
}

async function main() {
  console.log(`🔐 Logging in as "${USERNAME}"...`);
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    console.error(`❌ Login failed (HTTP ${res.status})${body.error ? `: ${body.error}` : ''}`);
    process.exit(1);
  }
  const token = body.token;
  console.log(`✅ Logged in as ${body.user?.username ?? USERNAME} (role: ${body.user?.role ?? '?'})`);

  wsUrl.searchParams.set('token', token);
  console.log(`🔌 Connecting to ${wsUrl.origin}${wsUrl.pathname} ...`);

  ws = new WebSocket(wsUrl);

  timer = setTimeout(() => {
    console.error(`❌ Timed out after ${TIMEOUT_MS} ms — received ${received}/${EXPECT} ${MESSAGE_TYPE} message(s).`);
    finish(1);
  }, TIMEOUT_MS);

  ws.onopen = () => {
    console.log(`📡 WebSocket open — waiting for ${EXPECT} "${MESSAGE_TYPE}" message(s)...`);
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
    } catch {
      console.log('⚠️  Ignoring non-JSON WebSocket message.');
      return;
    }
    if (msg.type !== MESSAGE_TYPE || !msg.payload) return; // ignore other event types

    received++;
    const p = msg.payload;
    if (MESSAGE_TYPE === 'alert') {
      console.log(
        `🚨 [${received}/${EXPECT}] alert_id=${p.id} type=${p.type} severity=${p.severity} ` +
        `vehicle=${p.vehicle ?? '—'} message=${p.message ?? '—'}`
      );
    } else {
      console.log(
        `📍 [${received}/${EXPECT}] device_id=${p.device_id} lat=${p.lat} lng=${p.lng} ` +
        `speed=${p.speed} km/h${p.status ? ` status=${p.status}` : ''}`
      );
    }

    if (received >= EXPECT) {
      console.log(`✅ Received ${received} ${MESSAGE_TYPE} message(s) — success.`);
      finish(0);
    }
  };

  ws.onerror = () => {
    console.error('❌ WebSocket error (is the API running and the token valid?).');
    finish(1);
  };

  ws.onclose = (event) => {
    if (!finished) {
      console.error(`❌ WebSocket closed before ${EXPECT} position message(s) arrived (code ${event.code}).`);
      finish(1);
    }
  };
}

main().catch((err) => {
  console.error(`❌ ${err?.message ?? err}`);
  finish(1);
});
