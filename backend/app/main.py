import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import engine
from app.models import Base
from app.routes import router as main_router
from app.webhook import router as webhook_router

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Lag tabeller automatisk (bruk Alembic i produksjon)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Innocents Tickets API",
    description="Billettsalg – En kveld med Sami Hamdi",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(main_router)
app.include_router(webhook_router)


@app.get("/")
def root():
    """Rot-URL: vis at API-et kjører. Bruk /health for sjekk."""
    return {
        "message": "Innocents Tickets API",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"ok": True}