#!/usr/bin/env python3
"""
Sender en ekte billett-epost med demo-data, så du kan se hvordan billettene og
QR-kodene ser ut før arrangementet.

E-posten bygges med samme funksjon som den ekte utsendingen
(app.tickets.build_ticket_email), så det du ser her er nøyaktig det kunden får.

Kjør fra backend-mappen:
  python3 scripts/send_sample_ticket_email.py din@epost.no

Krever SMTP_* i .env (samme som prod).
"""
import sys
import os

# Sørg for at app finnes (når du kjører fra backend/)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.tickets import build_ticket_email, _email_via_smtp

# Demo-data: 3 billetter
ORDER_SUMMARY = "3× Billett"
BUYER_NAME = "Test Kunde"
ORDER_ID = "demo-sample"
TICKETS_DEMO = [
    ("Billett", "demo-qr-token-1"),
    ("Billett", "demo-qr-token-2"),
    ("Billett", "demo-qr-token-3"),
]


def main():
    if len(sys.argv) < 2:
        print("Bruk: python3 scripts/send_sample_ticket_email.py <epostadresse>")
        print("Eksempel: python3 scripts/send_sample_ticket_email.py post@innocents.no")
        sys.exit(1)
    to = sys.argv[1].strip()
    if not to or "@" not in to:
        print("Ugyldig e-postadresse")
        sys.exit(1)

    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        print("SMTP må være satt i .env (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)")
        sys.exit(1)

    subject, html, cid_images = build_ticket_email(
        buyer_name=BUYER_NAME,
        order_id=f"{ORDER_ID} (demo)",
        order_summary=ORDER_SUMMARY,
        tickets=TICKETS_DEMO,
    )
    try:
        _email_via_smtp(to, subject, html, cid_images=cid_images)
        print("Billett-epost (demo) sendt til", to)
        print(f"Sjekk innboksen – du ser {len(TICKETS_DEMO)} billetter med QR-koder.")
    except Exception as e:
        print("Feil:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
