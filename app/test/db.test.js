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
