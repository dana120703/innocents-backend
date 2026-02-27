import logging
import threading
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.db import get_db, SessionLocal
from app.models import Order, OrderItem, Ticket, TicketType, OrderStatus, TicketStatus
from app.schemas import (
    CreateCheckoutRequest,
    CreateCheckoutResponse,
    OrderResponse,
    TicketVerifyResponse,
    TicketTypeResponse,
    CheckinRequest,
)
from app.Vipps import create_checkout_session, get_session_status, get_session_payment_state, parse_buyer_from_session
from app.tickets import issue_tickets, send_ticket_email, send_confirmation_email


def _send_ticket_email_thread(order_id: str) -> None:
    """Kjøres i egen tråd med egen DB-sesjon. Sender billett-epost hvis ordre er PAID og ikke sendt."""
    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order or order.status != OrderStatus.PAID or order.ticket_email_sent_at:
            return
        tickets = list(order.tickets) if order.tickets else []
        if not tickets:
            tickets = issue_tickets(order, db)
        if tickets:
            send_ticket_email(order, tickets, db)
            db.refresh(order)
            logging.getLogger(__name__).info("Tråd: billett-epost sendt for ordre %s, ticket_email_sent_at=%s", order_id, order.ticket_email_sent_at)
    except Exception as e:
        logging.getLogger(__name__).exception("Tråd: billett-epost feilet for ordre %s: %s", order_id, e)
    finally:
        db.close()


async def _sync_order_with_vipps_background(order_id: str) -> None:
    """Bakgrunnsoppgave: hent Vipps-sesjon og oppdater ordrestatus (PAID/CANCELLED/EXPIRED). Blokker ikke første GET."""
    db = SessionLocal()
    try:
        session = await get_session_status(order_id)
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order or order.status not in (OrderStatus.CREATED, OrderStatus.PENDING):
            return
        # Vipps returnerer 404/tom respons for kansellerte eller utløpte sesjoner – da setter vi CANCELLED
        state = get_session_payment_state(session) if session else "cancelled"
        if state == "paid":
            buyer = parse_buyer_from_session(session)
            if buyer.get("name"):
                order.buyer_name = buyer["name"]
            if buyer.get("email"):
                order.buyer_email = buyer["email"]
            if buyer.get("phone"):
                order.buyer_phone = buyer["phone"]
            order.status = OrderStatus.PAID
            order.paid_at = order.paid_at or datetime.utcnow()
            db.commit()
            db.refresh(order)
            issue_tickets(order, db)
            threading.Thread(target=_send_ticket_email_thread, args=(order_id,), daemon=True).start()
        elif state == "cancelled":
            order.status = OrderStatus.CANCELLED
            db.commit()
        elif state == "expired":
            order.status = OrderStatus.EXPIRED
            db.commit()
    except Exception as e:
        logging.getLogger(__name__).debug("Vipps bakgrunnssjekk for ordre %s: %s", order_id, e)
    finally:
        db.close()


router = APIRouter()

"""
Selve API-endepunktene: GET /ticket-types (liste billettyper),
POST /checkout/create (lager ordre + Vipps-sesjon),
GET /orders/{id} (frontend kan poll'e betalingsstatus),
GET /tickets/verify og POST /tickets/checkin (for scanning i døra).
"""


# ─── Billettyper (frontend henter her) ────────────────────────────────────────

@router.get("/ticket-types", response_model=List[TicketTypeResponse])
def list_ticket_types(db: Session = Depends(get_db)):
    """Returnerer alle aktive billettyper med id, navn, pris og kapasitet."""
    types = db.query(TicketType).filter(TicketType.is_active == True).all()
    return [
        TicketTypeResponse(
            id=tt.id,
            name=tt.name,
            price_nok=tt.price_nok,
            capacity=tt.capacity,
            sold_count=tt.sold_count or 0,
        )
        for tt in types
    ]


# ─── Checkout ────────────────────────────────────────────────────────────────

@router.post("/checkout/create", response_model=CreateCheckoutResponse)
async def checkout_create(req: CreateCheckoutRequest, db: Session = Depends(get_db)):
    # 1) Hent og valider billettyper
    total_nok = 0
    items_data = []

    for cart_item in req.items:
        tt = db.query(TicketType).filter(
            TicketType.id == cart_item.ticket_type_id,
            TicketType.is_active == True,
        ).first()

        if not tt:
            raise HTTPException(status_code=404, detail=f"Billettype ikke funnet: {cart_item.ticket_type_id}")

        available = tt.capacity - tt.sold_count
        if cart_item.quantity > available:
            raise HTTPException(
                status_code=409,
                detail=f"Ikke nok billetter tilgjengelig for '{tt.name}'. Tilgjengelig: {available}",
            )

        total_nok += tt.price_nok * cart_item.quantity
        items_data.append({
            "ticket_type": tt,
            "quantity": cart_item.quantity,
            "unit_price_nok": tt.price_nok,
            "name": tt.name,
            "qty": cart_item.quantity,
        })

    # 2) Lag ordre i DB (status=CREATED) – name/phone har standard hvis ikke sendt
    order = Order(
        buyer_name=req.buyer.name or "Vipps-kunde",
        buyer_email=req.buyer.email,
        buyer_phone=req.buyer.phone or "+4700000000",
        amount_nok=total_nok,
        status=OrderStatus.CREATED,
    )
    db.add(order)
    db.flush()  # får order.id uten commit

    for item in items_data:
        db.add(OrderItem(
            order_id=order.id,
            ticket_type_id=item["ticket_type"].id,
            quantity=item["quantity"],
            unit_price_nok=item["unit_price_nok"],
        ))

    db.commit()
    db.refresh(order)

    # 3) Opprett Vipps Checkout-sesjon
    try:
        vipps_result = await create_checkout_session(
            order_id=order.id,
            amount_nok=total_nok,
            items=[{"name": i["name"], "unit_price_nok": i["unit_price_nok"], "qty": i["qty"]} for i in items_data],
        )
    except Exception as e:
        # Rull tilbake ordre ved Vipps-feil
        order.status = OrderStatus.FAILED
        db.commit()
        raise HTTPException(status_code=502, detail=f"Vipps-feil: {str(e)}")

    # 4) Lagre Vipps-referanse og sett til PENDING (billetter sendes når de når takk-siden)
    order.vipps_reference = order.id
    order.vipps_session_id = vipps_result.get("token")
    order.status = OrderStatus.PENDING
    db.commit()

    return CreateCheckoutResponse(
        order_id=order.id,
        checkout_url=vipps_result["checkout_url"],
    )


# ─── Order status (frontend poll'er – ved PENDING synkes status fra Vipps) ─────

def _order_to_response(order: Order) -> OrderResponse:
    total_qty = sum(oi.quantity for oi in order.items) if order.items else 0
    items = []
    for oi in order.items or []:
        tt = oi.ticket_type
        name = tt.name if tt else "Billett"
        items.append({"ticket_type_name": name, "quantity": oi.quantity})
    return OrderResponse(
        order_id=order.id,
        status=order.status.value,
        amount_nok=order.amount_nok,
        created_at=order.created_at,
        buyer_email=order.buyer_email,
        buyer_name=order.buyer_name,
        buyer_phone=order.buyer_phone,
        total_quantity=total_qty,
        items=items,
        ticket_email_sent_at=order.ticket_email_sent_at,
    )


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Hent ordre fra DB. Ved PENDING: returner raskt og synk Vipps i bakgrunn – takk-siden venter ikke på Vipps API."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Ordre ikke funnet")

    if order.status in (OrderStatus.CREATED, OrderStatus.PENDING):
        background_tasks.add_task(_sync_order_with_vipps_background, order_id)
        return _order_to_response(order)
    if order.status == OrderStatus.PAID and order.ticket_email_sent_at is None:
        threading.Thread(target=_send_ticket_email_thread, args=(order_id,), daemon=True).start()

    return _order_to_response(order)


@router.post("/orders/{order_id}/confirm")
async def confirm_order_and_send_email(order_id: str, db: Session = Depends(get_db)):
    """Ved PENDING gjør GET /orders/{id} Vipps-sjekken i bakgrunn; her sender vi kun e-post hvis ordre allerede er PAID."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Ordre ikke funnet")

    if order.status in (OrderStatus.CREATED, OrderStatus.PENDING):
        return {"ok": True}  # Vipps-sjekk skjer i bakgrunn fra GET; frontend poller og får oppdatert status

    if order.status == OrderStatus.PAID and order.ticket_email_sent_at is None:
        tickets = list(order.tickets) if order.tickets else []
        if not tickets:
            tickets = issue_tickets(order, db)
        if tickets:
            try:
                send_ticket_email(order, tickets, db)
                db.refresh(order)
                logging.getLogger(__name__).info("Confirm: billett-epost sendt (etterfyll) for ordre %s", order_id)
            except Exception as e:
                logging.getLogger(__name__).exception("Billett-epost feilet for ordre %s: %s", order_id, e)

    return {"ok": True, "status": order.status.value}


# ─── Ticket scanning (inn i lokalet) ─────────────────────────────────────────

@router.get("/tickets/verify", response_model=TicketVerifyResponse)
def verify_ticket(token: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.qr_token == token).first()

    if not ticket:
        return TicketVerifyResponse(valid=False, message="Ugyldig billett")

    if ticket.status == TicketStatus.USED:
        return TicketVerifyResponse(
            valid=False,
            ticket_id=ticket.id,
            status="USED",
            message="Billetten er allerede brukt",
        )

    if ticket.status == TicketStatus.CANCELLED:
        return TicketVerifyResponse(
            valid=False,
            ticket_id=ticket.id,
            status="CANCELLED",
            message="Billetten er kansellert",
        )

    tt = db.query(TicketType).filter(TicketType.id == ticket.ticket_type_id).first()
    order = db.query(Order).filter(Order.id == ticket.order_id).first()

    return TicketVerifyResponse(
        valid=True,
        ticket_id=ticket.id,
        ticket_type=tt.name if tt else "Ukjent",
        buyer_name=order.buyer_name if order else "Ukjent",
        status="ISSUED",
        message="✅ Gyldig billett",
    )


@router.post("/tickets/checkin")
def checkin_ticket(req: CheckinRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.qr_token == req.token).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ugyldig billett")

    if ticket.status != TicketStatus.ISSUED:
        raise HTTPException(
            status_code=409,
            detail=f"Billett kan ikke sjekkes inn – status: {ticket.status.value}",
        )

    ticket.status = TicketStatus.USED
    ticket.used_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "ticket_id": ticket.id, "message": "✅ Innsjekket"}