const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, DEFAULT_REASON } = require('../src/db');

const strip = (delays) => delays.map(({ minutes, reason }) => ({ minutes, reason }));

test('en mere akut patient giver forsinkelse til dem bagved', () => {
  const s = createStore(':memory:');
  const x = s.addPatient({ cpr: '0101901234', priority: 3 });
  const y = s.addPatient({ cpr: '0202902345', priority: 4 });
  s.addPatient({ cpr: '0303903456', priority: 1, reason: 'Trafikulykke indbragt' });
  assert.deepEqual(strip(s.delaysFor(x.id)), [{ minutes: 30, reason: 'Trafikulykke indbragt' }]);
  assert.deepEqual(strip(s.delaysFor(y.id)), [{ minutes: 30, reason: 'Trafikulykke indbragt' }]);
  assert.ok(s.delaysFor(x.id)[0].createdAt > 0);
});

test('uden begrundelse bruges standardteksten', () => {
  const s = createStore(':memory:');
  const x = s.addPatient({ cpr: '0101901234', priority: 3 });
  s.addPatient({ cpr: '0303903456', priority: 2 });
  assert.equal(DEFAULT_REASON, 'En mere akut patient er ankommet');
  assert.deepEqual(strip(s.delaysFor(x.id)), [{ minutes: 20, reason: DEFAULT_REASON }]);
});

test('en mindre akut patient giver ingen forsinkelse til dem foran', () => {
  const s = createStore(':memory:');
  const x = s.addPatient({ cpr: '0101901234', priority: 1 });
  s.addPatient({ cpr: '0202902345', priority: 4 });
  assert.deepEqual(s.delaysFor(x.id), []);
});

test('patient med samme prioritet bliver ikke rykket af en senere ankomst', () => {
  const s = createStore(':memory:');
  const x = s.addPatient({ cpr: '0101901234', priority: 3 });
  s.addPatient({ cpr: '0202902345', priority: 3 });
  assert.deepEqual(s.delaysFor(x.id), []);
});

test('callIn fjerner patienten fra køen', () => {
  const s = createStore(':memory:');
  const x = s.addPatient({ cpr: '0101901234', priority: 3 });
  assert.equal(s.listWaiting().length, 1);
  assert.equal(s.callIn(x.id), true);
  assert.equal(s.listWaiting().length, 0);
  assert.equal(s.getPatient(x.id).status, 'called');
  assert.equal(s.callIn('findes-ikke'), false);
  assert.equal(s.getPatient('findes-ikke'), null);
});

test('addPatient returnerer patient med navn, id og status', () => {
  const s = createStore(':memory:');
  const p = s.addPatient({ cpr: '010190-1234', priority: 2 });
  assert.equal(p.id.length, 8);
  assert.equal(p.status, 'waiting');
  assert.equal(p.priority, 2);
  assert.ok(p.name.length > 0);
});

// --- Nedtælling med styret ur ---
const MIN = 60000;
function clocked() {
  let t = 1_000_000;
  const store = createStore(':memory:', { now: () => t });
  return { store, advance: (ms) => (t += ms) };
}
const waitOf = (s, id) => s.listWaiting().find((p) => p.id === id).waitMs;

test('ventetiden tæller ned mens den forreste behandles', () => {
  const { store, advance } = clocked();
  store.addPatient({ cpr: '0101901234', priority: 1 });
  const b = store.addPatient({ cpr: '0202902345', priority: 3 });
  assert.equal(waitOf(store, b.id), 30 * MIN);
  advance(10 * MIN);
  assert.equal(waitOf(store, b.id), 20 * MIN);
  advance(25 * MIN);
  assert.equal(waitOf(store, b.id), 0);
});

test('en skubbet patient beholder den tid der allerede er brugt', () => {
  const { store, advance } = clocked();
  store.addPatient({ cpr: '0101901234', priority: 3 }); // Gul forrest, 15 min
  const x = store.addPatient({ cpr: '0202902345', priority: 4 });
  advance(5 * MIN);
  store.addPatient({ cpr: '0303903456', priority: 1 }); // Rød skubber Gul
  assert.equal(waitOf(store, x.id), 30 * MIN + 10 * MIN);
  advance(10 * MIN);
  assert.equal(waitOf(store, x.id), 20 * MIN + 10 * MIN);
});

test('kald ind før tid starter den næstes nedtælling forfra', () => {
  const { store, advance } = clocked();
  const a = store.addPatient({ cpr: '0101901234', priority: 1 });
  const b = store.addPatient({ cpr: '0202902345', priority: 3 });
  const c = store.addPatient({ cpr: '0303903456', priority: 4 });
  advance(5 * MIN);
  store.callIn(a.id);
  assert.equal(waitOf(store, c.id), 15 * MIN);
  advance(5 * MIN);
  assert.equal(waitOf(store, c.id), 10 * MIN);
  assert.equal(store.listWaiting()[0].id, b.id);
});

test('listWaiting giver position', () => {
  const { store } = clocked();
  store.addPatient({ cpr: '0101901234', priority: 4 });
  store.addPatient({ cpr: '0202902345', priority: 2 });
  assert.deepEqual(store.listWaiting().map((p) => [p.priority, p.position]), [[2, 1], [4, 2]]);
});

test('forsinkelse vises kun ved en ny akut patient, ikke når tiden bare løber over', () => {
  const { store, advance } = clocked();
  store.addPatient({ cpr: '0101901234', priority: 1 });
  const b = store.addPatient({ cpr: '0202902345', priority: 3 });
  assert.equal(store.seeWait(b.id, waitOf(store, b.id)), null);
  advance(45 * MIN); // Rød er overtid, sekretæren har ikke kaldt ind
  assert.equal(store.seeWait(b.id, waitOf(store, b.id)), null);
  store.addPatient({ cpr: '0303903456', priority: 2, reason: 'Alvorlig forbrænding' });
  assert.deepEqual(store.seeWait(b.id, waitOf(store, b.id)), { minutes: 20, reason: 'Alvorlig forbrænding' });
  advance(2 * MIN);
  assert.deepEqual(store.seeWait(b.id, waitOf(store, b.id)), { minutes: 20, reason: 'Alvorlig forbrænding' });
});
