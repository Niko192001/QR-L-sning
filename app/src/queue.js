// Ren kø-logik uden I/O.

// Forventet behandlingstid per triage-prioritet (minutter). Ret her for at justere estimaterne.
const PRIORITIES = [
  { level: 1, name: 'Rød', color: '#d62828', minutes: 30 },
  { level: 2, name: 'Orange', color: '#f77f00', minutes: 20 },
  { level: 3, name: 'Gul', color: '#f2c200', minutes: 15 },
  { level: 4, name: 'Grøn', color: '#2a9d4b', minutes: 10 },
  { level: 5, name: 'Blå', color: '#1d6fd1', minutes: 10 },
];

function minutesFor(level) {
  const p = PRIORITIES.find((x) => x.level === level);
  if (!p) throw new Error(`Ukendt prioritet: ${level}`);
  return p.minutes;
}

function sortQueue(patients) {
  return [...patients].sort((a, b) => a.priority - b.priority || a.arrivedAt - b.arrivedAt);
}

function positionOf(patients, id) {
  return sortQueue(patients).findIndex((p) => p.id === id) + 1;
}

function waitMinutes(patients, id) {
  let total = 0;
  for (const p of sortQueue(patients)) {
    if (p.id === id) return total;
    total += minutesFor(p.priority);
  }
  return total;
}

module.exports = { PRIORITIES, minutesFor, sortQueue, positionOf, waitMinutes };
