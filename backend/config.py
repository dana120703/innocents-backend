from pydantic_settings import BaseSettings
from typing import List
import json


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

    @property
    def VIPPS_BASE_URL(self) -> str:
        return (
            "https://api.vipps.no"
            if self.VIPPS_ENV == "prod"
            else "https://apitest.vipps.no"
        )

    class Config:
        env_file = ".env"


settings = Settings()