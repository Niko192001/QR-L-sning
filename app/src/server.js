const path = require('node:path');
const express = require('express');
const QRCode = require('qrcode');
const { PRIORITIES, positionOf, waitMinutes } = require('./queue');
const { isValidCpr, randomCpr } = require('./fakeCpr');

const PUBLIC = path.join(__dirname, '..', 'public');

function createApp({ store, baseUrl }) {
  const app = express();
  app.use(express.json());

  const patientUrl = (id) => `${baseUrl}/p/${id}`;
  const qrFor = (id) => QRCode.toDataURL(patientUrl(id), { margin: 1, width: 320 });
  const validPriority = (p) => PRIORITIES.some((x) => x.level === p);

  app.get('/api/priorities', (req, res) => res.json(PRIORITIES));

  app.post('/api/patients', async (req, res) => {
    const { cpr } = req.body || {};
    const priority = Number(req.body?.priority);
    if (!isValidCpr(cpr)) return res.status(400).json({ error: 'Ugyldigt CPR-nummer' });
    if (!validPriority(priority)) return res.status(400).json({ error: 'Ugyldig prioritet' });
    const patient = store.addPatient({ cpr: cpr.trim(), priority });
    res.status(201).json({ patient, url: patientUrl(patient.id), qr: await qrFor(patient.id) });
  });

  app.get('/api/patients', (req, res) => {
    const queue = store.listWaiting();
    res.json(
      queue.map((p) => ({
        ...p,
        position: positionOf(queue, p.id),
        waitMinutes: waitMinutes(queue, p.id),
        url: patientUrl(p.id),
      }))
    );
  });

  app.get('/api/patients/:id', (req, res) => {
    const patient = store.getPatient(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patienten findes ikke' });
    const queue = store.listWaiting();
    const waiting = patient.status === 'waiting';
    const wait = waiting ? waitMinutes(queue, patient.id) : 0;
    res.json({
      name: patient.name,
      status: patient.status,
      position: waiting ? positionOf(queue, patient.id) : null,
      waitMinutes: wait,
      delay: waiting ? store.seeWait(patient.id, wait) : null,
    });
  });

  app.get('/api/patients/:id/qr', async (req, res) => {
    if (!store.getPatient(req.params.id)) return res.status(404).json({ error: 'Patienten findes ikke' });
    res.json({ url: patientUrl(req.params.id), qr: await qrFor(req.params.id) });
  });

  app.post('/api/patients/:id/call', (req, res) => {
    if (!store.callIn(req.params.id)) return res.status(404).json({ error: 'Patienten findes ikke' });
    res.json({ ok: true });
  });

  app.post('/api/urgent', (req, res) => {
    const priority = req.body?.priority === undefined ? 1 : Number(req.body.priority);
    if (!validPriority(priority)) return res.status(400).json({ error: 'Ugyldig prioritet' });
    const patient = store.addPatient({ cpr: randomCpr(), priority, reason: req.body?.reason });
    res.status(201).json({ patient });
  });

  app.get('/', (req, res) => res.redirect(302, '/sekretaer'));
  app.get('/sekretaer', (req, res) => res.sendFile(path.join(PUBLIC, 'sekretaer.html')));
  app.get('/p/:id', (req, res) => res.sendFile(path.join(PUBLIC, 'patient.html')));
  app.use(express.static(PUBLIC));

  return app;
}

module.exports = { createApp };
