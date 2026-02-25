"""
Genererer QR-koder og sender billett-epost via Resend.
"""
import io
import base64
import logging
from datetime import datetime
import qrcode
import resend
from sqlalchemy.orm import Session
from app.models import Order, Ticket, TicketType, OrderItem, TicketStatus
from app.config import settings

if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY


"""
To ting: issue_tickets() oppretter Ticket-rader i databasen etter betaling, 
og send_ticket_email() genererer QR-koder som base64-bilder og 
sender billett-eposten via Resend til kjøperen.



"""



def generate_qr_base64(token: str) -> str:
    """Lager QR-kode som base64-kodet PNG."""
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
    return base64.b64encode(buf.getvalue()).decode()


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
    """Sender billett-epost med QR-koder til kjøper."""
    import logging
    log = logging.getLogger(__name__)
    if not settings.RESEND_API_KEY:
        log.warning("RESEND_API_KEY ikke satt – hopper over e-postutsendelse")
        return
    # Oppsummering: f.eks. "2× Voksne (+12 år), 1× Barn (4-12 år)"
    order_lines = []
    for item in order.items:
        tt = db.query(TicketType).filter(TicketType.id == item.ticket_type_id).first()
        name = tt.name if tt else "Billett"
        order_lines.append(f"{item.quantity}× {name}")
    order_summary = ", ".join(order_lines) if order_lines else f"{len(tickets)} billett(er)"

    ticket_blocks = ""
    for i, ticket in enumerate(tickets, 1):
        tt = db.query(TicketType).filter(TicketType.id == ticket.ticket_type_id).first()
        qr_b64 = generate_qr_base64(ticket.qr_token)
        ticket_blocks += f"""
        <div style="margin: 24px 0; padding: 24px; border: 1px solid #e5e5e5; border-radius: 8px; text-align: center;">
            <p style="font-size: 14px; color: #666; margin: 0 0 8px 0;">Billett {i} av {len(tickets)}</p>
            <p style="font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">{tt.name if tt else "Billett"}</p>
            <img src="data:image/png;base64,{qr_b64}" alt="QR-kode" style="width: 200px; height: 200px;" />
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

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": order.buyer_email,
            "subject": "🎟️ Dine billetter – En kveld for Gaza",
            "html": html,
        })
        log.info("Billett-epost sendt til %s for ordre %s", order.buyer_email, order.id)
        order.ticket_email_sent_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        log.exception("Resend e-post feilet til %s: %s", order.buyer_email, e) 