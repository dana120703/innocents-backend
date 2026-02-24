from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

"""
Setter opp databasetilkoblingen med SQLAlchemy.
Bruker psycopg (v3) – hvis URL er postgresql:// byttes den til postgresql+psycopg://.
"""

_db_url = settings.DATABASE_URL
if _db_url.startswith("postgresql://") and "+psycopg" not in _db_url:
    _db_url = "postgresql+psycopg://" + _db_url.split("://", 1)[1]

engine = create_engine(_db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()