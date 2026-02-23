from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

""" 
Setter opp databasetilkoblingen med SQLAlchemy. 
Inneholder get_db() som er en dependency FastAPI bruker for å gi 
hver request sin egen databasesesjon, og lukke den etterpå.

"""


engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()