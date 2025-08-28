from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy import create_engine, Boolean
from sqlalchemy_utils import database_exists, create_database



DATABASE_URL = "postgresql://ticketing_xvoq_user:8qkPANbuhRWe0gLi78Kvjb1wAhz89Hdu@dpg-d2mpcq6r433s73avghb0-a.frankfurt-postgres.render.com/ticketing_xvoq"

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