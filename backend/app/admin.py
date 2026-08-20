"""
Admin-API: innlogging og oversikt over alle bestillinger.

Sikkerhet:
- Passordet ligger ALDRI i koden. Det settes som miljøvariabel i Railway,
  helst som hash (ADMIN_PASSWORD_HASH) laget med scripts/lag_admin_passord.py.
- Innlogging gir en HMAC-signert token som utløper etter 12 timer. Tokenen
  lagres ikke i databasen – signaturen er nok til å verifisere den.
- Gjentatte feilede innlogginger fra samme IP blokkeres en periode.

Endepunktene returnerer navn, e-post og telefon på kjøpere – altså
personopplysninger. Derfor krever alt utenom /admin/login gyldig token.
"""
import base64
import hashlib
import hmac
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Order, OrderStatus, Ticket, TicketStatus
from app.schemas import AdminLoginRequest, AdminLoginResponse, AdminOrderResponse

log = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

TOKEN_VARIGHET = timedelta(hours=12)

# Brute force-bremse: maks antall feilede forsøk per IP innenfor vinduet.
MAKS_FEILEDE_FORSØK = 10
BLOKKERING_SEKUNDER = 15 * 60
_feilede_forsøk: dict[str, list[float]] = {}


# ─── Passord ─────────────────────────────────────────────────────────────────

def _hash_passord(passord: str, salt: bytes, iterasjoner: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", passord.encode(), salt, iterasjoner)


def lag_passord_hash(passord: str, iterasjoner: int = 240_000) -> str:
    """Lager verdien som skal stå i ADMIN_PASSWORD_HASH."""
    salt = secrets.token_bytes(16)
    hash_ = _hash_passord(passord, salt, iterasjoner)
    return "pbkdf2_sha256${}${}${}".format(
        iterasjoner,
        base64.b64encode(salt).decode(),
        base64.b64encode(hash_).decode(),
    )


def _passord_stemmer(passord: str) -> bool:
    """Sjekker passordet mot ADMIN_PASSWORD_HASH, eller ADMIN_PASSWORD som reserve."""
    lagret_hash = (getattr(settings, "ADMIN_PASSWORD_HASH", "") or "").strip()
    if lagret_hash:
        try:
            metode, iterasjoner, salt_b64, hash_b64 = lagret_hash.split("$")
            if metode != "pbkdf2_sha256":
                raise ValueError(f"ukjent metode {metode}")
            forventet = base64.b64decode(hash_b64)
            faktisk = _hash_passord(passord, base64.b64decode(salt_b64), int(iterasjoner))
            return hmac.compare_digest(forventet, faktisk)
        except Exception as e:
            log.error("ADMIN_PASSWORD_HASH har ugyldig format: %s", e)
            return False

    klartekst = (getattr(settings, "ADMIN_PASSWORD", "") or "").strip()
    if klartekst:
        log.warning(
            "ADMIN_PASSWORD brukes i klartekst. Lag en hash med "
            "scripts/lag_admin_passord.py og sett ADMIN_PASSWORD_HASH i stedet."
        )
        return hmac.compare_digest(klartekst, passord)

    return False


def _admin_er_satt_opp() -> bool:
    return bool(
        (getattr(settings, "ADMIN_PASSWORD_HASH", "") or "").strip()
        or (getattr(settings, "ADMIN_PASSWORD", "") or "").strip()
    )


# ─── Token ───────────────────────────────────────────────────────────────────

def _token_nøkkel() -> bytes:
    """Nøkkelen tokenene signeres med. Egen ADMIN_SECRET hvis satt."""
    hemmelighet = (getattr(settings, "ADMIN_SECRET", "") or "").strip()
    if not hemmelighet:
        # Reserve slik at admin virker uten ekstra oppsett. Bytter du
        # VIPPS_WEBHOOK_SECRET, blir alle innlogginger ugyldige – det er greit.
        hemmelighet = settings.VIPPS_WEBHOOK_SECRET
    return hashlib.sha256(f"admin-token:{hemmelighet}".encode()).digest()


def _lag_token(utløper: datetime) -> str:
    innhold = str(int(utløper.timestamp())).encode()
    signatur = hmac.new(_token_nøkkel(), innhold, hashlib.sha256).digest()
    return "{}.{}".format(
        base64.urlsafe_b64encode(innhold).decode().rstrip("="),
        base64.urlsafe_b64encode(signatur).decode().rstrip("="),
    )


def _b64_dekod(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _token_er_gyldig(token: str) -> bool:
    try:
        innhold_b64, signatur_b64 = token.split(".")
        innhold = _b64_dekod(innhold_b64)
        forventet = hmac.new(_token_nøkkel(), innhold, hashlib.sha256).digest()
        if not hmac.compare_digest(forventet, _b64_dekod(signatur_b64)):
            return False
        return time.time() < int(innhold.decode())
    except Exception:
        return False


def krev_innlogget(authorization: str = Header(default="")) -> None:
    """Avhengighet som krever gyldig «Authorization: Bearer <token>»."""
    token = authorization[7:].strip() if authorization.startswith("Bearer ") else ""
    if not token or not _token_er_gyldig(token):
        raise HTTPException(status_code=401, detail="Ikke innlogget")


# ─── Brute force-bremse ──────────────────────────────────────────────────────

def _er_blokkert(ip: str) -> bool:
    nå = time.time()
    forsøk = [t for t in _feilede_forsøk.get(ip, []) if nå - t < BLOKKERING_SEKUNDER]
    _feilede_forsøk[ip] = forsøk
    return len(forsøk) >= MAKS_FEILEDE_FORSØK


def _registrer_feilet(ip: str) -> None:
    _feilede_forsøk.setdefault(ip, []).append(time.time())


# ─── Endepunkter ─────────────────────────────────────────────────────────────

@router.post("/login", response_model=AdminLoginResponse)
def login(req: AdminLoginRequest, request: Request):
    ip = request.client.host if request.client else "ukjent"

    if not _admin_er_satt_opp():
        log.error("Innlogging forsøkt, men verken ADMIN_PASSWORD_HASH eller ADMIN_PASSWORD er satt.")
        raise HTTPException(
            status_code=503,
            detail="Admin er ikke satt opp. Sett ADMIN_PASSWORD_HASH i Railway.",
        )

    if _er_blokkert(ip):
        raise HTTPException(
            status_code=429,
            detail="For mange mislykkede forsøk. Prøv igjen om 15 minutter.",
        )

    forventet_bruker = getattr(settings, "ADMIN_USERNAME", "admin")
    bruker_ok = hmac.compare_digest(forventet_bruker, req.username)
    # Sjekk alltid passordet også, slik at svartiden ikke røper om brukernavnet finnes.
    passord_ok = _passord_stemmer(req.password)

    if not (bruker_ok and passord_ok):
        _registrer_feilet(ip)
        log.warning("Mislykket admin-innlogging fra %s", ip)
        raise HTTPException(status_code=401, detail="Feil brukernavn eller passord")

    _feilede_forsøk.pop(ip, None)
    utløper = datetime.now(timezone.utc) + TOKEN_VARIGHET
    log.info("Admin logget inn fra %s", ip)
    return AdminLoginResponse(token=_lag_token(utløper), expires_at=utløper)


@router.get("/orders", response_model=list[AdminOrderResponse], dependencies=[Depends(krev_innlogget)])
def list_orders(db: Session = Depends(get_db)):
    """Alle bestillinger, nyeste først."""
    ordrer = db.query(Order).order_by(Order.created_at.desc()).all()

    # Hvor mange billetter som er skannet inn, hentet i én spørring i stedet for
    # én per ordre.
    innsjekket: dict[str, int] = {}
    for order_id, in db.query(Ticket.order_id).filter(Ticket.status == TicketStatus.USED).all():
        innsjekket[order_id] = innsjekket.get(order_id, 0) + 1

    svar = []
    for o in ordrer:
        linjer = [
            f"{oi.quantity}× {oi.ticket_type.name if oi.ticket_type else 'Billett'}"
            for oi in (o.items or [])
        ]
        svar.append(AdminOrderResponse(
            order_id=o.id,
            created_at=o.created_at,
            status=o.status.value if isinstance(o.status, OrderStatus) else str(o.status),
            buyer_name=o.buyer_name,
            buyer_email=o.buyer_email,
            buyer_phone=o.buyer_phone,
            amount_nok=o.amount_nok,
            ticket_count=o.total_tickets or sum(oi.quantity for oi in (o.items or [])),
            checked_in_count=innsjekket.get(o.id, 0),
            items=", ".join(linjer),
            ticket_email_sent_at=o.ticket_email_sent_at,
        ))
    return svar
