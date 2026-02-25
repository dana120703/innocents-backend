#!/bin/bash
# Opprett ny venv og installer avhengigheter (bruk dette hvis .venv er fra en annen mappe)
cd "$(dirname "$0")/.."
echo "Sletter gammel .venv..."
rm -rf .venv
echo "Oppretter ny venv..."
python3 -m venv .venv
echo "Installerer avhengigheter..."
.venv/bin/pip install -r Requirements.txt
echo "Ferdig. Kjør: source .venv/bin/activate && python3 seed.py"
