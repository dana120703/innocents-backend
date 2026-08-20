#!/usr/bin/env python3
"""
Lager verdien som skal stå i ADMIN_PASSWORD_HASH i Railway.

Kjør fra backend-mappen:
  python3 scripts/lag_admin_passord.py

Passordet skrives skjult og lagres ingen steder – hverken i filer eller i
shell-historikken. Du får ut en hash du limer inn i Railway → backend-tjenesten
→ Variables → ADMIN_PASSWORD_HASH.

Selve passordet kan ikke regnes tilbake fra hashen.
"""
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.admin import lag_passord_hash


def main():
    passord = getpass.getpass("Nytt admin-passord: ")
    if len(passord) < 10:
        print("Passordet bør være minst 10 tegn. Avbrutt.")
        sys.exit(1)
    if passord != getpass.getpass("Gjenta passordet: "):
        print("Passordene er ikke like. Avbrutt.")
        sys.exit(1)

    print()
    print("Lim inn i Railway → backend-tjenesten → Variables:")
    print()
    print("  ADMIN_PASSWORD_HASH=" + lag_passord_hash(passord))
    print()
    print("Har du satt ADMIN_PASSWORD (klartekst) fra før, slett den variabelen.")


if __name__ == "__main__":
    main()
