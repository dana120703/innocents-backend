"""
Genererer QR-koder og sender billett-epost via SMTP.
"""
import io
import base64
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime
import qrcode
from sqlalchemy.orm import Session
from app.models import Order, Ticket, TicketType, OrderItem, TicketStatus
from app.config import settings

log = logging.getLogger(__name__)


def _email_via_smtp(to: str, subject: str, html: str, cid_images: list[tuple[str, bytes]] | None = None) -> None:
    """Sender e-post via SMTP. cid_images: [(Content-ID uten <>, png_bytes), ...] – QR vises i klienten."""
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP_HOST, SMTP_USER og SMTP_PASSWORD må være satt")
    if cid_images:
        msg = MIMEMultipart("related")
        msg.attach(MIMEText(html, "html", "utf-8"))
        for cid, png_bytes in cid_images:
            part = MIMEImage(png_bytes, _subtype="png")
            part.add_header("Content-ID", f"<{cid}>")
            part.add_header("Content-Disposition", "inline", filename=f"{cid}.png")
            msg.attach(part)
    else:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(html, "html", "utf-8"))
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    port = getattr(settings, "SMTP_PORT", 587)
    use_tls = getattr(settings, "SMTP_USE_TLS", True)
    if port == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, port) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())
    else:
        with smtplib.SMTP(settings.SMTP_HOST, port) as server:
            if use_tls:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())


def generate_qr_base64(token: str) -> str:
    """Lager QR-kode som base64-kodet PNG."""
    return base64.b64encode(generate_qr_png_bytes(token)).decode()


def generate_qr_png_bytes(token: str) -> bytes:
    """Lager QR-kode som rå PNG-bytes (til vedlegg/cid i e-post)."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(token)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def issue_tickets(order: Order, db: Session) -> list[Ticket]:
    """
    Utsteder Ticket-rader for en betalt ordre.
    Kalles kun én gang (idempotent: sjekker om tickets allerede eksisterer).
    """
    if order.tickets:
        return order.tickets  # allerede utstedt

    tickets = []
    for item in order.items:
        for _ in range(item.quantity):
            ticket = Ticket(
                order_id=order.id,
                ticket_type_id=item.ticket_type_id,
            )
            db.add(ticket)
            tickets.append(ticket)

    db.commit()
    for t in tickets:
        db.refresh(t)

    return tickets


def send_ticket_email(order: Order, tickets: list[Ticket], db: Session):
    """Sender billett-epost med QR-koder via SMTP."""
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        log.warning(
            "INGEN E-POST SENDT: SMTP_HOST, SMTP_USER og SMTP_PASSWORD må være satt. "
            "Sett disse og EMAIL_FROM i Railway Variables."
        )
        return
    if not (order.buyer_email or "").strip():
        log.warning("INGEN E-POST SENDT: Ordre %s mangler buyer_email i databasen", order.id)
        return
    log.info("Sender billett-epost til %s for ordre %s (SMTP)", order.buyer_email, order.id)
    # Oppsummering: f.eks. "2× Voksne (+12 år), 1× Barn (4-12 år)"
    order_lines = []
    for item in order.items:
        tt = db.query(TicketType).filter(TicketType.id == item.ticket_type_id).first()
        name = tt.name if tt else "Billett"
        order_lines.append(f"{item.quantity}× {name}")
    order_summary = ", ".join(order_lines) if order_lines else f"{len(tickets)} billett(er)"

    cid_images: list[tuple[str, bytes]] = []
    ticket_blocks = ""
    for i, ticket in enumerate(tickets, 1):
        tt = db.query(TicketType).filter(TicketType.id == ticket.ticket_type_id).first()
        name = tt.name if tt else "Billett"
        cid = f"qr{i}"
        cid_images.append((cid, generate_qr_png_bytes(ticket.qr_token)))
        ticket_blocks += f"""
        <div style="margin: 24px 0; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px; text-align: center;">
            <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">Billett {i} av {len(tickets)}</p>
            <p style="font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">{name}</p>
            <img src="cid:{cid}" alt="QR-kode" style="width: 200px; height: 200px;" />
            <p style="font-size: 12px; color: #999; margin: 12px 0 0 0;">Token: {ticket.qr_token}</p>
        </div>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 24px; margin-bottom: 8px;">🎟️ Dine billetter</h1>
        <p style="color: #555;">En kveld for Gaza – Innocents</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

        <p>Hei {order.buyer_name},</p>
        <p>Tusen takk for at du støtter Gaza-kvelden! Her er dine billetter.</p>
        <p style="margin: 16px 0; padding: 12px 16px; background: #f5f5f5; border-radius: 8px; font-size: 14px;">
            <strong>Du bestilte:</strong> {order_summary}
        </p>

        {ticket_blocks}

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">
            Vis QR-koden i døra. Billetten er personlig og kan ikke videreselges.
            Ordrenummer: {order.id}
        </p>
    </body>
    </html>
    """
    subject = "🎟️ Dine billetter – En kveld for Gaza"
    try:
        _email_via_smtp(order.buyer_email, subject, html, cid_images=cid_images)
        log.info("Billett-epost sendt til %s for ordre %s", order.buyer_email, order.id)
        order.ticket_email_sent_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        log.exception("E-post feilet til %s: %s", order.buyer_email, e)


def send_confirmation_email(order: Order, db: Session):
    """Sender kort bekreftelsesmail via SMTP: «Din ordre er betalt og registrert.»"""
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        log.warning("SMTP ikke satt – hopper over bekreftelsesmail")
        return
    if not order.buyer_email:
        log.warning("Ingen e-post for ordre %s – hopper over bekreftelsesmail", order.id)
        return
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 24px; margin-bottom: 8px;">✅ Ordre bekreftet</h1>
        <p style="color: #555;">En kveld for Gaza – Innocents</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p>Hei {order.buyer_name},</p>
        <p><strong>Din ordre er betalt og registrert.</strong></p>
        <p style="margin: 16px 0; padding: 12px 16px; background: #f0fdf4; border-radius: 8px; font-size: 14px;">
            Ordrenummer: {order.id}<br />
            Beløp: {order.amount_nok} kr
        </p>
        <p style="font-size: 14px; color: #666;">Du har allerede mottatt billettene med QR-kode på e-post. Vis QR-koden i døra.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">Takk for at du støtter Gaza-kvelden.</p>
    </body>
    </html>
    """
    subject = "✅ Ordre betalt og registrert – En kveld for Gaza"
    try:
        _email_via_smtp(order.buyer_email, subject, html)
        log.info("Bekreftelsesmail sendt til %s for ordre %s", order.buyer_email, order.id)
    except Exception as e:
        log.exception("Bekreftelsesmail feilet til %s: %s", order.buyer_email, e)