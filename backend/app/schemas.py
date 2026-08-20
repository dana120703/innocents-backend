from pydantic import BaseModel, EmailStr, Field
from typing import List
from datetime import datetime

"""

Pydantic-modeller som definerer hva som er gyldig input og output for API-endepunktene 
— f.eks. hva POST /checkout/create forventer å motta fra Next.js-frontenden, og hva den returnerer tilbake.


"""


# --- Checkout ---

class TicketTypeResponse(BaseModel):
    id: str
    name: str
    price_nok: int  # ordinær pris fra DB
    discounted_price_nok: int  # prisen som gjelder nå (brukes ved betaling)
    discount_percent: int = 0  # hvor mange % under ordinær pris kunden betaler nå
    capacity: int
    sold_count: int = 0
    # Kampanje – frontend bruker dette til nedtelling og «prisen går opp»-tekst
    campaign_active: bool = False
    campaign_label: str | None = None
    campaign_ends_at: datetime | None = None


class CartItem(BaseModel):
    ticket_type_id: str
    # Må være minst 1: negativt antall ville trukket ned totalbeløpet i ordren.
    quantity: int = Field(ge=1, le=50)


class BuyerInfo(BaseModel):
    email: EmailStr
    name: str = "Vipps-kunde"
    phone: str = "+4700000000"


class CreateCheckoutRequest(BaseModel):
    items: List[CartItem]
    buyer: BuyerInfo


class CreateCheckoutResponse(BaseModel):
    order_id: str
    checkout_url: str


# --- Orders ---

class OrderItemResponse(BaseModel):
    """Én linje i ordren: type billett + antall."""
    ticket_type_name: str
    quantity: int


class OrderResponse(BaseModel):
    order_id: str
    status: str
    amount_nok: int
    created_at: datetime
    buyer_email: str | None = None
    buyer_name: str | None = None
    buyer_phone: str | None = None
    total_quantity: int = 0
    total_tickets: int | None = None  # antall billetter totalt (lagret i DB ved utstedelse)
    items: List[OrderItemResponse] = []  # f.eks. [{ ticket_type_name: "Billett", quantity: 2 }, ...]
    ticket_email_sent_at: datetime | None = None  # satt når billett-e-post er sendt (PAID + e-post OK)


# --- Tickets ---

class TicketVerifyResponse(BaseModel):
    valid: bool
    ticket_id: str | None = None
    ticket_type: str | None = None
    buyer_name: str | None = None
    status: str | None = None
    message: str


class CheckinRequest(BaseModel):
    token: str