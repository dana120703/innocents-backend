"""
Vipps Checkout v3 API klient.
Docs: https://developer.vippsmobilepay.com/docs/APIs/checkout-api/
"""
import httpx
from app.config import settings


"""
All kommunikasjon med Vipps sitt API samles her. 
Inneholder create_checkout_session() som sender en forespørsel til 
Vipps Checkout v3 og returnerer checkout-URL-en som brukeren sendes til. 
Også get_session_status() om du trenger å sjekke status manuelt.

"""

def _get_headers() -> dict:
    """Standard Vipps API headers for Checkout (inkl. påkrevde system-headere)."""
    return {
        "Content-Type": "application/json",
        "client_id": settings.VIPPS_CLIENT_ID,
        "client_secret": settings.VIPPS_CLIENT_SECRET,
        "Ocp-Apim-Subscription-Key": settings.VIPPS_SUBSCRIPTION_KEY,
        "Merchant-Serial-Number": settings.VIPPS_MSN,
        "Vipps-System-Name": getattr(settings, "VIPPS_SYSTEM_NAME", "Innocents"),
        "Vipps-System-Version": getattr(settings, "VIPPS_SYSTEM_VERSION", "1.0"),
        "Vipps-System-Plugin-Name": getattr(settings, "VIPPS_SYSTEM_PLUGIN_NAME", "innocents-backend"),
        "Vipps-System-Plugin-Version": getattr(settings, "VIPPS_SYSTEM_PLUGIN_VERSION", "1.0"),
    }


async def create_checkout_session(
    order_id: str,
    amount_nok: int,
    items: list[dict],  # [{name, unit_price_nok, qty}]
) -> dict:
    """
    Oppretter en Vipps Checkout-sesjon.
    Returnerer: { token, checkoutFrontendUrl }
    """
    callback_url = f"{settings.BASE_URL.rstrip('/')}/webhooks/vipps"
    if not callback_url.startswith("https://"):
        raise RuntimeError(
            "Vipps krever HTTPS for callback URL. "
            "Sett BASE_URL til din Railway-URL (f.eks. https://innocents-backend-production.up.railway.app) i .env, "
            "eller bruk ngrok for lokal testing."
        )

    url = f"{settings.VIPPS_BASE_URL}/checkout/v3/session"

    # Bygg linjer til Vipps (vises i checkout-UI)
    order_lines = [
        {
            "name": item["name"],
            "id": f"item-{i}",
            "totalAmount": item["unit_price_nok"] * item["qty"] * 100,  # øre
            "totalAmountExcludingTax": item["unit_price_nok"] * item["qty"] * 100,
            "totalTaxAmount": 0,
            "taxPercentage": 0,
            "unitInfo": {
                "unitPrice": item["unit_price_nok"] * 100,  # øre
                "quantity": str(item["qty"]),
                "quantityUnit": "PCS",
            },
        }
        for i, item in enumerate(items)
    ]

    # returnUrl med orderId – Vipps krever HTTPS og ikke-lokal URL (ikke localhost)
    base = (settings.FRONTEND_RETURN_URL or "").strip().rstrip("/")
    if not base.startswith("https://"):
        if base.startswith("http://"):
            base = "https://" + base[7:]
        else:
            base = "https://" + base if base else "https://innocents.vercel.app"
    # Vipps tillater ikke lokal URI – bruk produksjons-URL hvis localhost/127.0.0.1
    if "localhost" in base or "127.0.0.1" in base:
        base = "https://innocents.vercel.app"
    return_url = f"{base}/takk?orderId={order_id}"

    # InitiatePaymentSessionRequest: type + reference på toppnivå (API-dokumentasjonen)
    body = {
        "type": "PAYMENT",
        "reference": order_id,
        "merchantInfo": {
            "merchantSerialNumber": settings.VIPPS_MSN,
            "callbackUrl": callback_url,
            "returnUrl": return_url,
            "callbackAuthorizationToken": settings.VIPPS_WEBHOOK_SECRET,
        },
        "transaction": {
            "reference": order_id,
            "amount": {
                "value": amount_nok * 100,  # øre
                "currency": "NOK",
            },
            "paymentDescription": "En kveld for Gaza – Innocents",
            "orderLines": order_lines,
        },
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=body, headers=_get_headers())

    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Vipps checkout session feilet: {resp.status_code} {resp.text}"
        )

    data = resp.json()
    frontend_url = data.get("checkoutFrontendUrl") or ""
    token = data.get("token")
    # For redirect-flyt uten SDK: token må med i URL så Vipps åpner riktig sesjon (unngår "Session expired")
    if token and frontend_url:
        from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
        parsed = urlparse(frontend_url)
        qs = parse_qs(parsed.query)
        qs["token"] = [token]
        new_query = urlencode(qs, doseq=True)
        frontend_url = urlunparse(parsed._replace(query=new_query))
    return {
        "token": token,
        "checkout_url": frontend_url,
    }


async def get_session_status(order_id: str) -> dict:
    """Henter nåværende status for en Vipps checkout-sesjon."""
    url = f"{settings.VIPPS_BASE_URL}/checkout/v3/session/{order_id}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers=_get_headers())

    if resp.status_code == 200:
        return resp.json()
    return {}