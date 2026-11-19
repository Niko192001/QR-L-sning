const test = require('node:test');
const assert = require('node:assert/strict');
const { sortQueue, waitMs, positionOf, PRIORITIES } = require('../src/queue');
const { isValidCpr, fakeName } = require('../src/fakeCpr');

test('PRIORITIES har de fem triage-farver med behandlingstider', () => {
  assert.deepEqual(
    PRIORITIES.map((p) => [p.level, p.name, p.minutes]),
    [[1, 'Rød', 30], [2, 'Orange', 20], [3, 'Gul', 15], [4, 'Grøn', 10], [5, 'Blå', 10]]
  );
});

test('sortQueue sorterer efter prioritet og derefter ankomsttid', () => {
  const sorted = sortQueue([
    { id: 'a', priority: 3, arrivedAt: 1 },
    { id: 'b', priority: 1, arrivedAt: 2 },
    { id: 'c', priority: 3, arrivedAt: 0 },
  ]);
  assert.deepEqual(sorted.map((p) => p.arrivedAt), [2, 0, 1]);
});

const q = [
  { id: 'c', priority: 4, arrivedAt: 3 },
  { id: 'a', priority: 1, arrivedAt: 1 },
  { id: 'b', priority: 3, arrivedAt: 2 },
];

const MIN = 60000;

test('waitMs summerer behandlingstiden for alle foran', () => {
  assert.equal(waitMs(q, 'a', 0), 0);
  assert.equal(waitMs(q, 'b', 0), 30 * MIN);
  assert.equal(waitMs(q, 'c', 0), 45 * MIN);
});

test('waitMs tæller den forrestes tid ned', () => {
  const live = [
    { id: 'a', priority: 1, arrivedAt: 1, frontSince: 0, servedMs: 0 },
    { id: 'b', priority: 3, arrivedAt: 2, frontSince: null, servedMs: 0 },
    { id: 'c', priority: 4, arrivedAt: 3, frontSince: null, servedMs: 0 },
  ];
  assert.equal(waitMs(live, 'b', 10 * MIN), 20 * MIN);
  assert.equal(waitMs(live, 'c', 10 * MIN), 35 * MIN);
});

test('waitMs går ikke under nul når den forrestes tid er brugt op', () => {
  const live = [
    { id: 'a', priority: 1, arrivedAt: 1, frontSince: 0, servedMs: 0 },
    { id: 'b', priority: 3, arrivedAt: 2, frontSince: null, servedMs: 0 },
  ];
  assert.equal(waitMs(live, 'b', 45 * MIN), 0);
});

test('waitMs trækker allerede brugt tid fra for en patient der blev skubbet', () => {
  const live = [
    { id: 'r', priority: 1, arrivedAt: 3, frontSince: 0, servedMs: 0 },
    { id: 'g', priority: 3, arrivedAt: 1, frontSince: null, servedMs: 5 * MIN },
    { id: 'x', priority: 4, arrivedAt: 2, frontSince: null, servedMs: 0 },
  ];
  assert.equal(waitMs(live, 'x', 0), 30 * MIN + 10 * MIN);
});

test('positionOf er 1-baseret plads i den sorterede kø', () => {
  assert.equal(positionOf(q, 'a'), 1);
  assert.equal(positionOf(q, 'c'), 3);
});

test('isValidCpr accepterer DDMMÅÅ-XXXX og 10 cifre', () => {
  assert.equal(isValidCpr('010190-1234'), true);
  assert.equal(isValidCpr('0101901234'), true);
  assert.equal(isValidCpr('abc'), false);
  assert.equal(isValidCpr('01019012'), false);
  assert.equal(isValidCpr(undefined), false);
});

test('fakeName er deterministisk og ignorerer bindestreg', () => {
  const name = fakeName('0101901234');
  assert.equal(typeof name, 'string');
  assert.ok(name.length > 0);
  assert.equal(fakeName('010190-1234'), name);
});
