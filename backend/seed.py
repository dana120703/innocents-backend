#!/usr/bin/env python3
"""
Kjør én gang for å legge inn billettyper i databasen:
  python3 seed.py
  (eller: .venv/bin/python3 seed.py  fra backend-mappen)

Krever at DATABASE_URL er satt (f.eks. i .env) og at du har nett til DB (Supabase).
"""
from app.db import SessionLocal, engine
from app.models import Base, TicketType


"""
Et script du kjører én gang for å legge inn billettyper 
(Standard og VIP) i databasen. Printer ut ID-ene etterpå — 
disse ID-ene trenger du i Next.js-frontenden for å vite hvilke billettyper som finnes.

"""

Base.metadata.create_all(bind=engine)

db = SessionLocal()

ticket_types = [
    TicketType(
        name="Voksne (+12 år)",
        price_nok=249,
        capacity=500,
        is_active=True,
    ),
    TicketType(
        name="Barn (4-12 år)",
        price_nok=50,
        capacity=300,
        is_active=True,
    ),
    TicketType(
        name="Barn (0-3 år)",
        price_nok=0,
        capacity=300,
        is_active=True,
    ),
    TicketType(
        name="Bestille bord (10 personer)",
        price_nok=2241,
        capacity=50,
        is_active=True,
    ),
]

for tt in ticket_types:
    existing = db.query(TicketType).filter(TicketType.name == tt.name).first()
    if not existing:
        db.add(tt)
        print(f"La til: {tt.name} – {tt.price_nok} kr ({tt.capacity} plasser)")
    else:
        print(f"Allerede finnes: {tt.name}")

db.commit()

# Print IDs (bruk disse i frontend)
all_types = db.query(TicketType).all()
print("\nBillettyper i DB:")
for tt in all_types:
    print(f"  ID: {tt.id}  Navn: {tt.name}  Pris: {tt.price_nok} kr")

db.close()