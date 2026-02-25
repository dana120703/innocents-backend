# Railway bygger fra repo-root – denne filen må ligge i roten.
# Bygger backend (FastAPI) med kontekst backend/.
FROM python:3.12-slim

WORKDIR /app

COPY backend/Requirements.txt .
RUN pip install --no-cache-dir -r Requirements.txt

COPY backend/ .

EXPOSE 8000
ENV PORT=8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
