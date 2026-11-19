# kadestuekø – MVP

En webapp, hvor sekretæren opretter patienter med triage-prioritet, og patienten via en QR-kode kan følge sin plads i køen, sin forventede ventetid og begrundelsen, når tiden bliver rykket.

- **Sekretær** bruger en computer: `http://localhost:3000/sekretaer`
- **Patient** bruger sin mobil: scanner QR-koden, som sekretær-siden viser

## Krav

Node.js 22.13 eller nyere. På denne Mac ligger Node i `~/.local/node/bin`. Kør denne linje i terminalen, før du bruger `npm` (eller tilføj den til din `~/.zshrc`):

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

## Installation

```bash
cd app
npm install
```

## Start

```bash
npm start
```

Terminalen viser to adresser:

```
Sekretær (computer): http://localhost:3000/sekretaer
Patienter (QR-koder peger på): http://192.168.x.x:3000/p/<id>
```

## Åbn fra en telefon

1. Computeren og telefonen skal være på **samme Wi-Fi**.
2. QR-koderne peger automatisk på computerens lokale IP-adresse (den anden adresse ovenfor).
3. Scan QR-koden med telefonens kamera.

Hvis telefonen ikke kan åbne siden:

- Tjek at macOS-firewallen tillader indgående forbindelser til Node.
- Skoler og offentlige netværk blokerer ofte trafik mellem enheder. Brug i så fald et mobilt hotspot.
- Du kan selv bestemme adressen i QR-koden: `BASE_URL=http://192.168.1.20:3000 npm start`

## Under testen

1. Opret testpersonen med CPR-nummer (fiktivt, fx `010190-1234`) og en prioritet, fx Gul.
2. Lad testpersonen scanne QR-koden.
3. Brug **Tilføj akut patient** for at skubbe testpersonens tid. Vælg en begrundelse – den vises på testpersonens telefon inden for 5 sekunder.
4. Tryk **Kald ind**, når testpersonen er færdig. Telefonen viser "Det er din tur".
5. Testpersonen udfylder spørgeskemaet (uden for appen).

Data gemmes i `app/data.sqlite`. Slet filen for at starte med en tom kø.

## Konfiguration

| Variabel     | Standard                 | Betydning                     |
| ------------ | ------------------------ | ----------------------------- |
| `PORT`     | `3000`                 | Port                          |
| `BASE_URL` | `http://<LAN-IP>:PORT` | Adressen QR-koderne peger på |
| `DB_FILE`  | `app/data.sqlite`      | Databasefil                   |

Behandlingstid per prioritet rettes i `src/queue.js` (`PRIORITIES`).

## Tests

```bash
npm test
```

Se [ARKITEKTUR.md](ARKITEKTUR.md) for en beskrivelse af systemet.
