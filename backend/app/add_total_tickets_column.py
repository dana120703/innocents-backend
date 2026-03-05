"""
One-off: legger til total_tickets på orders hvis kolonnen mangler, og fyller inn
antall billetter for eksisterende ordre (fra tickets-tabellen).
Kjør: python -m app.add_total_tickets_column
"""
from app.db import engine
from sqlalchemy import text


def main():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS total_tickets INTEGER
        """))
        conn.commit()
    print("Kolonnen total_tickets er lagt til.")

    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE orders
            SET total_tickets = (
                SELECT COUNT(*) FROM tickets
                WHERE tickets.order_id = orders.id
            )
            WHERE total_tickets IS NULL
        """))
        conn.commit()
    print("Eksisterende ordre er oppdatert med antall billetter.")


if __name__ == "__main__":
    main()
