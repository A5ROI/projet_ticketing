from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy import create_engine, Boolean
from sqlalchemy_utils import database_exists, create_database



DATABASE_URL = "postgresql://elisee:a0u3mIs81CFQ11daiCmnioM55vWxaMOW@dpg-d0pmk56mcj7s73eaupd0-a.frankfurt-postgres.render.com/ticketing_zng0"

engine = create_engine(DATABASE_URL)

if not database_exists(engine.url):
    create_database(engine.url)
    print("Base de données crée avec succès.")

db = SQLAlchemy()

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()