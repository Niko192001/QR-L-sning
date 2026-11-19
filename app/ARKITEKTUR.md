# Arkitektur – Skadestuekø

## Komponenter

```mermaid
flowchart LR
  subgraph Klienter
    S["Sekretær-UI<br/>(computer)<br/>sekretaer.html/js"]
    P["Patient-UI<br/>(mobil, mobile first)<br/>patient.html/js"]
  end
  subgraph Server["Node.js + Express"]
    API["REST API<br/>server.js"]
    Q["Kø-logik<br/>queue.js<br/>sortering + ventetid"]
    C["Fake CPR-opslag<br/>fakeCpr.js"]
    QR["QR-generator<br/>(qrcode)"]
    DB[("SQLite<br/>patients + delays")]
  end
  S -- "opret / kald ind / akut patient" --> API
  P -- "poll hvert 5. sek." --> API
  API --> Q
  API --> C
  API --> QR
  API --> DB
```

| Komponent | Ansvar |
|---|---|
| **Sekretær-UI** | Opretter patienter, viser QR-kode, viser køen, kalder ind, tilføjer akut patient med begrundelse. |
| **Patient-UI** | Viser plads i køen, forventet ventetid, forsinkelse + begrundelse og "Det er din tur". Opdaterer sig selv hvert 5. sekund. |
| **REST API** | `POST /api/patients`, `GET /api/patients`, `GET /api/patients/:id`, `GET /api/patients/:id/qr`, `POST /api/patients/:id/call`, `POST /api/urgent`, `GET /api/priorities` |
| **Kø-logik** | Sorterer efter triage-prioritet (Rød → Blå) og derefter ankomst. Ventetid = summen af forventet behandlingstid for alle foran. |
| **Fake CPR** | Validerer formatet og giver et opdigtet navn. Der slås ikke noget op. |
| **SQLite** | `patients` (id, cpr, navn, prioritet, ankomst, status, sidst viste ventetid, aktuel forsinkelse) og `delays` (patient, minutter, begrundelse, tidspunkt). |

**Forsinkelser:** Hver gang patienten åbner/opdaterer sin side, sammenlignes den aktuelle ventetid med den sidst viste. Stiger den, vises "udskudt med N min." med den seneste begrundelse. Falder den igen (fx når den akutte patient er kaldt ind), forsvinder beskeden. Første visning viser aldrig en forsinkelse.

## Dataflow: en akut patient skubber en testperson

```mermaid
sequenceDiagram
  actor Sek as Sekretær (computer)
  participant API as Express API
  participant DB as SQLite
  actor Pat as Patient (mobil)

  Sek->>API: POST /api/patients {cpr, prioritet: Gul}
  API->>DB: gem patient
  API-->>Sek: patient + QR-kode (link til /p/<id>)
  Pat->>API: scanner QR → GET /api/patients/<id>
  API-->>Pat: nr. 1, ventetid 00:00
  Sek->>API: POST /api/urgent {prioritet: Rød, begrundelse}
  API->>DB: gem akut patient + forsinkelse for alle med lavere prioritet
  Pat->>API: GET /api/patients/<id> (poll)
  API-->>Pat: nr. 2, ventetid 00:30, "udskudt ca. 30 min. – Trafikulykke indbragt"
  Sek->>API: POST /api/patients/<id>/call
  Pat->>API: GET /api/patients/<id> (poll)
  API-->>Pat: "Det er din tur"
```

## Realiseret vs. designforslag

| Realiseret i MVP'en | Designforslag (ikke bygget) |
|---|---|
| Kø med triage-prioritet og beregnet ventetid | Rigtigt opslag i CPR-registret |
| QR-kode til patientens egen side | Hardware-enhed med lille skærm til patienter uden smartphone |
| Live-opdatering (polling hvert 5. sek.) | Push-notifikation/vibration når det er tæt på ens tur |
| Forsinkelse + begrundelse til patienten | Ventetidsestimat via telefon (1813) |
| Sekretær-side til opsætning og styring | Login/adgangskontrol for personale |
| | Behandlingstider baseret på rigtige data i stedet for faste estimater |
