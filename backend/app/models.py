import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.db import Base
import enum


"""
Definerer alle databasetabeller: TicketType (billettyper med pris og kapasitet), 
Order (én kjøp med kjøperinfo og Vipps-referanse), OrderItem (hvilke billetter som er i en ordre), 
Ticket (én utstedt billett med QR-token), og ProcessedWebhook 
(idempotency-tabell for å unngå dobbeltbehandling av webhooks).

"""


class OrderStatus(str, enum.Enum):
    CREATED = "CREATED"
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class TicketStatus(str, enum.Enum):
    ISSUED = "ISSUED"
    USED = "USED"
    CANCELLED = "CANCELLED"


def new_uuid():
    return str(uuid.uuid4())


class TicketType(Base):
    __tablename__ = "ticket_types"

    id = Column(String, primary_key=True, default=new_uuid)
    name = Column(String, nullable=False)          # "Standard" / "VIP"
    price_nok = Column(Integer, nullable=False)    # ordinær pris i kroner (heltall)
    # Kampanjepris i kroner. Gjelder frem til CAMPAIGN_ENDS_AT – se app/pricing.py.
    campaign_price_nok = Column(Integer, nullable=True)
    capacity = Column(Integer, nullable=False)
    sold_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    order_items = relationship("OrderItem", back_populates="ticket_type")


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=new_uuid)
    buyer_name = Column(String, nullable=False)
    buyer_email = Column(String, nullable=False)
    buyer_phone = Column(String, nullable=False)
    amount_nok = Column(Integer, nullable=False)   # total i kroner
    status = Column(Enum(OrderStatus), default=OrderStatus.CREATED)

    # Vipps
    vipps_reference = Column(String, unique=True, nullable=True)
    vipps_session_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)
    ticket_email_sent_at = Column(DateTime, nullable=True)  # unngår duplikat e-post
    total_tickets = Column(Integer, nullable=True)  # antall billetter totalt for ordren (satt ved issue_tickets)

    items = relationship("OrderItem", back_populates="order")
    tickets = relationship("Ticket", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, default=new_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    ticket_type_id = Column(String, ForeignKey("ticket_types.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price_nok = Column(Integer, nullable=False)

    order = relationship("Order", back_populates="items")
    ticket_type = relationship("TicketType", back_populates="order_items")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, default=new_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    ticket_type_id = Column(String, ForeignKey("ticket_types.id"), nullable=False)
    qr_token = Column(String, unique=True, nullable=False, default=new_uuid)
    status = Column(Enum(TicketStatus), default=TicketStatus.ISSUED)

    issued_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

    order = relationship("Order", back_populates="tickets")
    ticket_type = relationship("TicketType")


class ProcessedWebhook(Base):
    """Idempotency: sporer allerede behandlede webhooks."""
    __tablename__ = "processed_webhooks"

    id = Column(String, primary_key=True)   # Vipps event id
    processed_at = Column(DateTime, default=datetime.utcnow)