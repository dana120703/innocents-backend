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
    """Standard Vipps API headers for Checkout."""
    return {
        "Content-Type": "application/json",
        "client_id": settings.VIPPS_CLIENT_ID,
        "client_secret": settings.VIPPS_CLIENT_SECRET,
        "Ocp-Apim-Subscription-Key": settings.VIPPS_SUBSCRIPTION_KEY,
        "Merchant-Serial-Number": settings.VIPPS_MSN,
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

    body = {
        "merchantInfo": {
            "merchantSerialNumber": settings.VIPPS_MSN,
            "callbackUrl": f"{settings.BASE_URL}/webhooks/vipps",
            "returnUrl": settings.FRONTEND_RETURN_URL,
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
    return {
        "token": data.get("token"),
        "checkout_url": data.get("checkoutFrontendUrl"),
    }


async def get_session_status(order_id: str) -> dict:
    """Henter nåværende status for en Vipps checkout-sesjon."""
    url = f"{settings.VIPPS_BASE_URL}/checkout/v3/session/{order_id}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers=_get_headers())

    if resp.status_code == 200:
        return resp.json()
    return {}