# Admin-siden

Oversikt over alle bestillinger: navn, e-post, telefon, hva som er kjøpt, beløp,
status og dato. Ligger på `/admin` – altså `https://billetter.innocents.no/admin`.

---

## Sette opp passordet

Passordet ligger **aldri** i koden. Det settes som miljøvariabel i Railway,
lagret som hash slik at selve passordet ikke kan leses ut igjen.

**1. Lag hashen lokalt:**

```bash
cd backend
source .venv/bin/activate
python3 scripts/lag_admin_passord.py
```

Passordet skrives skjult og lagres ingen steder – hverken i filer eller i
shell-historikken. Du får ut én linje.

**2. Lim den inn i Railway** → backend-tjenesten → **Variables**:

```text
ADMIN_PASSWORD_HASH=pbkdf2_sha256$240000$...$...
ADMIN_SECRET=<en lang tilfeldig streng>
```

`ADMIN_SECRET` er nøkkelen innloggingstokenene signeres med. Lag en med:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Utelater du den, brukes `VIPPS_WEBHOOK_SECRET` som reserve – det virker, men da
blir alle innlogginger ugyldige hvis du bytter webhook-nøkkelen.

**3. Brukernavn** er `admin` som standard. Endre med `ADMIN_USERNAME`.

Etter at variablene er lagret, redeploy backend-tjenesten.

> `ADMIN_PASSWORD` (klartekst) finnes som reserve for lokal testing. Den virker,
> men logger en advarsel ved hver innlogging. Bruk hash i produksjon.

---

## Bytte passord

Kjør `lag_admin_passord.py` på nytt og erstatt `ADMIN_PASSWORD_HASH` i Railway.
Alle som er logget inn beholder tilgangen til tokenen utløper (12 timer). Vil du
kaste ut alle med én gang, bytt `ADMIN_SECRET` samtidig.

---

## Sikkerhet

| | |
|---|---|
| Passordlagring | PBKDF2-SHA256, 240 000 iterasjoner, tilfeldig salt |
| Innlogging | Gir en HMAC-signert token som utløper etter 12 timer |
| Token lagres | I `sessionStorage` – forsvinner når fanen lukkes |
| Brute force | Maks 10 mislykkede forsøk per IP per 15 minutter |
| Søkemotorer | Siden er merket `noindex, nofollow` |
| Logging | Både vellykkede og mislykkede innlogginger logges med IP i Railway |

Siden viser personopplysninger om kjøpere. Del ikke passordet i chat, e-post
eller meldinger – og bytt det hvis det har vært delt.

---

## Endepunkter

| Metode | URL | Krever token |
|--------|-----|--------------|
| POST | `/admin/login` | Nei |
| GET | `/admin/orders` | Ja (`Authorization: Bearer <token>`) |

---

## Lokal testing

`backend/.env` har et lokalt testpassord satt opp (står i kommentaren i filen).
Start backend og frontend som vanlig, og gå til `http://localhost:3000/admin`.

Er det ingen bestillinger å se, lag noen ved å kjøpe billetter lokalt – eller
tøm testdata med `python3 clear_db.py`.
