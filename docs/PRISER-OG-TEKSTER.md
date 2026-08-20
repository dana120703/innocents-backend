# Endre priser og tekster

Kort oppskrift på hvor ting ligger, slik at du slipper å lete.

---

## Priser

Prisene ligger i **databasen**, ikke i koden. Fasiten er
[`backend/update_ticket_types.py`](../backend/update_ticket_types.py) – endre listen `TICKET_TYPES` der og kjør scriptet.

```bash
cd backend
source .venv/bin/activate

python3 update_ticket_types.py            # tørrkjøring – viser hva som endres, lagrer ingenting
python3 update_ticket_types.py --apply    # lagrer
```

For å kjøre mot **produksjon** må `DATABASE_URL` peke på Supabase-databasen
(samme verdi som i Railway). Tørrkjør alltid først.

| Felt | Betydning |
|------|-----------|
| `name` | Navnet kunden ser |
| `price_nok` | Ordinær pris i kroner |
| `campaign_price_nok` | Kampanjepris, gjelder til `CAMPAIGN_ENDS_AT`. `None` = ingen kampanje |
| `capacity` | Antall plasser |
| `is_active` | `False` skjuler billettypen fra salgssiden |
| `rename_from` | Gammelt navn ved omdøping – beholder ID-en så solgte billetter fortsatt kan skannes |

Billettyper som ikke står i listen blir automatisk **skjult**, ikke slettet.
Det er med vilje: allerede solgte billetter må fortsatt kunne slås opp i døra.

### Når kampanjeprisen går ut

Styres av miljøvariabelen `CAMPAIGN_ENDS_AT` (Railway → backend-tjenesten → Variables):

```text
CAMPAIGN_ENDS_AT=2026-09-01T00:00:00+02:00
CAMPAIGN_LABEL=Lanseringspris
```

Uten tidssone tolkes tidspunktet som norsk tid. Når tidspunktet passeres
slår ordinær pris inn **av seg selv** – ingen deploy, ingen manuell endring.
Nedtellingen på billettsiden forsvinner samtidig, og prisen oppdateres for
alle som har siden åpen.

Tom verdi (`CAMPAIGN_ENDS_AT=`) slår av kampanjeprisen helt.

> Prisen regnes alltid ut på serveren, både for visning og for betaling.
> Frontend sender kun billettype og antall – aldri pris. Det er ikke mulig å
> manipulere prisen fra nettleseren.

---

## Tekster

| Hva | Fil |
|-----|-----|
| Arrangementsnavn, dato, klokkeslett, sted, «Om Sami Hamdi» | [`lib/event.ts`](../lib/event.ts) |
| Samme tekster i e-post og i Vipps-betalingen | [`backend/app/event.py`](../backend/app/event.py) |
| Billettsiden ellers (overskrifter, knapper, skjema) | [`app/page.tsx`](../app/page.tsx) |
| Takk-siden etter betaling | [`app/takk/takk-content.tsx`](../app/takk/takk-content.tsx) |
| Skanne-siden (innsjekk i døra) | [`app/skanne/scanner-content.tsx`](../app/skanne/scanner-content.tsx) |
| Billett-e-post med QR | `build_ticket_email()` i [`backend/app/tickets.py`](../backend/app/tickets.py) |
| Fanetittel og Google-beskrivelse | [`app/layout.tsx`](../app/layout.tsx) |

**Klokkeslett og sted** står som `null` i `lib/event.ts` fordi de ikke er
bestemt ennå. Sett inn verdier der, så dukker de opp både på billettsiden og
på takk-siden:

```ts
time: "Kl. 18:00",
venue: "Oslo Kongressenter",
```

`lib/event.ts` og `backend/app/event.py` må holdes like – de brukes på hver
sin side av API-et.

---

## Forhåndsvis billett-e-posten

```bash
cd backend
python3 scripts/send_sample_ticket_email.py din@epost.no
```

Bruker samme mal som den ekte utsendingen, så det du får i innboksen er
nøyaktig det kunden får.
