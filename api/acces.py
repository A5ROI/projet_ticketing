from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Enum, Text, DateTime
from sqlalchemy.orm import sessionmaker, relationship, scoped_session, declarative_base, Session
from sqlalchemy_utils import database_exists, create_database
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from passlib.hash import bcrypt
from datetime import datetime, timedelta
import jwt as pyjwt
import enum
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from data import *
from security import *


# FastAPI app
app = FastAPI()

# Database setup for MySQL (phpMyAdmin)
DATABASE_URL = "mysql+pymysql://elisee:1234@localhost/ticketing_system_db_1"
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

if not database_exists(engine.url):
    create_database(engine.url)
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()

# Create tables if not exist
Base.metadata.create_all(bind=engine)

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: UserRole

class Token(BaseModel):
    access_token: str
    token_type: str

# Dependency
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Utils
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Routes

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not bcrypt.verify(login_data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    access_token = create_access_token(data={"sub": user.email, "role": user.role})    
    print("Email reçu:", login_data.email)
    print("Mot de passe reçu:", login_data.password)


    return {"access_token": access_token, "token_type": "bearer"}


# Mise à jour des routes
@app.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Vérifiez si l'utilisateur existe déjà
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Hachez le mot de passe et créez l'utilisateur
    hashed_password = bcrypt.hash(user.password)
    db_user = User(username=user.username, email=user.email, password=hashed_password, role=user.role)
    db.add(db_user)

    try:
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'utilisateur : {str(e)}")

    # Créez le token JWT
    access_token = create_access_token(data={"sub": db_user.email})

    # Envoyez un e-mail de confirmation
    subject = "Bienvenue sur notre plateforme"
    body = f"Bonjour {user.username},\n\nVotre compte a été créé avec succès."
    try:
        send_email(subject, user.email, body)
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email : {e}")

    return {"access_token": access_token, "token_type": "bearer"}

