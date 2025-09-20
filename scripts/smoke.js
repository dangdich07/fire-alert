// Basic E2E smoke test of the API
import assert from 'node:assert';

const BASE = process.env.BASE_URL || 'http://localhost:4000';

async function post(path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text } }
  return { ok: res.ok, status: res.status, data };
}

async function get(path, headers = {}) {
  const res = await fetch(BASE + path, { headers });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text } }
  return { ok: res.ok, status: res.status, data };
}

async function patch(path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text } }
  return { ok: res.ok, status: res.status, data };
}

function rndEmail() {
  const n = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return `smoke${n}@example.com`;
}

async function main() {
  console.log('Health check');
  const health = await get('/');
  assert(health.ok, 'Health not OK');

  const email = rndEmail();
  console.log('Signup', email);
  const signup = await post('/auth/signup', { name: 'Smoke', email, password: 'secret123' });
  assert(signup.ok, 'Signup failed ' + JSON.stringify(signup.data));
  const token = signup.data.token;
  const auth = { Authorization: 'Bearer ' + token };

  console.log('Claim device');
  const claim = await post('/devices', { code: 'D-001', name: 'Sensor 1', location: 'Lab' }, auth);
  assert(claim.ok, 'Claim failed ' + JSON.stringify(claim.data));
  const deviceId = claim.data.device.id;

  console.log('IoT event');
  const evt = await post('/iot/event', { code: 'D-001', type: 'smoke', level: 30, message: 'smoke test' }, { 'x-api-key': process.env.IOT_API_KEY || 'dev-iot-key' });
  assert(evt.ok, 'IoT event failed ' + JSON.stringify(evt.data));

  console.log('List active alerts');
  const alerts = await get('/alerts?active=true', auth);
  assert(alerts.ok, 'List alerts failed');
  const first = alerts.data.alerts[0];
  assert(first, 'No alert found');

  console.log('Ack alert');
  const ack = await patch(`/alerts/${first.id}/ack`, null, auth);
  assert(ack.ok, 'Ack failed');

  console.log('Mark device safe');
  const safe = await patch(`/devices/${deviceId}/mark-safe`, null, auth);
  assert(safe.ok, 'Mark safe failed');

  console.log('Heartbeat');
  const hb = await post('/iot/heartbeat', { code: 'D-001' }, { 'x-api-key': process.env.IOT_API_KEY || 'dev-iot-key' });
  assert(hb.ok, 'Heartbeat failed');

  console.log('✅ Smoke test passed');
}

main().catch((e) => { console.error('❌ Smoke test error', e); process.exit(1); });




