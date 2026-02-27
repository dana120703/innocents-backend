# Problem: Takk-siden loader evig ved kansellert Vipps-betaling

## Problemet

Når brukeren **kansellerer betalingen** i Vipps og sendes tilbake til takk-siden (`/takk?orderId=...`), vises «Sjekker betalingsstatus» og **loader uten å stoppe**. Brukeren forblir fast og ser ikke «Betalingen ble ikke fullført».

**Ønsket oppførsel:** Innen noen sekunder skal brukeren enten se «Takk for bestillingen!» (ved betalt) eller «Betalingen ble ikke fullført» (ved kansellert).

---

## Årsak (slik vi forstår det)

1. **Samme returnUrl for alle:** Vipps sender brukeren til samme URL (`/takk?orderId=xxx`) uansett om de betalte eller kansellerte. Vi kan ikke skille ut fra URL alene.
2. **Status må hentes fra Vipps:** For å vite om ordren er betalt eller kansellert må backend spørre Vipps API: `GET /checkout/v3/session/{orderId}`.
3. **Ved kansellering:** Vipps kan returnere **404** eller **tom/ugyldig sesjon** for kansellerte eller lukkede sesjoner. Da får vi ingen `sessionState` å tolke.
4. **Tidligere bug:** Vi tolket tom respons som «pending» og oppdaterte ikke ordren → ordren forble PENDING → frontend poller og får alltid PENDING → evig «Sjekker betalingsstatus».

---

## Løsninger og implementasjoner vi har gjort

### 1. Kun PAID når Vipps bekrefter (ikke bare fordi bruker er på takk-siden)
- **Før:** GET `/orders/{id}` og POST `/orders/{id}/confirm` satte ordre til PAID og sendte billetter så snart noen nådde takk-siden.
- **Etter:** Vi setter kun PAID og sender billetter når Vipps-sesjonen faktisk er betalt (f.eks. `sessionState` = Captured). Ved kansellering sender vi ikke billetter.

### 2. Vipps-sjekk i bakgrunn (rask første respons)
- **Før:** GET `/orders/{id}` ventet på Vipps API (opptil 10 s) før den returnerte → brukeren så lang loading.
- **Etter:** GET returnerer **med en gang** med ordre som PENDING og starter en **bakgrunnsoppgave** som henter Vipps-sesjon og oppdaterer ordre til PAID/CANCELLED/EXPIRED. Frontend får rask respons og poller for oppdatering.

### 3. Tom/404 Vipps-sesjon = kansellert
- **Før:** `get_session_status()` returnerte `{}` ved 404; vi tolket det som «pending» og endret ikke ordre → evig PENDING.
- **Etter:** I bakgrunnsoppgaven: hvis `session` er tom (Vipps ga 404 eller tom respons), setter vi `state = "cancelled"` og oppdaterer ordren til **CANCELLED**. Neste poll gir CANCELLED og frontend viser «Betalingen ble ikke fullført».

### 4. Kortere timeout og raskere polling
- Vipps-kall: timeout **5 sekunder** (tidligere 10).
- Frontend: poller **hvert 1,5. sekund** (tidligere 2,5 s), opptil 10 ganger.

### 5. Webhook: bruk `sessionState` fra Vipps
- Webhook bruker nå også `sessionState` (ikke bare `name`/`event`/`type`) slik at vi gjenkjenner betalt/kansellert selv når Vipps sender det formatet.

### 6. Logging ved 404
- I `get_session_status()`: ved 404 logges det med INFO slik at man i Railway-loggene kan se at sesjonen ble behandlet som kansellert/utløpt.

---

## Oppdatering fra Railway-logg (27. feb 2026)

Loggene viste årsaken:
- **Webhook mottar `PaymentTerminated`** fra Vipps når brukeren kansellerer.
- Vi hadde **ikke** `PaymentTerminated` i `FAILED_EVENTS` → webhooken logget «Event PaymentTerminated ignorert» og endret ikke ordrestatus.
- **GET session returnerer 200** (ikke 404) med sannsynligvis `sessionState: "PaymentTerminated"` – vi hadde ikke den verdien i `SESSION_STATE_CANCELLED`, så vi tolket den som «pending».

**Endring:** `PaymentTerminated` og `Terminated` er lagt til i både webhook (`FAILED_EVENTS` + `status_map`) og i `SESSION_STATE_CANCELLED` i Vipps.py. Da oppdateres ordren til CANCELLED enten ved webhook eller ved bakgrunnssjekk.

---

## Hvis problemet fortsatt oppstår – ting å sjekke

1. **Kjører bakgrunnsoppgaven?**  
   På noen plattformer (f.eks. serverless) kan kode som kjører etter at respons er sendt, avbrytes. På Railway med vanlig uvicorn skal `BackgroundTasks` kjøre. Sjekk loggene: ser du «Vipps sesjon … ikke funnet (404)» eller lignende etter at noen har kansellert?

2. **Får vi 200 med uventet body i stedet for 404?**  
   Hvis Vipps ved kansellering returnerer **200** med en body uten `sessionState` (eller med en verdi vi ikke mapper), vil `get_session_payment_state()` fortsatt gi «pending». Da bør vi:
   - logge rå respons fra Vipps (f.eks. ved `state not in (paid, cancelled, expired)`), og
   - eventuelt tolke «tom state» eller kjente «avbrutt»-verdier som `cancelled`.

3. **CORS / nettverk:**  
   At frontend ikke får oppdatert ordre pga. feil på kall til `/orders/{id}` (CORS eller nettverksfeil). Sjekk Network-fanen i nettleseren ved polling.

4. **Polling stopper for tidlig:**  
   Hvis bakgrunnsoppgaven bruker lengre tid enn (1,5 × 10) sekunder, kan polling ha stoppet før ordren er satt til CANCELLED. Da kan vi øke antall poll eller vente lengre før vi viser «Tilbake / Prøv på nytt» uten å stoppe polling.

---

## Relevante filer

| Fil | Hensikt |
|-----|--------|
| `backend/app/routes.py` | GET `/orders/{id}` (bakgrunnsoppgave), POST `/orders/{id}/confirm`, logikk PAID/CANCELLED |
| `backend/app/Vipps.py` | `get_session_status()`, `get_session_payment_state()`, håndtering av 404/tom |
| `backend/app/webhook.py` | Oppdatering ved Vipps webhook (sessionState m.m.) |
| `app/takk/takk-content.tsx` | Visning av loading, «Sjekker betalingsstatus», suksess og «Betalingen ble ikke fullført»; polling mot GET `/orders/{id}` |
