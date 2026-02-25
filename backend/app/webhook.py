"""
Vipps Checkout webhook handler.

Vipps sender events som:
  - PaymentCreated
  - PaymentAborted
  - PaymentExpired
  - PaymentCancelled
  - PaymentCaptured      ← dette er "betalt"
  - PaymentRefunded
  - PaymentAuthorized    ← kan komme før captured (avhenger av config)
  - SessionTerminated

Docs: https://developer.vippsmobilepay.com/docs/APIs/checkout-api/checkout-api-guide/#callbacks
"""

from fastapi import APIRouter, Depends, Request, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.db import get_db
from app.models import Order, OrderStatus, ProcessedWebhook
from app.tickets import issue_tickets, send_ticket_email
from app.config import settings
from app.Vipps import get_session_status, parse_buyer_from_session

router = APIRouter()
logger = logging.getLogger(__name__)

"""
Tar imot callbacks fra Vipps etter betaling. 
Autentiserer at det faktisk er Vipps som sender (via VIPPS_WEBHOOK_SECRET), 
sjekker mot ProcessedWebhook for å unngå dobbeltbehandling, og kaller issue_tickets() 
+ send_ticket_email() når status er PAID.

"""

# Vipps events som betyr "betalt" (begge format: PaymentCaptured og CAPTURED)
PAID_EVENTS = {"PaymentCaptured", "PaymentAuthorized", "CAPTURED", "AUTHORIZED"}
# Vipps events som betyr "mislyktes"
FAILED_EVENTS = {"PaymentAborted", "PaymentExpired", "PaymentCancelled", "SessionTerminated", "ABORTED", "EXPIRED", "TERMINATED", "CANCELLED"}


@router.post("/webhooks/vipps")
async def vipps_webhook(
    request: Request,
    db: Session = Depends(get_db),
    authorization: str = Header(default=""),
):
    # ─── 1) Autentiser webhook ────────────────────────────────────────────────
    # Vipps sender callbackAuthorizationToken i Authorization-headeren
    if authorization != settings.VIPPS_WEBHOOK_SECRET:
        logger.warning("Ugyldig webhook authorization header")
        raise HTTPException(status_code=401, detail="Ugyldig webhook token")

    # ─── 2) Parse body ────────────────────────────────────────────────────────
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Ugyldig JSON")

    # Vipps kan sende event som "name", "event", "type" eller lignende
    event_name = body.get("name") or body.get("event") or body.get("type") or body.get("paymentState")
    reference = body.get("reference") or body.get("orderId")
    event_id = body.get("idempotencyKey") or body.get("id") or (f"{reference}:{event_name}" if reference and event_name else None)

    if not event_name:
        logger.warning("Webhook uten event-navn, body-keys: %s", list(body.keys())[:20])

    logger.info(f"Webhook mottatt: {event_name} for ordre {reference}")

    # Idempotency – ignorer duplikater (trenger event_id)
    if event_id:
        existing = db.query(ProcessedWebhook).filter(ProcessedWebhook.id == event_id).first()
        if existing:
            logger.info(f"Duplikat webhook ignorert: {event_id}")
            return {"ok": True, "duplicate": True}
        db.add(ProcessedWebhook(id=event_id))
        db.commit()

    # ─── 4) Finn ordre ────────────────────────────────────────────────────────
    if not reference:
        logger.warning("Webhook mangler reference-felt")
        return {"ok": True}

    order = db.query(Order).filter(Order.id == reference).first()
    if not order:
        logger.warning(f"Ordre ikke funnet for reference: {reference}")
        return {"ok": True}  # returner 200 for å unngå Vipps retry

    # ─── 5) Håndter event ─────────────────────────────────────────────────────
    if event_name in PAID_EVENTS and order.status != OrderStatus.PAID:
        logger.info(f"Ordre {order.id} markert som PAID")
        # Hent kjøperinfo fra Vipps session (navn, e-post, telefon). Vipps returnerer ofte kun
        # userInfo/billingDetails når sessionState er PaymentInitiated – ved PaymentCaptured
        # kan data være borte. Derfor må create_checkout_session bruke configuration.elements
        # = "PaymentAndContactInfo" slik at kunden får kontaktpanel og vi får data.
        try:
            session = await get_session_status(reference)
            buyer = parse_buyer_from_session(session)
            if buyer.get("name"):
                order.buyer_name = buyer["name"]
            if buyer.get("email"):
                order.buyer_email = buyer["email"]
            if buyer.get("phone"):
                order.buyer_phone = buyer["phone"]
        except Exception as e:
            logger.debug("Kunne ikke hente kjøperinfo fra Vipps: %s", e)
        order.status = OrderStatus.PAID
        order.paid_at = datetime.utcnow()
        db.commit()
        db.refresh(order)

        # Utsted billetter og send epost
        try:
            tickets = issue_tickets(order, db)
            send_ticket_email(order, tickets, db)
            logger.info(f"Billetter utstedt og epost sendt for ordre {order.id}")
        except Exception as e:
            logger.error(f"Feil ved utstedelse av billetter for ordre {order.id}: {e}")
            # Ikke raise – betalingen er registrert. Kan retryes manuelt.

    elif event_name in FAILED_EVENTS and order.status not in (OrderStatus.PAID,):
        status_map = {
            "PaymentAborted": OrderStatus.CANCELLED,
            "PaymentCancelled": OrderStatus.CANCELLED,
            "Aborted": OrderStatus.CANCELLED,
            "ABORTED": OrderStatus.CANCELLED,
            "PaymentExpired": OrderStatus.EXPIRED,
            "Expired": OrderStatus.EXPIRED,
            "EXPIRED": OrderStatus.EXPIRED,
            "SessionTerminated": OrderStatus.EXPIRED,
            "TERMINATED": OrderStatus.EXPIRED,
            "CANCELLED": OrderStatus.CANCELLED,
        }
        order.status = status_map.get(event_name, OrderStatus.FAILED)
        db.commit()
        logger.info(f"Ordre {order.id} satt til {order.status.value}")

    else:
        logger.info(f"Event {event_name} ignorert for ordre {order.id} (status: {order.status.value})")

    # Vipps forventer alltid 200 OK
    return {"ok": True}