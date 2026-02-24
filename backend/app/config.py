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
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        v = v.strip()
        if v.startswith("["):
            return json.loads(v)
        if v:
            return [x.strip() for x in v.split(",")]
    return ["https://innocents.no"]


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

    # Email (valgfri – e-post sendes ikke før du setter RESEND_API_KEY i Railway)
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "billetter@innocents.no"

    # App (sett FRONTEND_RETURN_URL i Railway til din billettside-URL)
    BASE_URL: str
    FRONTEND_RETURN_URL: str = "https://innocents.no"
    # Leses som streng fra env (kommaseparert), så Railway ikke prøver JSON-parse
    cors_origins_raw: str = Field(default="https://innocents.no", validation_alias="CORS_ORIGINS")

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