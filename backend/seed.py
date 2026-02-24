"""
Kjør én gang for å legge inn billettyper i databasen:
  python seed.py
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
        name="Voksen",
        price_nok=350,
        capacity=300,
        is_active=True,
    ),
    TicketType(
        name="Barn",
        price_nok=150,
        capacity=100,
        is_active=True,
    ),
    TicketType(
        name="Pensjonist",
        price_nok=250,
        capacity=100,
        is_active=True,
    ),
    TicketType(
        name="Test",
        price_nok=1,
        capacity=1000,
        is_active=True,
    ),
    TicketType(
        name="Gratis test",
        price_nok=0,
        capacity=1000,
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