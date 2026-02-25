"""
One-off: legger til ticket_email_sent_at på orders hvis den mangler.
Kjør: python -m app.add_ticket_email_sent_column
"""
from app.db import engine
from sqlalchemy import text

def main():
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS ticket_email_sent_at TIMESTAMP
        """))
        conn.commit()
    print("Kolonnen ticket_email_sent_at er satt opp.")

if __name__ == "__main__":
    main()
