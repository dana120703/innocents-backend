from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional
import json


"""

Leser alle miljøvariabler fra .env-filen 
(Vipps-nøkler, database-URL, Resend API-nøkkel osv.).
 Alt som er hemmelig eller miljø-spesifikt samles her — ingen hardkodede verdier i resten av koden.
"""


def _parse_cors_origins(v):
    """Returnerer liste av CORS-origins. Fjerner avsluttende / slik at Railway sin auto-URL matcher."""
    if isinstance(v, list):
        return [o.rstrip("/") for o in v if o]
    if isinstance(v, str):
        v = v.strip()
        if v.startswith("["):
            parsed = json.loads(v)
            return [o.rstrip("/") for o in parsed if o]
        if v:
            return [x.strip().rstrip("/") for x in v.split(",") if x.strip()]
    return ["https://innocents.no", "https://billetter.innocents.no"]


class Settings(BaseSettings):
    # Vipps
    VIPPS_CLIENT_ID: str
    VIPPS_CLIENT_SECRET: str
    VIPPS_SUBSCRIPTION_KEY: str
    VIPPS_MSN: str
    VIPPS_ENV: str = "prod"

    # Database
    DATABASE_URL: str

    # Webhook
    VIPPS_WEBHOOK_SECRET: str

    # E-post: bruk SMTP (anbefalt) eller Resend
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: str = "noreply@example.com"
    RESEND_API_KEY: Optional[str] = None

    # App (sett FRONTEND_RETURN_URL i Railway til din billettside-URL)
    BASE_URL: str
    FRONTEND_RETURN_URL: str = "https://billetter.innocents.no"
    # Leses som streng fra env (kommaseparert), så Railway ikke prøver JSON-parse
    cors_origins_raw: str = Field(
        default="https://innocents.no,https://billetter.innocents.no",
        validation_alias="CORS_ORIGINS",
    )

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return _parse_cors_origins(self.cors_origins_raw)

    @property
    def VIPPS_BASE_URL(self) -> str:
        return (
            "https://api.vipps.no"
            if self.VIPPS_ENV == "prod"
            else "https://apitest.vipps.no"
        )

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()