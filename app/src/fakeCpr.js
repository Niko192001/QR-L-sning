// FAKE CPR-opslag: der slås ikke noget op i CPR-registret.
// Navnet udledes deterministisk af cifrene, så samme CPR altid giver samme navn.

const FIRST = ['Anna', 'Mads', 'Sofie', 'Lars', 'Ida', 'Jens', 'Freja', 'Peter', 'Emma', 'Henrik', 'Karen', 'Ole'];
const LAST = ['Jensen', 'Nielsen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sørensen', 'Rasmussen', 'Jørgensen'];

function digits(cpr) {
  return String(cpr).replace('-', '');
}

function isValidCpr(cpr) {
  return typeof cpr === 'string' && /^(\d{6}-\d{4}|\d{10})$/.test(cpr.trim());
}

function fakeName(cpr) {
  const d = digits(cpr);
  let h = 0;
  for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${FIRST[h % FIRST.length]} ${LAST[Math.floor(h / FIRST.length) % LAST.length]}`;
}

function randomCpr() {
  const pad = (n, l) => String(n).padStart(l, '0');
  const day = 1 + Math.floor(Math.random() * 28);
  const month = 1 + Math.floor(Math.random() * 12);
  const year = Math.floor(Math.random() * 100);
  return `${pad(day, 2)}${pad(month, 2)}${pad(year, 2)}-${pad(Math.floor(Math.random() * 10000), 4)}`;
}

module.exports = { isValidCpr, fakeName, randomCpr };
