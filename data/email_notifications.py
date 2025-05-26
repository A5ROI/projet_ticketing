#Elisee
import smtplib, random, string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from werkzeug.security import generate_password_hash
from datetime import datetime
from data.models import *
from itsdangerous import URLSafeTimedSerializer
from security import SECRET_KEY
from flask import url_for
from passlib.hash import bcrypt




serializer = URLSafeTimedSerializer(SECRET_KEY)


def send_email(subject: str, recipient: str, body: str):
    sender_email = "chriazo01@gmail.com"
    sender_password = "xenc egnt tyoc gfdu"
    smtp_server = "smtp.gmail.com"
    smtp_port = 587

    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        # Connexion au serveur SMTP de Gmail
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()  # Sécurisation de la connexion
            server.login(sender_email, sender_password)  # Connexion avec email et mot de passe d'application
            server.sendmail(sender_email, recipient, msg.as_string())  # Envoi de l'email
            print("Email envoyé avec succès !")  # Cette ligne sera exécutée si l'email est envoyé correctement.
    except smtplib.SMTPAuthenticationError as e:
        # Si l'authentification échoue, afficher une erreur
        print(f"Erreur d'authentification SMTP: {e}")
    except Exception as e:
        # Si une autre erreur se produit, afficher l'exception
        print(f"Erreur lors de l'envoi de l'email : {e}")
    finally:
        # Le bloc finally sera toujours exécuté, même si une exception est levée ou non
        print("Fin de l'envoi d'email.")

def generate_password(length=12):
    """Génère un mot de passe aléatoire sécurisé."""
    characters = string.ascii_letters + string.digits + string.punctuation
    return ''.join(random.choice(characters) for _ in range(length))

def create_helper_user(username, email, role, category_id):
    """Crée un utilisateur Helper, génère un mot de passe, l'enregistre et envoie un e-mail."""
    password = generate_password()
    hashed_password = bcrypt.hash(password)  # Hachage pour sécurité
    
    new_user = User(
        username=username,
        email=email,
        password=hashed_password,
        role=role,
        category_id=category_id,
        created_at=datetime.utcnow()
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    email_body = f"""
    Bonjour {username},
    
    Votre compte a été créé avec succès.
    Voici votre mot de passe temporaire : {password}
    
    Veuillez vous connecter et changer votre mot de passe dès que possible.
    
    Lien de connexion : http://127.0.0.1:5000/login
    
    Cordialement,
    L'équipe de gestion des utilisateurs.
    """
    
    send_email("Création de votre compte Helper", email, email_body)
    print("Utilisateur créé et email envoyé.")


def send_reset_password(user):
    # Générer le mot de passe temporaire
    temp_password = generate_password()

    # Hash le mot de passe temporaire et l'enregistre en BDD
    user.password = bcrypt.hash(temp_password)
    db.session.commit()

    token = serializer.dumps(user.email, salt='reset-password')
    reset_url = url_for('update_password', token=token, _external=True)
    
    
    subject = "Réinitialisation de votre mot de passe"
    body = f"""
    Bonjour {user.username},

    Nous avons réinitialisé votre mot de passe. Voici un mot de passe temporaire : {temp_password}

    Pour créer un nouveau mot de passe, cliquez sur ce lien : {reset_url}

    ⚠️ Ce lien expirera dans 30 minutes pour des raisons de sécurité.

    Merci,
    L'équipe de support
    """

    send_email(subject, user.email, body)
