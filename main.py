from flask import Flask, render_template, redirect, url_for, request, session, flash
from flask_migrate import Migrate
from functools import wraps
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
from werkzeug.security import check_password_hash


UPLOAD_FOLDER = "static/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def create_app():

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://elisee:1234@localhost/ticketing_system_db_1'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = '4f3b2a5e6d7c9f1e8b3a7d5c2e9f4b1c6d8e3a7c5b9f2d1e4a3c7b5d9e8f6a2'
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
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
        session.clear()

        flash("Déconnexion réussie!", "success")

        return redirect(url_for('home'))
    
    
    @app.route('/login', methods=['POST','GET'])
    def login():

        if request.method == 'POST':
            email = request.form['email']
            password = request.form['password']
            print("Request form data:", request.form)  # Affiche les données envoyées
            session.clear()
        
            """ response = requests.post(f"{FASTAPI_URL}/login", json={"email": email, "password": password})
                print("Réponse FastAPI:", response.status_code)  # Affiche le code de statut HTTP
                print("Réponse du serveur:", response.text)  # """
            try:

                user = User.query.filter_by(email=email).first()

                if user and bcrypt.verify(password, user.password):

                    token_data={
                        "sub": str(user.id),
                        "role": user.role,
                        "username": user.username
                    }
                    token = create_access_token(token_data)

                    session['user_token'] = token
                    session['user_id'] = user.id
                    session['user_role'] = user.role

                    flash("Connexion réussie!", "success")
                    redirect_url = "/user" if user.role == 'Client' else "/helper"

                    return jsonify({
                    "access_token": token,
                    "user_id": user.id,
                    "redirect": redirect_url
                    })

                else:
                    flash("Email ou mot de passe incorrect", "danger")
                    return jsonify({"error": "Identifiants invalides"}), 401
            except Exception as e:
                print("Erreur login:", e)
                return jsonify({"error": "Erreur interne"}), 500

            
      
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
                    return redirect(url_for('my_profile'))
                user.password = bcrypt.hash(new_password)

            db.session.commit()
            flash("Profil mis à jour avec succès", "success")
            return redirect(url_for('my_profile'))

        return render_template("my_profile.html", user=user)



    @app.route('/api/get_token', methods=['GET'])
    def get_token():
        token = session.get('user_token')
        if not token:
            return jsonify({"error": "Aucun token trouvé"}), 401
        return jsonify({"token": token})

    @app.route('/register', methods=['POST','GET'])
    def register():
        if request.method == "POST":
            username = request.form['username']
            email = request.form['email']
            password = request.form['password']
            role = "Client"

            existing_user = User.query.filter_by(email=email).first()

            if existing_user:
                 flash("Un compte avec cet email existe déjà.", "danger")
                 return redirect(url_for('register'))
            
            hashed_password = bcrypt.hash(password)
                        
            new_user = User(
                username=username,
                email=email,
                password=hashed_password,
                role=role
            )

            try:
                db.session.add(new_user)
                db.session.commit()

                subject = "Bienvenue sur notre plateforme"
                body = f"Bonjour {username},\n\nVotre compte a été créé avec succès. Vous pouvez maintenant vous connecter."
                send_email(subject, email, body)  

                flash("Compte créé avec succès ! Vous pouvez maintenant vous connecter.", "success")
                return redirect(url_for('login'))
            
            except Exception as e:
                db.session.rollback()
                print("Erreur lors de la création de l'utilisateur :", e)
                flash("Erreur lors de l'inscription, veuillez réessayer.", "danger")

            
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