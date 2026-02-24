from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
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

    # Email
    RESEND_API_KEY: str
    EMAIL_FROM: str = "billetter@innocents.no"

    # App
    BASE_URL: str
    FRONTEND_RETURN_URL: str
    CORS_ORIGINS: List[str] = ["https://innocents.no"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        return _parse_cors_origins(v) if v is not None else ["https://innocents.no"]

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