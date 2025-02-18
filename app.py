from flask import Flask, render_template
from database import db
from api.tickets import init_tickets_routes
from api.messages import init_messages_routes
from api.reset import init_reset_routes

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://mheib:Azerty123!@localhost/ticketing_system'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialiser la base de données
    db.init_app(app)

    # Routes principales
    @app.route('/')
    def home():
        return render_template('home.html')

    @app.route('/user')
    def user_dashboard():
        return render_template('user_dashboard.html')

    @app.route('/helper')
    def helper_dashboard():
        return render_template('helper_dashboard.html')

    # Initialisation des routes API
    init_tickets_routes(app)
    init_messages_routes(app)
    init_reset_routes(app)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)