#!/usr/bin/env python3
"""
Legger inn billettypene i databasen første gang:
  python3 seed.py
  (eller: .venv/bin/python3 seed.py  fra backend-mappen)

Krever at DATABASE_URL er satt (f.eks. i .env) og at du har nett til DB (Supabase).

MERK: Billettypene defineres i update_ticket_types.py – det er fasiten.
Denne filen er bare et førstegangs-oppsett som bruker samme liste. Skal du
ENDRE priser eller navn på en database som allerede er seedet, bruk:

    python3 update_ticket_types.py            # se hva som endres
    python3 update_ticket_types.py --apply    # lagre

(Den gamle seed.py hoppet over billettyper som allerede fantes, så prisendringer
fikk aldri effekt i produksjon.)
"""
from app.db import SessionLocal, engine
from app.models import Base
from update_ticket_types import sync_ticket_types


Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    changes = sync_ticket_types(db, apply=True)
    for c in changes:
        print(c)
    if not changes:
        print("Billettypene var allerede i tråd med TICKET_TYPES.")
finally:
    db.close()
