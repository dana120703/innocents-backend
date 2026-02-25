#!/usr/bin/env python3
"""
Sletter all data i databasen (ordrer, billetter, webhooks). Billettyper beholdes og sold_count nullstilles.

Kjør:  python3 clear_db.py          (tømmer ordrer/billetter/webhooks, beholder billettyper)
       python3 clear_db.py --all    (sletter også billettyper – kjør seed.py etterpå)
       python3 clear_db.py --yes    (hopper over bekreftelse)

Krever DATABASE_URL i .env.
"""
import sys
from app.db import SessionLocal, engine
from app.models import Ticket, OrderItem, ProcessedWebhook, Order, TicketType


def main():
    delete_types_too = "--all" in sys.argv  # inkl. billettyper
    skip_confirm = "--yes" in sys.argv or "-y" in sys.argv

    if not skip_confirm:
        msg = "Slette alle ordrer, billetter og webhooks? Billettyper beholdes (sold_count nullstilles)."
        if delete_types_too:
            msg = "Slette ALT inkl. billettyper? Du må kjøre seed.py på nytt etterpå."
        print(msg)
        ok = input("Skriv 'ja' for å bekrefte: ").strip().lower()
        if ok != "ja":
            print("Avbrutt.")
            return

    db = SessionLocal()
    try:
        # Rekkefølge pga. foreign keys: barn før forelder
        deleted_tickets = db.query(Ticket).delete()
        deleted_items = db.query(OrderItem).delete()
        deleted_webhooks = db.query(ProcessedWebhook).delete()
        deleted_orders = db.query(Order).delete()

        if not delete_types_too:
            # Nullstill sold_count på billettyper
            for tt in db.query(TicketType).all():
                tt.sold_count = 0
            db.commit()
            print(f"Slettet: {deleted_tickets} billetter, {deleted_items} ordrelinjer, {deleted_webhooks} webhooks, {deleted_orders} ordrer.")
            print("Billettyper beholdt (sold_count nullstilt).")
        else:
            deleted_types = db.query(TicketType).delete()
            db.commit()
            print(f"Slettet: {deleted_tickets} billetter, {deleted_items} ordrelinjer, {deleted_webhooks} webhooks, {deleted_orders} ordrer, {deleted_types} billettyper.")
            print("Kjør seed.py for å legge inn billettyper på nytt.")
    except Exception as e:
        db.rollback()
        print(f"Feil: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
