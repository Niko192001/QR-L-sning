const test = require('node:test');
const assert = require('node:assert/strict');
const { etaClock, countdownText } = require('../public/eta');

const at = (h, m) => new Date(2026, 10, 19, h, m, 0);

test('etaClock runder til nærmeste kvarter', () => {
  assert.equal(etaClock(0, at(10, 0)), '10:00');
  assert.equal(etaClock(0, at(10, 7)), '10:00');
  assert.equal(etaClock(0, at(10, 8)), '10:15');
  assert.equal(etaClock(30, at(10, 52)), '11:15');
  assert.equal(etaClock(10, at(23, 50)), '00:00');
});

test('etaClock ændrer sig ikke hvert minut', () => {
  assert.equal(etaClock(30, at(10, 0)), etaClock(30, at(10, 5)));
});

test('countdownText tæller ned minut for minut', () => {
  assert.equal(countdownText(0), 'Det er snart din tur');
  assert.equal(countdownText(1), 'Din tur om 1 min.');
  assert.equal(countdownText(60), 'Din tur om 1 min.');
  assert.equal(countdownText(61), 'Din tur om 2 min.');
  assert.equal(countdownText(36 * 60), 'Din tur om 36 min.');
  assert.equal(countdownText(60 * 60), 'Din tur om 1 t. 0 min.');
  assert.equal(countdownText(96 * 60), 'Din tur om 1 t. 36 min.');
});
