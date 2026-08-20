"""
Sørger for at kolonner som er lagt til etter at databasen ble opprettet, faktisk
finnes – kjøres ved oppstart.

Hvorfor: `Base.metadata.create_all()` oppretter manglende TABELLER, men aldri
manglende KOLONNER i tabeller som allerede finnes. Etter en deploy som legger
til en kolonne i modellen vil derfor alle spørringer mot tabellen feile med 500
helt til migrasjonsscriptet kjøres manuelt. Det tok ned /ticket-types i
produksjon 20. august 2026.

Denne modulen legger til manglende kolonner automatisk. Den er idempotent og
trygg å kjøre ved hver oppstart: finnes kolonnen allerede, gjøres ingenting.

Ny kolonne i models.py? Legg den til i REQUIRED_COLUMNS under.
"""
import logging

from sqlalchemy import inspect, text

from app.db import engine

log = logging.getLogger(__name__)

# (tabell, kolonne, SQL-type) – typen må være gyldig i både Postgres og SQLite.
REQUIRED_COLUMNS: list[tuple[str, str, str]] = [
    ("ticket_types", "campaign_price_nok", "INTEGER"),
    ("orders", "total_tickets", "INTEGER"),
    ("orders", "ticket_email_sent_at", "TIMESTAMP"),
]


def ensure_columns() -> list[str]:
    """Legger til manglende kolonner. Returnerer liste over hva som ble lagt til."""
    lagt_til: list[str] = []
    tabeller = set(inspect(engine).get_table_names())

    for tabell, kolonne, sql_type in REQUIRED_COLUMNS:
        if tabell not in tabeller:
            continue  # create_all() lager den med alle kolonner
        if kolonne in {c["name"] for c in inspect(engine).get_columns(tabell)}:
            continue

        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE {tabell} ADD COLUMN {kolonne} {sql_type}"))
                conn.commit()
            lagt_til.append(f"{tabell}.{kolonne}")
            log.info("La til manglende kolonne %s.%s", tabell, kolonne)
        except Exception as e:
            # Ikke ta ned appen – logg tydelig så det er synlig i Railway-loggen.
            log.error(
                "Kunne ikke legge til kolonnen %s.%s: %s. "
                "Kjør migrasjonen manuelt mot produksjonsdatabasen.",
                tabell, kolonne, e,
            )

    return lagt_til
