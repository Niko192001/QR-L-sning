const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');
const { createStore } = require('../src/db');

const BASE = 'http://192.168.1.50:3000';
let server;
let url;

test.beforeEach(async () => {
  const app = createApp({ store: createStore(':memory:'), baseUrl: BASE });
  await new Promise((r) => (server = app.listen(0, r)));
  url = `http://127.0.0.1:${server.address().port}`;
});
test.afterEach(() => server.close());

const post = (path, body) =>
  fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });

test('opret patient giver QR-kode til LAN-adressen', async () => {
  const res = await post('/api/patients', { cpr: '010190-1234', priority: 3 });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.url.startsWith(`${BASE}/p/`));
  assert.ok(body.qr.startsWith('data:image/png;base64,'));
  assert.equal(body.patient.priority, 3);
});

test('ugyldigt CPR giver 400 med dansk fejl', async () => {
  const res = await post('/api/patients', { cpr: 'abc', priority: 3 });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Ugyldigt CPR-nummer');
});

test('ugyldig prioritet giver 400', async () => {
  const res = await post('/api/patients', { cpr: '0101901234', priority: 9 });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Ugyldig prioritet');
});

test('ukendt patient giver 404', async () => {
  const res = await fetch(`${url}/api/patients/nope`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Patienten findes ikke');
});

const view = async (id) => (await fetch(`${url}/api/patients/${id}`)).json();

test('akut patient skubber og patienten ser begrundelsen', async () => {
  const { patient } = await (await post('/api/patients', { cpr: '0101901234', priority: 3 })).json();
  assert.equal((await view(patient.id)).delay, null);
  const urgent = await post('/api/urgent', { reason: 'Patient med hjertestop' });
  assert.equal(urgent.status, 201);
  const s = await view(patient.id);
  assert.equal(s.position, 2);
  assert.equal(s.waitMinutes, 30);
  assert.deepEqual(s.delay, { minutes: 30, reason: 'Patient med hjertestop' });
  assert.equal(s.status, 'waiting');
  assert.deepEqual((await view(patient.id)).delay, s.delay, 'boksen bliver ved polling');
});

test('forsinkelse forsvinder når den akutte patient er kaldt ind', async () => {
  const { patient } = await (await post('/api/patients', { cpr: '0101901234', priority: 3 })).json();
  await view(patient.id);
  const { patient: akut } = await (await post('/api/urgent', { reason: 'Trafikulykke indbragt' })).json();
  assert.equal((await view(patient.id)).delay.minutes, 30);
  await post(`/api/patients/${akut.id}/call`);
  const s = await view(patient.id);
  assert.equal(s.waitMinutes, 0);
  assert.equal(s.delay, null);
});

test('to akutte patienter mellem to visninger giver den samlede forsinkelse', async () => {
  const { patient } = await (await post('/api/patients', { cpr: '0101901234', priority: 3 })).json();
  await view(patient.id);
  await post('/api/urgent', { reason: 'Trafikulykke indbragt' });
  await post('/api/urgent', { reason: 'Alvorlig forbrænding' });
  assert.deepEqual((await view(patient.id)).delay, { minutes: 60, reason: 'Alvorlig forbrænding' });
});

test('første visning viser ingen forsinkelse', async () => {
  const { patient } = await (await post('/api/patients', { cpr: '0101901234', priority: 3 })).json();
  await post('/api/urgent', { reason: 'Trafikulykke indbragt' });
  const s = await view(patient.id);
  assert.equal(s.waitMinutes, 30);
  assert.equal(s.delay, null);
});

test('køliste er sorteret og har ventetid', async () => {
  await post('/api/patients', { cpr: '0101901234', priority: 4 });
  await post('/api/patients', { cpr: '0202902345', priority: 2 });
  const list = await (await fetch(`${url}/api/patients`)).json();
  assert.deepEqual(list.map((p) => [p.priority, p.position, p.waitMinutes]), [[2, 1, 0], [4, 2, 20]]);
});

test('kald ind sætter status called', async () => {
  const { patient } = await (await post('/api/patients', { cpr: '0101901234', priority: 3 })).json();
  assert.equal((await post(`/api/patients/${patient.id}/call`)).status, 200);
  const s = await (await fetch(`${url}/api/patients/${patient.id}`)).json();
  assert.equal(s.status, 'called');
  assert.equal((await post('/api/patients/nope/call')).status, 404);
});

test('QR kan hentes igen for en eksisterende patient', async () => {
  const { patient } = await (await post('/api/patients', { cpr: '0101901234', priority: 3 })).json();
  const body = await (await fetch(`${url}/api/patients/${patient.id}/qr`)).json();
  assert.equal(body.url, `${BASE}/p/${patient.id}`);
  assert.ok(body.qr.startsWith('data:image/png;base64,'));
});

test('prioriteter kan hentes', async () => {
  const list = await (await fetch(`${url}/api/priorities`)).json();
  assert.equal(list.length, 5);
});

test('sider serveres som HTML', async () => {
  for (const path of ['/p/xyz', '/sekretaer']) {
    const res = await fetch(url + path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
  }
  const root = await fetch(`${url}/`, { redirect: 'manual' });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), '/sekretaer');
});
