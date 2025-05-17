from passlib.hash import bcrypt 
from datetime import datetime, timedelta
import jwt
from flask import request, session, jsonify
from fastapi import Depends,HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from werkzeug.exceptions import Unauthorized
from data.models import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

SECRET_KEY = "4f3b2a5e6d7c9f1e8b3a7d5c2e9f4b1c6d8e3a7c5b9f2d1e4a3c7b5d9e8f6a2"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def hash_password(password: str) -> str:
    return bcrypt.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str):
    if not token:
        return None

    try:
        if token.startswith("Bearer "):
            token = token.split(" ")[1]  # 🔹 Supprime "Bearer " du token
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        user_id = payload.get("sub")
        role = payload.get("role")

        if not user_id or not role:
            return None
        
        # 🔹 Stocke dans session (utile si tu utilises Flask avec des templates HTML)
        session['user_token'] = token
        session['user_role'] = role
        session['user_id'] = user_id

        return {
            "id": int(user_id),
            "role": role,
            "session_user_id": session.get('user_id'),  # Vérifie si c'est stocké
            "session_user_role": session.get('user_role')
        }
    
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    