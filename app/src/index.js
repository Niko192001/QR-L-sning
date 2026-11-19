const os = require('node:os');
const path = require('node:path');
const { createApp } = require('./server');
const { createStore } = require('./db');

const PORT = Number(process.env.PORT) || 3000;

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}

const baseUrl = process.env.BASE_URL || `http://${lanIp()}:${PORT}`;
const store = createStore(process.env.DB_FILE || path.join(__dirname, '..', 'data.sqlite'));

createApp({ store, baseUrl }).listen(PORT, '0.0.0.0', () => {
  console.log('Skadestue-kø kører');
  console.log(`  Sekretær (computer): http://localhost:${PORT}/sekretaer`);
  console.log(`  Patienter (QR-koder peger på): ${baseUrl}/p/<id>`);
});
