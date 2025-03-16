from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Enum, Text, DateTime
from sqlalchemy.orm import Session
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
    #access_token = create_access_token(data={"sub": str(user.id), "role": user.role})  
    token_data = {"sub": str(user.id), "role": user.role}  # Vérifie bien que c'est l'ID et pas l'email
    access_token = create_access_token(data=token_data)
    print(f"🔍 Token généré avec: {token_data}")

    
   
    print("Token généré:", access_token) 
    print("Email reçu:", login_data.email)
    print("Mot de passe reçu:")


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
    access_token = create_access_token(data={"sub": db_user.id})

    # Envoyez un e-mail de confirmation
    subject = "Bienvenue sur notre plateforme"
    body = f"Bonjour {user.username},\n\nVotre compte a été créé avec succès."
    try:
        send_email(subject, user.email, body)
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email : {e}")

    return {"access_token": access_token, "token_type": "bearer"}

