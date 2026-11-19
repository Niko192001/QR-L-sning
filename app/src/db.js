const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const { sortQueue, minutesFor } = require('./queue');
const { fakeName } = require('./fakeCpr');

const DEFAULT_REASON = 'En mere akut patient er ankommet';

function createStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      cpr TEXT NOT NULL,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL,
      arrived_at INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      last_wait INTEGER,
      delay_minutes INTEGER,
      delay_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS delays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL REFERENCES patients(id),
      minutes INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  const toPatient = (r) =>
    r && { id: r.id, cpr: r.cpr, name: r.name, priority: r.priority, arrivedAt: r.seq, status: r.status };

  function listWaiting() {
    const rows = db.prepare(`SELECT * FROM patients WHERE status = 'waiting'`).all();
    return sortQueue(rows.map(toPatient));
  }

  function getPatient(id) {
    return toPatient(db.prepare('SELECT * FROM patients WHERE id = ?').get(id)) || null;
  }

  function addPatient({ cpr, priority, reason }) {
    const id = crypto.randomBytes(6).toString('base64url').slice(0, 8);
    const now = Date.now();
    const { next } = db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM patients').get();
    const minutes = minutesFor(priority);
    const text = (reason && String(reason).trim()) || DEFAULT_REASON;

    // Alle ventende patienter med lavere akuthed havner bag den nye patient og bliver forsinket.
    const pushedBack = listWaiting().filter((p) => p.priority > priority);

    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO patients (id, cpr, name, priority, arrived_at, seq) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, cpr, fakeName(cpr), priority, now, next);
      const ins = db.prepare('INSERT INTO delays (patient_id, minutes, reason, created_at) VALUES (?, ?, ?, ?)');
      for (const p of pushedBack) ins.run(p.id, minutes, text, now);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return getPatient(id);
  }

  function callIn(id) {
    return db.prepare(`UPDATE patients SET status = 'called' WHERE id = ? AND status = 'waiting'`).run(id).changes > 0;
  }

  function delaysFor(id) {
    return db
      .prepare('SELECT minutes, reason, created_at AS createdAt FROM delays WHERE patient_id = ? ORDER BY id')
      .all(id)
      .map((r) => ({ minutes: r.minutes, reason: r.reason, createdAt: r.createdAt }));
  }

  // Sammenligner patientens aktuelle ventetid med den sidst viste.
  // Stiger den: forsinkelsen vokser med stigningen, og den seneste begrundelse vises.
  // Falder den: forsinkelsen er ikke længere relevant og ryddes.
  // Første visning: der er intet at sammenligne med, så der vises ingen forsinkelse.
  function seeWait(id, current) {
    const row = db.prepare('SELECT last_wait, delay_minutes, delay_reason FROM patients WHERE id = ?').get(id);
    if (!row) return null;
    const save = (minutes, reason) =>
      db.prepare('UPDATE patients SET last_wait = ?, delay_minutes = ?, delay_reason = ? WHERE id = ?')
        .run(current, minutes, reason, id);

    if (row.last_wait === null || current < row.last_wait) {
      save(null, null);
      return null;
    }
    if (current > row.last_wait) {
      const minutes = (row.delay_minutes || 0) + (current - row.last_wait);
      const reason = delaysFor(id).at(-1)?.reason || DEFAULT_REASON;
      save(minutes, reason);
      return { minutes, reason };
    }
    return row.delay_minutes ? { minutes: row.delay_minutes, reason: row.delay_reason } : null;
  }

  return { addPatient, listWaiting, getPatient, callIn, delaysFor, seeWait };
}

module.exports = { createStore, DEFAULT_REASON };
