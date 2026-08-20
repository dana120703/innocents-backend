#!/usr/bin/env python3
"""
Fasit for billettyper – navn, pris og kapasitet.

Dette er det ENESTE stedet billettypene defineres. Frontend henter alt fra
GET /ticket-types, så du trenger ikke endre noe i Next.js-koden når priser
eller navn endres.

Bruk:
    python3 update_ticket_types.py            # tørrkjøring: viser hva som VILLE blitt endret
    python3 update_ticket_types.py --apply    # skriver endringene til databasen

Kjør fra backend-mappen med DATABASE_URL satt (f.eks. i .env), eller mot
produksjons-DB ved å sette DATABASE_URL til Railway/Supabase-URL-en.

Endre pris:      juster "price_nok" (ordinær pris) under.
Kampanjepris:    "campaign_price_nok" gjelder frem til CAMPAIGN_ENDS_AT (settes i
                 app/config.py eller som miljøvariabel i Railway). Etter det
                 tidspunktet slår ordinær pris inn av seg selv – ingen deploy.
                 Sett til None for å fjerne kampanjeprisen.
Endre navn:      sett "rename_from" til det gamle navnet, og "name" til det nye.
                 Da beholdes billettype-ID-en, så allerede solgte billetter
                 fortsatt peker på riktig type.
Skjul en type:   sett "is_active": False (raden slettes aldri – solgte billetter
                 må fortsatt kunne slås opp ved skanning i døra).
"""
import sys

from app.db import SessionLocal, engine
from app.models import Base, TicketType
from app.pricing import campaign_ends_at, campaign_is_active


# ─── Fasit: endre priser, navn og kapasitet her ──────────────────────────────

TICKET_TYPES = [
    {
        # Sami Hamdi, 29. november. Lanseringspris 75 kr frem til 1. september,
        # deretter ordinær pris 250 kr.
        #
        # Dette er en NY billettype, ikke den gamle omdøpt: billettypene fra
        # forrige arrangement har sold_count fra den gang, og det nye
        # arrangementet skal starte på 0 solgte.
        "name": "Billett",
        "price_nok": 250,
        "campaign_price_nok": 75,
        "capacity": 500,
        "is_active": True,
        "rename_from": None,
    },
    # Billettypene fra forrige arrangement står ikke her. De blir automatisk satt
    # til skjult (DEACTIVATE_MISSING) og beholdes i databasen, slik at billetter
    # som allerede er solgt fortsatt kan slås opp ved skanning i døra.
]

# Skal billettyper som IKKE står i listen over skjules (is_active=False)?
DEACTIVATE_MISSING = True


# ─── Selve synkroniseringen ──────────────────────────────────────────────────

def sync_ticket_types(db, apply: bool) -> list[str]:
    """Oppdaterer DB til å matche TICKET_TYPES. Returnerer liste med endringer."""
    changes: list[str] = []
    handled_ids: set[str] = set()

    for spec in TICKET_TYPES:
        lookup = spec.get("rename_from") or spec["name"]
        tt = db.query(TicketType).filter(TicketType.name == lookup).first()

        # Ved omdøping: hvis det gamle navnet er borte, prøv det nye (scriptet er kjørt før).
        if tt is None and spec.get("rename_from"):
            tt = db.query(TicketType).filter(TicketType.name == spec["name"]).first()

        if tt is None:
            kampanje = spec.get("campaign_price_nok")
            changes.append(
                f"NY      {spec['name']}: {spec['price_nok']} kr"
                + (f" (kampanje {kampanje} kr)" if kampanje is not None else "")
                + f", {spec['capacity']} plasser"
            )
            if apply:
                db.add(TicketType(
                    name=spec["name"],
                    price_nok=spec["price_nok"],
                    campaign_price_nok=kampanje,
                    capacity=spec["capacity"],
                    sold_count=0,
                    is_active=spec["is_active"],
                ))
            continue

        handled_ids.add(tt.id)
        sold = tt.sold_count or 0

        if tt.name != spec["name"]:
            changes.append(f"NAVN    «{tt.name}» → «{spec['name']}»")
            if apply:
                tt.name = spec["name"]

        if tt.price_nok != spec["price_nok"]:
            changes.append(f"PRIS    {spec['name']}: {tt.price_nok} kr → {spec['price_nok']} kr")
            if apply:
                tt.price_nok = spec["price_nok"]

        kampanje = spec.get("campaign_price_nok")
        if tt.campaign_price_nok != kampanje:
            fra = f"{tt.campaign_price_nok} kr" if tt.campaign_price_nok is not None else "ingen"
            til = f"{kampanje} kr" if kampanje is not None else "ingen"
            changes.append(f"KAMPANJE {spec['name']}: {fra} → {til}")
            if apply:
                tt.campaign_price_nok = kampanje

        if tt.capacity != spec["capacity"]:
            if spec["capacity"] < sold:
                changes.append(
                    f"ADVARSEL {spec['name']}: ny kapasitet {spec['capacity']} er lavere enn "
                    f"{sold} allerede solgte – hopper over kapasitetsendringen"
                )
            else:
                changes.append(
                    f"ANTALL  {spec['name']}: {tt.capacity} → {spec['capacity']} plasser "
                    f"({sold} solgt)"
                )
                if apply:
                    tt.capacity = spec["capacity"]

        if bool(tt.is_active) != bool(spec["is_active"]):
            changes.append(
                f"STATUS  {spec['name']}: {'aktiv' if tt.is_active else 'skjult'} → "
                f"{'aktiv' if spec['is_active'] else 'skjult'}"
            )
            if apply:
                tt.is_active = spec["is_active"]

    if DEACTIVATE_MISSING:
        for tt in db.query(TicketType).filter(TicketType.is_active == True).all():
            if tt.id not in handled_ids:
                changes.append(f"SKJUL   «{tt.name}» står ikke i listen – settes til skjult")
                if apply:
                    tt.is_active = False

    if apply:
        db.commit()

    return changes


def main() -> int:
    apply = "--apply" in sys.argv
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        changes = sync_ticket_types(db, apply=apply)

        if not changes:
            print("Ingen endringer – databasen er allerede i tråd med TICKET_TYPES.")
        else:
            print("Tørrkjøring – ingenting er lagret ennå:" if not apply else "Lagret:")
            for c in changes:
                print(f"  {c}")
            if not apply:
                print("\nKjør på nytt med --apply for å lagre.")

        print("\nBillettyper i databasen nå:")
        for tt in db.query(TicketType).all():
            status = "aktiv " if tt.is_active else "skjult"
            kampanje = (
                f"  kampanje {tt.campaign_price_nok} kr"
                if tt.campaign_price_nok is not None else ""
            )
            print(
                f"  [{status}] {tt.name}: {tt.price_nok} kr{kampanje}  "
                f"({tt.sold_count or 0}/{tt.capacity} solgt)  id={tt.id}"
            )

        ends = campaign_ends_at()
        if ends is None:
            print("\nKampanjepris: AV (CAMPAIGN_ENDS_AT er ikke satt)")
        elif campaign_is_active():
            print(f"\nKampanjepris: PÅ til {ends:%d.%m.%Y kl. %H:%M} – deretter ordinær pris")
        else:
            print(f"\nKampanjepris: UTLØPT {ends:%d.%m.%Y kl. %H:%M} – ordinær pris gjelder nå")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
