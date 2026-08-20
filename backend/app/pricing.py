"""
Kampanjepris med utløpstid.

Hver billettype kan ha en kampanjepris (campaign_price_nok) som gjelder frem til
CAMPAIGN_ENDS_AT. Etter det tidspunktet gjelder ordinær pris (price_nok)
automatisk – ingen deploy eller manuell endring nødvendig.

Prisen regnes ut HER, på serveren, både for visning (/ticket-types) og for
betaling (/checkout/create). Frontenden bestemmer aldri hva noe koster.
"""
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.config import settings

log = logging.getLogger(__name__)

OSLO = ZoneInfo("Europe/Oslo")


def campaign_ends_at() -> datetime | None:
    """Tidspunktet kampanjeprisen slutter å gjelde, eller None hvis ikke satt."""
    raw = (getattr(settings, "CAMPAIGN_ENDS_AT", "") or "").strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        log.warning(
            "CAMPAIGN_ENDS_AT=%r kunne ikke tolkes som dato – kampanjeprisen er slått av. "
            "Forventet format: 2026-09-01T00:00:00+02:00",
            raw,
        )
        return None
    # Uten tidssone tolker vi det som norsk tid.
    return dt.replace(tzinfo=OSLO) if dt.tzinfo is None else dt


def campaign_is_active(now: datetime | None = None) -> bool:
    """Er kampanjeprisen gyldig nå?"""
    ends = campaign_ends_at()
    if ends is None:
        return False
    return (now or datetime.now(timezone.utc)) < ends


def effective_price(ticket_type, now: datetime | None = None) -> int:
    """Prisen kunden faktisk betaler nå – kampanjepris hvis den gjelder, ellers ordinær."""
    campaign = getattr(ticket_type, "campaign_price_nok", None)
    if campaign is not None and campaign < ticket_type.price_nok and campaign_is_active(now):
        return max(0, campaign)
    return ticket_type.price_nok


def discount_percent(ticket_type, now: datetime | None = None) -> int:
    """Hvor mange prosent under ordinær pris kunden betaler nå (0 hvis ingen kampanje)."""
    ordinary = ticket_type.price_nok
    if ordinary <= 0:
        return 0
    price = effective_price(ticket_type, now)
    if price >= ordinary:
        return 0
    return round((ordinary - price) * 100 / ordinary)
