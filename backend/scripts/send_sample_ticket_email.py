#!/usr/bin/env python3
"""
Sender en ekte billett-epost (samme utseende som i prod) med demo-data,
så du kan se hvordan billettene og QR-kodene ser ut.

Kjør fra backend-mappen:
  python3 scripts/send_sample_ticket_email.py din@epost.no

Krever SMTP_* eller RESEND i .env (samme som prod).
"""
import sys
import os

# Sørg for at app finnes (når du kjører fra backend/)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.tickets import generate_qr_png_bytes, _email_via_smtp

# Demo-data: 2 voksne, 1 barn
ORDER_SUMMARY = "2× Voksne (+12 år), 1× Barn (4-12 år)"
BUYER_NAME = "Test Kunde"
ORDER_ID = "demo-sample"
TICKETS_DEMO = [
    ("Voksne (+12 år)", "demo-qr-token-voksen-1"),
    ("Voksne (+12 år)", "demo-qr-token-voksen-2"),
    ("Barn (4-12 år)", "demo-qr-token-barn-1"),
]


def build_ticket_blocks_and_cids():
    """Bygger HTML-blokker med cid-referanser og liste med (cid, png_bytes) for SMTP."""
    blocks = ""
    cid_images = []
    for i, (name, token) in enumerate(TICKETS_DEMO, 1):
        cid = f"qr{i}"
        cid_images.append((cid, generate_qr_png_bytes(token)))
        blocks += f"""
        <div style="margin: 24px 0; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px; text-align: center;">
            <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">Billett {i} av {len(TICKETS_DEMO)}</p>
            <p style="font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">{name}</p>
            <img src="cid:{cid}" alt="QR-kode" style="width: 200px; height: 200px;" />
            <p style="font-size: 12px; color: #999; margin: 12px 0 0 0;">Token: {token}</p>
        </div>
        """
    return blocks, cid_images


def main():
    if len(sys.argv) < 2:
        print("Bruk: python3 scripts/send_sample_ticket_email.py <epostadresse>")
        print("Eksempel: python3 scripts/send_sample_ticket_email.py post@innocents.no")
        sys.exit(1)
    to = sys.argv[1].strip()
    if not to or "@" not in to:
        print("Ugyldig e-postadresse")
        sys.exit(1)

    use_smtp = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)
    if not use_smtp:
        print("SMTP må være satt i .env (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)")
        sys.exit(1)

    ticket_blocks, cid_images = build_ticket_blocks_and_cids()
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 24px; margin-bottom: 8px;">🎟️ Dine billetter</h1>
        <p style="color: #555;">En kveld for Gaza – Innocents</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

        <p>Hei {BUYER_NAME},</p>
        <p>Tusen takk for at du støtter Gaza-kvelden! Her er dine billetter.</p>
        <p style="margin: 16px 0; padding: 12px 16px; background: #f5f5f5; border-radius: 8px; font-size: 14px;">
            <strong>Du bestilte:</strong> {ORDER_SUMMARY}
        </p>

        {ticket_blocks}

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">
            Vis QR-koden i døra. Billetten er personlig og kan ikke videreselges.
            Ordrenummer: {ORDER_ID} (demo)
        </p>
    </body>
    </html>
    """
    subject = "🎟️ Dine billetter – En kveld for Gaza"
    try:
        _email_via_smtp(to, subject, html, cid_images=cid_images)
        print("Billett-epost (demo) sendt til", to)
        print("Sjekk innboksen – du ser 2 voksne- og 1 barnebillett med QR-koder.")
    except Exception as e:
        print("Feil:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
