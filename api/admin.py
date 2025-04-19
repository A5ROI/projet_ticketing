from flask import request, render_template, flash, redirect, url_for
from data.models import *
from data.email_notifications import *
from passlib.hash import bcrypt


def register_routes(app):

    @app.route('/users', methods=['GET'])
    def list_users():
        users = User.query.all()
        print(users)
        return render_template('users_list.html', users=users)


    @app.route('/create-user', methods=['POST', 'GET'])
    def create_user():
        if request.method == 'POST':
            username = request.form['username']
            email = request.form['email']
            role = request.form['role']
            category_id = request.form['category_id']
        
            try:
                create_helper_user(username, email, role, category_id)
                flash("Utilisateur créé avec succès. Un email a été envoyé.", "success")
                return redirect(url_for('list_users'))
            except Exception as e:
                flash(f"Erreur : {e}", "danger")
    
        return render_template('create_user.html')
    

    @app.route('/user/<int:user_id>/tickets')
    def user_tickets(user_id):
        user = User.query.get_or_404(user_id)

        if user.role == 'Client':
            tickets = Ticket.query.filter_by(created_by=user.id).all()
        elif user.role == 'Helper':
            tickets = Ticket.query.filter_by(category_id=user.category_id).all()
        else:
            tickets = []

        return render_template('user_tickets.html', user=user, tickets=tickets)

    
   
    @app.route('/send_reset_email/<int:user_id>', methods=['GET'])
    def send_reset_email(user_id):
        user = User.query.get_or_404(user_id)
        
        try:
            # Appel de la fonction pour envoyer l'email de réinitialisation
            send_reset_password(user)
            # Rediriger vers la liste des utilisateurs avec un message de succès
            return redirect(url_for('list_users', message="Email de réinitialisation envoyé."))
        except Exception as e:
            # En cas d'erreur, tu peux rediriger avec un message d'erreur
            return redirect(url_for('list_users', message=f"Erreur lors de l'envoi de l'email : {str(e)}"))
    
    
    @app.route('/update-password/<token>', methods=['POST', 'GET'])
    def update_password(token):
        try:
            # Décryptage du token pour obtenir l'email de l'utilisateur
            email = serializer.loads(token, salt='reset-password', max_age=3600)  # Le lien expire après 1 heure
        except Exception as e:
            flash("Le lien a expiré ou est invalide.", "danger")
            return redirect(url_for('login'))

        user = User.query.filter_by(email=email).first()

        if not user:
            flash("Utilisateur non trouvé.", "danger")
            return redirect(url_for('login'))

        if request.method == 'POST':
            email = request.form['email']
            old_password = request.form['old_password']
            new_password = request.form['new_password']
            confirm_password = request.form['confirm_password']

            if not bcrypt.verify(old_password, user.password ):
                flash("Ancien mot de passe incorrect", "danger")
                return redirect(request.url)

            if new_password != confirm_password:
                flash("Les mots de passe ne correspondent pas", "danger")
                return redirect(request.url)
            print("mdp:" + user.password)
            user.password = bcrypt.hash(new_password)
            db.session.commit()

            flash("Mot de passe mis à jour avec succès. Connectez-vous à nouveau.", "success")
            return redirect(url_for('login'))  # Assure-toi que la route 'login' existe

        return render_template('update_password.html', token=token)  # Ton template déjà prêt
