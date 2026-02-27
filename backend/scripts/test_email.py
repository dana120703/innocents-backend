#!/usr/bin/env python3
"""
Test at SMTP-epost fungerer før prod.

Kjør fra backend-mappen:
  python3 scripts/test_email.py din@epost.no

Krever i .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM
"""
import os
import sys

def _load_dotenv():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

_load_dotenv()


def send_test_smtp(to: str) -> None:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    from_addr = os.environ.get("EMAIL_FROM", user or "noreply@example.com")
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")

    if not all([host, user, password]):
        print("Mangler SMTP_HOST, SMTP_USER eller SMTP_PASSWORD i .env")
        sys.exit(1)

    subject = "Test-epost – Innocents billettsystem"
    html = """
    <html><body style="font-family: sans-serif;">
    <h2>Test-epost</h2>
    <p>Dette er en test fra Innocents billettsystem.</p>
    <p>Hvis du ser denne e-posten, er SMTP konfigurert riktig.</p>
    <p style="color:#666; font-size:12px;">Sendt fra test_email.py</p>
    </body></html>
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    if port == 465:
        with smtplib.SMTP_SSL(host, port) as server:
            server.login(user, password)
            server.sendmail(from_addr, [to], msg.as_string())
    else:
        with smtplib.SMTP(host, port) as server:
            if use_tls:
                server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, [to], msg.as_string())
    print("SMTP: Test-epost sendt til", to)


def main():
    if len(sys.argv) < 2:
        print("Bruk: python3 scripts/test_email.py <epostadresse>")
        print("Eksempel: python3 scripts/test_email.py din@epost.no")
        sys.exit(1)
    to = sys.argv[1].strip()
    if not to or "@" not in to:
        print("Ugyldig e-postadresse")
        sys.exit(1)

    if not all([os.environ.get("SMTP_HOST"), os.environ.get("SMTP_USER"), os.environ.get("SMTP_PASSWORD")]):
        print("Sett SMTP_HOST, SMTP_USER og SMTP_PASSWORD i .env")
        sys.exit(1)

    try:
        send_test_smtp(to)
    except Exception as e:
        print("SMTP feilet:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
