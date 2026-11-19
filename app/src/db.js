const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const { sortQueue, minutesFor, waitMs } = require('./queue');
const { fakeName } = require('./fakeCpr');

const DEFAULT_REASON = 'En mere akut patient er ankommet';
// En stigning i det forventede tidspunkt under dette tæller ikke som en forsinkelse.
const DELAY_THRESHOLD_MS = 60000;

// Kolonner tilføjet efter første version; tilføjes til en eksisterende databasefil.
const LATER_COLUMNS = {
  front_since: 'INTEGER',
  served_ms: 'INTEGER NOT NULL DEFAULT 0',
  last_eta: 'INTEGER',
  last_delay_id: 'INTEGER',
  delay_minutes: 'INTEGER',
  delay_reason: 'TEXT',
};

function createStore(filename, { now = Date.now } = {}) {
  const db = new DatabaseSync(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      cpr TEXT NOT NULL,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL,
      arrived_at INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting'
    );
    CREATE TABLE IF NOT EXISTS delays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL REFERENCES patients(id),
      minutes INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  const existing = new Set(db.prepare('PRAGMA table_info(patients)').all().map((c) => c.name));
  for (const [col, type] of Object.entries(LATER_COLUMNS)) {
    if (!existing.has(col)) db.exec(`ALTER TABLE patients ADD COLUMN ${col} ${type}`);
  }

  const toPatient = (r) =>
    r && {
      id: r.id,
      cpr: r.cpr,
      name: r.name,
      priority: r.priority,
      arrivedAt: r.seq,
      status: r.status,
      frontSince: r.front_since,
      servedMs: r.served_ms,
    };

  const waitingRows = () =>
    sortQueue(db.prepare(`SELECT * FROM patients WHERE status = 'waiting'`).all().map(toPatient));

  // Sørger for at kun den forreste patients nedtælling løber.
  // En patient der bliver skubbet væk fra forrest, gemmer den tid der allerede er brugt.
  function syncFront(t) {
    const queue = waitingRows();
    const pause = db.prepare('UPDATE patients SET served_ms = served_ms + ?, front_since = NULL WHERE id = ?');
    queue.forEach((p, i) => {
      if (i > 0 && p.frontSince != null) pause.run(t - p.frontSince, p.id);
    });
    if (queue[0] && queue[0].frontSince == null) {
      db.prepare('UPDATE patients SET front_since = ? WHERE id = ?').run(t, queue[0].id);
    }
  }

  // Ventende patienter i kø-rækkefølge med position og ventetid i ms.
  function listWaiting() {
    const t = now();
    syncFront(t);
    const queue = waitingRows();
    return queue.map((p, i) => ({ ...p, position: i + 1, waitMs: waitMs(queue, p.id, t) }));
  }

  function getPatient(id) {
    return toPatient(db.prepare('SELECT * FROM patients WHERE id = ?').get(id)) || null;
  }

  function addPatient({ cpr, priority, reason }) {
    const id = crypto.randomBytes(6).toString('base64url').slice(0, 8);
    const t = now();
    const { next } = db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM patients').get();
    const minutes = minutesFor(priority);
    const text = (reason && String(reason).trim()) || DEFAULT_REASON;

    syncFront(t);
    // Alle ventende patienter med lavere akuthed havner bag den nye patient og bliver forsinket.
    const pushedBack = waitingRows().filter((p) => p.priority > priority);

    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO patients (id, cpr, name, priority, arrived_at, seq) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, cpr, fakeName(cpr), priority, t, next);
      const ins = db.prepare('INSERT INTO delays (patient_id, minutes, reason, created_at) VALUES (?, ?, ?, ?)');
      for (const p of pushedBack) ins.run(p.id, minutes, text, t);
      syncFront(t);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return getPatient(id);
  }

  function callIn(id) {
    const ok =
      db.prepare(`UPDATE patients SET status = 'called', front_since = NULL WHERE id = ? AND status = 'waiting'`)
        .run(id).changes > 0;
    if (ok) syncFront(now());
    return ok;
  }

  function delaysFor(id) {
    return db
      .prepare('SELECT minutes, reason, created_at AS createdAt FROM delays WHERE patient_id = ? ORDER BY id')
      .all(id)
      .map((r) => ({ minutes: r.minutes, reason: r.reason, createdAt: r.createdAt }));
  }

  // Sammenligner patientens forventede tidspunkt (nu + ventetid) med det sidst viste.
  // - Første visning: intet at sammenligne med, ingen forsinkelse.
  // - Senere tidspunkt OG en ny akut patient siden sidst: forsinkelsen vokser, seneste begrundelse vises.
  // - Tidligere tidspunkt (fx den akutte er kaldt ind): forsinkelsen ryddes.
  // - Ellers (tiden løber bare): forsinkelsen bliver stående.
  function seeWait(id, currentWaitMs) {
    const row = db.prepare('SELECT last_eta, last_delay_id, delay_minutes, delay_reason FROM patients WHERE id = ?').get(id);
    if (!row) return null;
    const eta = now() + currentWaitMs;
    const fresh = db.prepare('SELECT id, reason FROM delays WHERE patient_id = ? AND id > ? ORDER BY id')
      .all(id, row.last_delay_id ?? 0);
    const lastDelayId = fresh.length ? fresh.at(-1).id : row.last_delay_id ?? 0;

    let minutes = row.delay_minutes;
    let reason = row.delay_reason;
    if (row.last_eta === null || eta < row.last_eta - DELAY_THRESHOLD_MS) {
      minutes = null;
      reason = null;
    } else if (fresh.length && eta > row.last_eta + DELAY_THRESHOLD_MS) {
      minutes = (minutes || 0) + Math.round((eta - row.last_eta) / 60000);
      reason = fresh.at(-1).reason;
    }

    db.prepare('UPDATE patients SET last_eta = ?, last_delay_id = ?, delay_minutes = ?, delay_reason = ? WHERE id = ?')
      .run(eta, lastDelayId, minutes, reason, id);
    return minutes ? { minutes, reason } : null;
  }

  return { addPatient, listWaiting, getPatient, callIn, delaysFor, seeWait };
}

module.exports = { createStore, DEFAULT_REASON };
