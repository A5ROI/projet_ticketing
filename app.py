from flask import Flask, render_template, redirect, url_for, request, session, flash
from flask_migrate import Migrate
from functools import wraps #ELISEE Ajouté pour login_required
import pymysql
from data.database import db
from passlib.hash import bcrypt  
from api.tickets import *
from api.messages import init_messages_routes
from api.reset import init_reset_routes
from data.models import * 
from security import *
from data.email_notifications import *
import requests
from api.admin import *


FASTAPI_URL = "http://127.0.0.1:8000"  # Port de FastAPI


def create_app():

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://elisee:1234@localhost/ticketing_system_db_1'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = '4f3b2a5e6d7c9f1e8b3a7d5c2e9f4b1c6d8e3a7c5b9f2d1e4a3c7b5d9e8f6a2'

    # Initialiser la base de données
    db.init_app(app)

    Migrate(app, db)  # Ajout de Flask-Migrate

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
            session.clear()


            if response.status_code == 200:
                data = response.json()
                token = data["access_token"]
                session['user_token'] = token  # ✅ Stocke le token dans la session
                headers = {"Authorization": f"Bearer {token}"}
                user_response = requests.get(f"{FASTAPI_URL}/me", headers=headers)
                print(f"Réponse JSON de FastAPI: {data}")  # Affiche la réponse JSON reçue

                if user_response.status_code == 200:
                    user_data = user_response.json()
                    session['user_id'] = user_data.get("id")  
                    session['user_role'] = user_data.get("role")

                    print("Token stocké en session:", session.get('user_token'))
                    print("ID utilisateur en session:", session.get('user_id'))
                    print("Rôle utilisateur en session:", session.get('user_role'))

                

                    flash("Connexion réussie!", "success")
                    return jsonify({"access_token": token,"user_id":session['user_id'], "redirect": "/user"})
                else:
                    flash("Erreur lors de la récupération des informations utilisateur", "danger")
                    return jsonify({"error": "Erreur récupération utilisateur"}), 500
            else:
                print("Identifiants invalides")
                flash("Identifiants invalides", "danger")
                return jsonify({"error": "Identifiants invalides"}), 401
      
        return render_template("login.html")


    @app.route('/my_profile', methods=['GET', 'POST'])
    def my_profile():
        user_id = session.get('user_id')
        if not user_id:
            flash("Vous devez être connecté pour accéder à votre profil.", "warning")
            return redirect(url_for('login'))

        user = User.query.get(user_id)

        if request.method == 'POST':
            username = request.form['username']
            email = request.form['email']
            new_password = request.form['password']
            confirm_password = request.form['confirm_password']

            user.username = username
            user.email = email

            if new_password:
                if new_password != confirm_password:
                    flash("Les mots de passe ne correspondent pas", "danger")
                    return redirect(url_for('mon_profil'))
                user.password = generate_password_hash(new_password)

            db.session.commit()
            flash("Profil mis à jour avec succès", "success")
            return redirect(url_for('mon_profil'))

        return render_template("my_profile.html", user=user)



    @app.route('/api/get_token', methods=['GET'])
    def get_token():
        token = session.get('user_token')
        if not token:
            return jsonify({"error": "Aucun token trouvé"}), 401
        return jsonify({"token": token})

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
    register_routes(app)

    return app



if __name__ == '__main__':
    app= create_app()
    app.run(debug=True)