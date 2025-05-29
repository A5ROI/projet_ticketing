from flask import jsonify, request, session, Flask
from sqlalchemy import text, or_
from datetime import datetime
from data.database import *
from pydantic import BaseModel
from security import *
from data.models import Ticket, Category, Message
import os, uuid, logging, base64, traceback
from werkzeug.utils import secure_filename
from data.email_notifications import send_email


logging.basicConfig(level=logging.DEBUG)

class TicketCreate(BaseModel):
    subject: str
    description: str
    priority: str
    category_id: int

def init_tickets_routes(app):
    @app.route('/api/tickets', methods=['POST'])
    def create_ticket():
        subject = request.form.get('subject')
        description = request.form.get('description')
        category_id = request.form.get('category')
        image_file = request.files.get('attachments')
        print("subject:", subject)
        print("description:", description)
        print("category:", category_id)
        print("image_file:", image_file)


        try:
            # ✅ Récupérer le token stocké en session
            token = session.get('user_token')

            if not token:
                return jsonify({"error": "Utilisateur non authentifié"}), 401

            current_user = get_current_user(token)
            user = User.query.get(current_user['id'])  
            
            image_file = request.files.get('attachments') 
            image_path = None

            if image_file:
                filename = secure_filename(image_file.filename)
                image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                image_file.save(image_path)
                
                
            # Créer un nouveau ticket
            new_ticket = Ticket(
                subject=subject,
                description=description,
                priority='Basse',
                created_by=current_user['id'],  
                category_id=category_id,
                image_path=image_path
            )
            


            db.session.add(new_ticket)
            db.session.commit()

            helper_query = User.query.filter(
                    User.role == 'Helper',
                    User.category_id == category_id
                ).all()
            support_emails = [row.email for row in helper_query]


            for email in support_emails:
                subject_email = f"Nouveau Ticket : {subject}"
                body_email = f"""
                    Bonjour,

                    Un nouveau ticket a été créé dans votre catégorie.

                    Sujet: {subject}
                    Description: {description}
                    Priorité: Basse
                    Utilisateur: {current_user['username']}

                    Merci de vous connecter à la plateforme pour le consulter.
                """
                send_email(subject_email, email, body_email)

                subject_user = "Confirmation de soumission de votre ticket"
                body_user = f"""
                    Bonjour {current_user['username']},
                    Votre ticket a bien été soumis avec les informations suivantes :
                    Sujet: {subject}
                    Description: {description}
                    Priorité: Basse
                    Notre équipe va examiner votre demande dans les plus brefs délais.
                    
                    Attrape ton ticket 
                """
                print(user.email)
                send_email(subject_user, user.email, body_user)

            return jsonify({"success": True, "message": "Ticket créé avec succès"}), 201

        except Exception as e:
            db.session.rollback()
            print(str(e))
            return jsonify({"error": f"Erreur lors de la création du ticket : {str(e)}"}), 500
            
    @app.route('/api/tickets', methods=['GET'])
    def get_all_tickets():
        try:
            print(f"🔍 Cookies reçus : {request.cookies}")  # Debug
            token = session.get('user_token')
            print(f"🔍 Token récupéré depuis session : {token}")  # Debug

            if not token:
                return jsonify({'error': 'Unauthorized: Token not found in session'}), 40

            user = get_current_user(token)
            print(f"👤 Utilisateur connecté : {user}")

            if user['role'] == 'Client':
                tickets = Ticket.query.filter_by(created_by=user['id']).all()
                print(tickets)
            elif user['role'] == 'Helper':
                user_db = User.query.get(user['id'])
                tickets = Ticket.query.filter_by(category_id = user_db.category_id).all()
                print(f"✅ Tickets trouvés : {len(tickets)}")
            elif user['role'] == 'Admin':
                tickets = Ticket.query.all()

            tickets_list = []

            for ticket in tickets:
                try:
                    
                    if ticket.status != 'Fermé':
                        if isinstance(user, dict):
                            role = user['role']
                        else:
                            role = getattr(user, 'role', 'Client')
                        if role == 'Client':
                            sender_types_to_check = ['helper', 'admin']
                        else:
                            sender_types_to_check = ['user']   
                        has_unread = db.session.query(Message).filter(
                            Message.ticket_id == ticket.id,
                            Message.sender_type.in_(sender_types_to_check),
                            or_(
                                Message.is_read == False,
                                Message.is_read.is_(None)
                            )
                        ).first()
                    else:
                        has_unread=None

                    tickets_list.append({
                        "id": ticket.id,
                        "subject": ticket.subject,
                        "category": ticket.category.name if ticket.category else "Inconnue",
                        "priority": ticket.priority,
                        "status": ticket.status,
                        "created_at": ticket.created_at.strftime("%d/%m/%Y %H:%M"),
                        "username": ticket.creator.username if ticket.creator else "Anonyme",
                        "is_read": False if has_unread else True
                    })
                    print(f"Ticket {ticket.id} has_unread = {bool(has_unread)}")
                except Exception as e:
                    print(f"⚠️ Erreur ticket {ticket.id}: {e}")

            return jsonify(tickets_list), 200

        except Exception as e:
            print(traceback.format_exc())
            return jsonify({'error': f"Erreur : {str(e)}"}), 500

    
    
    @app.route('/api/tickets/<int:id>', methods=['GET'])
    def get_ticket(id):
        token = session.get('user_token')
        user = get_current_user(token)
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            query = text("""
                         SELECT ticket.*, "user".username 
                            FROM ticket
                            JOIN "user" ON ticket.created_by = "user".id
                         WHERE ticket.id = :id
                         """)
            result = db.session.execute(query, {'id': id}).mappings().fetchone()
            if not result:
                return jsonify({'error': 'Ticket not found'}), 404
            return jsonify(dict(result))
        except Exception as e:
            print(str(e))
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/tickets/<int:id>', methods=['PUT'])
    def update_ticket(id):
        token = session.get('user_token')
        user = get_current_user(token)
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            data = request.json
            update_query = text("""
                UPDATE ticket 
                                SET priority = :priority 
                WHERE id = :id
            """)
            db.session.execute(update_query, {
                'id': id,
                'priority': data['priority'],
            })
            db.session.commit()
            return jsonify({'success': True, 'message': 'Ticket mis à jour'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    

    @app.route('/api/tickets/<int:id>', methods=['DELETE'])
    def delete_ticket(id):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            delete_query = text("DELETE FROM tickets WHERE id = :id AND created_by = :user_id")
            db.session.execute(delete_query, {'id': id, 'user_id': user['id']})
            db.session.commit()
            return jsonify({'success': True, 'message': 'Ticket supprimé'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    

    @app.route('/api/tickets/<int:id>/close', methods=['PATCH'])
    def close_ticket(id):
        token = session.get('user_token')
        user = get_current_user(token)
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            data = request.get_json() or {}
            print("📦 JSON reçu :", data) 
            reason = data.get('reason', '')


            close_query = text(""" 
                UPDATE ticket 
                SET status = 'Fermé', close_reason = :reason, closed_at = :closed_at 
                WHERE id = :id 
            """)

            db.session.execute(close_query,{
                'id': id,
                'reason': reason,
                'closed_at': datetime.utcnow()
                })
            db.session.commit()
            return jsonify({'success': True, 'message': 'Ticket fermé avec succès'})
        except Exception as e:
            db.session.rollback()
            print(e)
            return jsonify({'error': str(e)}), 500
    
    return app
