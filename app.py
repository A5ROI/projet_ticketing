from flask import Flask, render_template, redirect, url_for, request, session, flash  
from functools import wraps #ELISEE Ajouté pour login_required
import pymysql
from data.database import db
from passlib.hash import bcrypt  
from api.tickets import *
from api.messages import init_messages_routes
from api.reset import init_reset_routes
from data.models import * 
from security import *
from data.email_notifications import send_email
import requests


FASTAPI_URL = "http://127.0.0.1:8000"  # Port de FastAPI


def create_app():

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://elisee:1234@localhost/ticketing_system_db_1'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = '4f3b2a5e6d7c9f1e8b3a7d5c2e9f4b1c6d8e3a7c5b9f2d1e4a3c7b5d9e8f6a2'

    # Initialiser la base de données
    db.init_app(app)

        # Création des tables si elles n'existent pas
    with app.app_context():
        db.create_all()

    # Routes principales
    @app.route('/')
    def home():
        return render_template('home.html')

    @app.route('/user')
    def user_dashboard():
        return render_template('user_dashboard.html')
    
    def login_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "logged_in" not in session:
                flash("Vous devez être connecté", "danger")
                return redirect(url_for("login"))
            return f(*args, **kwargs)
        return decorated_function

   
    @app.route('/helper')
    def helper_dashboard():
        return render_template('helper_dashboard.html')
    
    @app.route('/logout')
    def logout():
        # Supprimer toutes les informations de la session
        session.clear()

        # Afficher un message de déconnexion
        flash("Déconnexion réussie!", "success")

        # Rediriger vers la page d'accueil ou de connexion
        return redirect(url_for('login'))
    
    
    @app.route('/login', methods=['POST','GET'])
    def login():

        if request.method == 'POST':
            email = request.form['email']
            password = request.form['password']
            print("Request form data:", request.form)  # Affiche les données envoyées

        # Envoyer les données à FastAPI
            response = requests.post(f"{FASTAPI_URL}/login", json={"email": email, "password": password})
            print("Réponse FastAPI:", response.status_code)  # Affiche le code de statut HTTP
            print("Réponse du serveur:", response.text)  #


            if response.status_code == 200:
                data = response.json()
                print(f"Réponse JSON de FastAPI: {data}")  # Affiche la réponse JSON reçue
                token = data["access_token"]
                print(f"Token JWT: {token}")
                session['user_token'] = token  # Stocke le token JWT
                decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                print(f"Decoded token: {decoded_token}")  # Affiche le contenu du token
                session['user_role'] = decoded_token.get("role")  # Stocke le rôle
                session['user_id'] = decoded_token.get("sub")  # Stocke l'email
                print("Token stocké en session:", session.get('user_token'))
                print("ID en session:", session.get('user_id'))
                print("Session actuelle :", session)


                flash("Connexion réussie!", "success")
                return redirect(url_for("user_dashboard"))
            else:
                print("Identifiants invalides")
                flash("Identifiants invalides", "danger")
            
            

            
        return render_template("login.html")

    
    @app.route('/register', methods=['POST', 'GET'])
    def register():
        if request.method == "POST":
            username = request.form['username']
            email = request.form['email']
            password = request.form['password']
            role = "Client"  # Ou un autre rôle par défaut

            # Envoyer les données à FastAPI
            response = requests.post(f"{FASTAPI_URL}/register", json={
                "username": username,
                "email": email,
                "password": password,
                "role": role
            })

            if response.status_code == 200:
                # Envoie l'email de confirmation
                subject = "Bienvenue sur notre plateforme"
                body = f"Bonjour {username},\n\nVotre compte a été créé avec succès. Vous pouvez maintenant vous connecter."
                send_email(subject, email, body)  # Appel de la fonction pour envoyer un email

                flash("Compte créé avec succès ! Vous pouvez maintenant vous connecter.", "success")
                return redirect(url_for('login'))
            else:
                flash("Erreur lors de l'inscription", "danger")

            
        return render_template('register.html')


    # Initialisation des routes API
    init_tickets_routes(app)
    init_messages_routes(app)
    init_reset_routes(app)

    return app



if __name__ == '__main__':
    app= create_app()
    app.run(debug=True)