Du skal bygge en fungerende MVP-webapp til et skoleprojekt (IT-arkitektur, Innovation, Sprint 3: Build · Test · Learn). Byg KUN det, der står her. Ingen ekstra features.

## Baggrund
Challenge: "Hvordan forkorter vi ventetiden på skadestuerne?"
Målgruppe: den offentlige sektor (danske skadestuer).
Kritisk hypotese: "Hvis man er forberedt på, hvor lang tid man skal vente, er man mere villig til at gøre det."
Appen skal bruges i en brugertest. Bagefter udfylder testpersonerne et spørgeskema (spørgeskemaet er IKKE en del af appen).

## Brugere
1. Patient: scanner en QR-kode og får et klart overblik over sin plads i køen og sin forventede ventetid.
2. Sekretær: opretter patienter, sætter deres akut-prioritet og styrer køen. Systemet skal være nemt at sætte op og dynamisk.

## Funktioner (MVP)

### Sekretær-side (/sekretaer)
- Opret patient: CPR-nummer + akut-prioritet.
  - CPR-opslag er FAKE: vis bare et opdigtet navn ud fra CPR-nummeret. Der skal ikke laves noget rigtigt opslag eller nogen validering ud over formatet.
- Prioriteter (dansk triage-farver): Rød (1, mest akut), Orange (2), Gul (3), Grøn (4), Blå (5).
- Når en patient er oprettet, vises en QR-kode, der linker til patientens egen side (/p/<id>). Patienten scanner den med sin egen telefon.
- Liste over køen, sorteret efter prioritet og derefter ankomsttid.
- Knap "Kald ind": fjerner patienten fra køen.
- Knap "Tilføj akut patient": tilføjer hurtigt en opdigtet patient med høj prioritet, så de andre patienter bliver skubbet tilbage. Sekretæren vælger en opdigtet begrundelse fra en kort liste (fx "Trafikulykke indbragt", "Patient med hjertestop", "Alvorlig forbrænding") eller skriver sin egen.

### Patient-side (/p/<id>) – mobilvenlig
- Stort nummer: "Du er nr. X i køen".
- Forventet ventetid: "Din forventede ventetid er ca. HH:MM".
- Når tiden bliver rykket: tydelig besked "Din tid er udskudt med ca. N min." + begrundelsen.
- Siden opdaterer sig selv automatisk (polling hvert 5. sekund er fint).
- Når patienten bliver kaldt ind: "Det er din tur – gå til skranken".
- En kort FAQ nederst ("Hvorfor bliver jeg rykket?" → mere akutte patienter behandles først).

## Beregning af ventetid
- Køen sorteres efter prioritet (1 først) og derefter ankomsttid.
- Patientens ventetid = summen af den forventede behandlingstid for alle patienter foran i køen.
- Forventet behandlingstid per prioritet er konfigurerbar i én konstant, fx Rød 30, Orange 20, Gul 15, Grøn 10, Blå 10 minutter.
- Gem den sidst viste ventetid per patient, så systemet kan opdage, når tiden stiger, og vise "udskudt med N min." + den seneste begrundelse.

## Arkitektur
- Backend: Node.js + Express med et lille REST API:
  - POST /api/patients (opret)
  - GET /api/patients (kø til sekretær)
  - GET /api/patients/:id (status til patient)
  - POST /api/patients/:id/call (kald ind)
  - POST /api/urgent (tilføj akut patient + begrundelse)
- Database: SQLite (én fil), tabeller for patienter og hændelser (begrundelser for forsinkelser).
- Frontend: almindelig HTML/CSS/JavaScript serveret af Express. Ingen frontend-framework.
- QR-kode: genereres med en npm-pakke (fx "qrcode") ud fra appens URL, så den virker på telefoner på samme netværk.
- Ingen login, ingen rigtig CPR-integration, ingen hardware, ingen notifikationer ud over skærmen.

## Leverance
- Fuld kildekode + README med:
  1. installation (npm install)
  2. start (npm start)
  3. hvordan man åbner appen fra en telefon på samme Wi-Fi (brug maskinens lokale IP)
- Kort beskrivelse af arkitekturen (komponenter + dataflow), som kan bruges i præsentationens afsnit "Backend & Architecture".
- Brugerflade på dansk. Enkelt, roligt og overskueligt design.
