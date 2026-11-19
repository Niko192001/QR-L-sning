# Skadestue-kø MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En kørende webapp hvor en sekretær opretter patienter med triage-prioritet, og patienten via QR-kode ser sin plads i køen, forventet ventetid og begrundelse når tiden rykkes.

**Architecture:** Express-server med REST API og SQLite (én fil). Ren kø-logik i ét modul uden I/O. Statisk HTML/CSS/JS-frontend, som poller API'et hvert 5. sekund.

**Tech Stack:** Node.js v26 (installeret i `~/.local/node`; kør med `export PATH="$HOME/.local/node/bin:$PATH"`), Express, `node:sqlite` (indbygget, ingen native build), `qrcode`, `node --test` + indbygget `fetch` til tests.

**Spec:** `prompt.md` (godkendt af gruppen 2026-11-19)

## Global Constraints

- Byg KUN det, der står i spec'en. Ingen login, ingen rigtig CPR, ingen hardware, ingen notifikationer, ingen testgrupper.
- Al brugerflade-tekst på dansk.
- Prioriteter: Rød (1), Orange (2), Gul (3), Grøn (4), Blå (5).
- Behandlingstid per prioritet i én konstant: `{1: 30, 2: 20, 3: 15, 4: 10, 5: 10}` minutter.
- Kø-sortering: prioritet stigende, derefter ankomsttid stigende.
- Ventetid = sum af behandlingstid for alle ventende patienter foran.
- Patient-siden poller hvert 5. sekund.
- Ingen frontend-framework.
- Alt kode i `app/`. Ingen git-commits, medmindre brugeren beder om det.

## Review Focus

- Ukendt patient-id i `/p/<id>` → venlig dansk fejlbesked, ikke en crash (test i Task 3).
- Ugyldigt CPR-format → 400 med dansk fejlbesked; sekretær-siden viser den (test i Task 3).
- "Tilføj akut patient" uden begrundelse → standardbegrundelsen "En mere akut patient er ankommet" (test i Task 1).
- En ny patient med LAVERE prioritet må ikke give "udskudt" til patienter foran den (test i Task 1).
- QR-koden skal pege på maskinens LAN-IP, ikke `localhost`, ellers virker den ikke fra en telefon (test i Task 3: `baseUrl` med IP bruges i QR-URL'en).

---

### Task 1: Kø-logik og database

**Files:**
- Create: `app/package.json` (scripts: `start: node src/index.js`, `test: node --test`; deps: `express`, `qrcode`)
- Create: `app/src/queue.js`, `app/src/fakeCpr.js`, `app/src/db.js`
- Test: `app/test/queue.test.js`, `app/test/db.test.js`

**Interfaces:**
- Produces:
  - `queue.js`: `PRIORITIES` (array af `{level, name, color, minutes}`), `sortQueue(patients) -> patients[]`, `waitMinutes(patients, id) -> number`, `positionOf(patients, id) -> number` (1-baseret).
  - `fakeCpr.js`: `isValidCpr(str) -> boolean` (accepterer `DDMMÅÅ-XXXX` eller 10 cifre), `fakeName(cpr) -> string` (deterministisk navn ud fra cifrene).
  - `db.js`: `createStore(filename)` (`':memory:'` i tests) som returnerer `{ addPatient({cpr, priority, reason}) -> patient, listWaiting() -> patient[], getPatient(id) -> patient|null, callIn(id) -> boolean, delaysFor(id) -> {minutes, reason, createdAt}[] }`.
  - Patient-objekt: `{ id, cpr, name, priority, arrivedAt, status: 'waiting'|'called' }`. `id` er en kort tilfældig streng (8 tegn).

**My call:** I stedet for at gemme "sidst viste ventetid" registrerer `addPatient` en forsinkelsesrække (`delays`-tabellen) for hver ventende patient, der havner BAG den nye patient: `minutes` = den nye patients behandlingstid, `reason` = den givne begrundelse eller standardteksten. Det giver præcis "udskudt med N min. + begrundelse" uden at være afhængig af, hvornår patienten sidst kiggede.

- [ ] **Step 1: Skriv fejlende tests**

`queue.test.js`:
- `sortQueue` sorterer `[{priority:3,arrivedAt:1},{priority:1,arrivedAt:2},{priority:3,arrivedAt:0}]` til arrivedAt-rækkefølgen `[2,0,1]`.
- `waitMinutes`: for køen Rød(a), Gul(b), Grøn(c) gælder `waitMinutes(q,'a')===0`, `waitMinutes(q,'b')===30` og `waitMinutes(q,'c')===45`.
- `positionOf(q,'c')===3`.
- `isValidCpr('010190-1234')`, `isValidCpr('0101901234')` er true. `isValidCpr('abc')` og `isValidCpr('01019012')` er false.
- `fakeName('0101901234') === fakeName('010190-1234')` og er en ikke-tom streng.

`db.test.js`:
- Når Gul(x) og Grøn(y) findes og Rød tilføjes med reason `'Trafikulykke indbragt'`, så giver `delaysFor(x)` `[{minutes:30, reason:'Trafikulykke indbragt'}]` (ud over `createdAt`), og det samme gælder for y.
- Uden reason er begrundelsen `'En mere akut patient er ankommet'`.
- Når Rød(x) findes og Grøn(z) tilføjes, så er `delaysFor(x)` tom.
- `callIn(x)` fjerner x fra `listWaiting()`, `getPatient(x).status==='called'`, og `callIn('findes-ikke')===false`.

- [ ] **Step 2:** `cd app && npm install && npm test` → FAIL (moduler mangler)
- [ ] **Step 3:** Implementér modulerne. `db.js` bruger `DatabaseSync` fra `node:sqlite` med tabellerne `patients` og `delays`.
- [ ] **Step 4:** `npm test` → alle tests PASS

### Task 2: REST API og server

**Files:**
- Create: `app/src/server.js`, `app/src/index.js`
- Test: `app/test/api.test.js`

**Interfaces:**
- Consumes: alt fra Task 1.
- Produces: `createApp({ store, baseUrl }) -> express app`. Routes:
  - `POST /api/patients` body `{cpr, priority}` → 201 `{ patient, url, qr }` (`url` = `${baseUrl}/p/${id}`, `qr` = PNG data-URL fra `qrcode.toDataURL`). Ugyldigt CPR → 400 `{error:'Ugyldigt CPR-nummer'}`. Ugyldig prioritet (ikke 1–5) → 400 `{error:'Ugyldig prioritet'}`.
  - `GET /api/patients` → `[{...patient, position, waitMinutes, url}]` sorteret.
  - `GET /api/patients/:id` → `{ name, status, position, waitMinutes, delays:[...], latestDelay|null, totalDelayMinutes }`. Ukendt → 404 `{error:'Patienten findes ikke'}`.
  - `GET /api/patients/:id/qr` → `{ url, qr }`.
  - `POST /api/patients/:id/call` → 200 `{ok:true}`. Ukendt → 404.
  - `POST /api/urgent` body `{priority?=1, reason?}` → opretter en patient med et opdigtet gyldigt CPR + reason → 201 `{ patient }`.
  - `GET /api/priorities` → `PRIORITIES`.
  - Statiske filer fra `app/public`. `/sekretaer` → `sekretaer.html`, `/p/:id` → `patient.html`, `/` → redirect til `/sekretaer`.
- `index.js`: lytter på `0.0.0.0:${PORT||3000}`, `baseUrl` = `process.env.BASE_URL` ellers `http://<første ikke-interne IPv4>:<port>`, DB-fil `app/data.sqlite`. Udskriver begge URL'er ved start.

- [ ] **Step 1: Skriv fejlende tests** i `api.test.js`. De starter `createApp({store:createStore(':memory:'), baseUrl:'http://192.168.1.50:3000'})` på port 0 og bruger `fetch`:
  - POST med gyldigt CPR + prioritet 3 → 201, `url` starter med `http://192.168.1.50:3000/p/`, og `qr` starter med `data:image/png;base64,`.
  - POST med CPR `'abc'` → 400, `error==='Ugyldigt CPR-nummer'`. Prioritet 9 → 400.
  - GET `/api/patients/nope` → 404.
  - Gul oprettes, derefter `POST /api/urgent {reason:'Patient med hjertestop'}` → GET Gul viser `position===2`, `waitMinutes===30` og `latestDelay.reason==='Patient med hjertestop'`.
  - `POST /api/patients/:id/call` → GET viser `status==='called'`.
  - GET `/p/xyz` og `/sekretaer` → 200 HTML.
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** Implementér `server.js` og `index.js`.
- [ ] **Step 4:** `npm test` → PASS

### Task 3: Frontend (sekretær + patient)

**Files:**
- Create: `app/public/style.css`, `app/public/sekretaer.html`, `app/public/sekretaer.js`, `app/public/patient.html`, `app/public/patient.js`

**Interfaces:**
- Consumes: API'et fra Task 2.

Sekretær-side:
- En formular (CPR + prioritet-dropdown med farver) → viser QR + link til den nye patient.
- Køtabel (position, navn, prioritetsfarve, ventetid, knapperne "Kald ind" og "Vis QR"), opdateres hvert 5. sekund.
- Sektionen "Tilføj akut patient": prioritet (standard Rød), dropdown med "Trafikulykke indbragt", "Patient med hjertestop", "Alvorlig forbrænding" og "Anden…" (fritekst).
- Fejl fra API'et vises i rødt.

Patient-side (mobil først):
- "Du er nr. X i køen" (stort) og "Din forventede ventetid er ca. HH:MM", formateret som timer:minutter (fx 45 → `00:45`).
- Hvis der er en `latestDelay`: en gul boks med "Din tid er udskudt med ca. N min." og begrundelsen.
- Status `called` → en stor grøn boks med "Det er din tur – gå til skranken".
- 404 → "Vi kan ikke finde din plads i køen. Henvend dig i skranken."
- FAQ nederst ("Hvorfor bliver jeg rykket?" → mere akutte patienter behandles først. "Hvordan regnes min ventetid ud?" → ud fra hvor akutte patienterne foran dig er).
- Polling hvert 5. sekund.

- [ ] **Step 1:** Implementér filerne.
- [ ] **Step 2:** `npm start` og åbn `/sekretaer` i en headless browser. Opret 2 patienter, tilføj en akut patient, og åbn den ene patients `/p/<id>`. Forventet: ingen konsolfejl, patient-siden viser nr. 2, ventetid og den gule forsinkelsesboks. Efter "Kald ind" viser den "Det er din tur".

### Task 4: README og arkitekturbeskrivelse

**Files:**
- Create: `app/README.md` (installation med `npm install`, start med `npm start`, adgang fra telefon på samme Wi-Fi via den udskrevne LAN-URL, og at Node ligger i `~/.local/node/bin`)
- Create: `app/ARKITEKTUR.md` (komponenter: Sekretær-UI, Patient-UI, Express API, kø-logik, SQLite, QR-generator, fake CPR. Dataflow som en Mermaid-sekvens for "opret → scan → akut patient → patient ser forsinkelse". Hvad der er realiseret, og hvad der er designforslag: CPR-integration og hardware)

- [ ] **Step 1:** Skriv filerne.
- [ ] **Step 2:** Følg README'en fra en ren `npm install` → serveren starter og udskriver URL'erne.
