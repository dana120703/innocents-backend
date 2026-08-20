"""
One-off: legger til campaign_price_nok på ticket_types hvis kolonnen mangler.
Kjør: python -m app.add_campaign_price_column

Kolonnen holder kampanjeprisen som gjelder frem til CAMPAIGN_ENDS_AT.
Selve verdiene settes med update_ticket_types.py.

Trygg å kjøre flere ganger – sjekker først om kolonnen finnes.
"""
from sqlalchemy import inspect, text

from app.db import engine


def main():
    columns = {c["name"] for c in inspect(engine).get_columns("ticket_types")}
    if "campaign_price_nok" in columns:
        print("Kolonnen campaign_price_nok finnes allerede – ingenting å gjøre.")
        return

    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE ticket_types ADD COLUMN campaign_price_nok INTEGER"))
        conn.commit()
    print("Kolonnen campaign_price_nok er lagt til.")


if __name__ == "__main__":
    main()
