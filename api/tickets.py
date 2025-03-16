from flask import jsonify, request, session
from sqlalchemy import text
from datetime import datetime
import random
from sqlalchemy.orm import Session
from data.database import *
import json
from pydantic import BaseModel
from security import *
import logging
from data.models import Ticket, Category

logging.basicConfig(level=logging.DEBUG)

class TicketCreate(BaseModel):
    subject: str
    description: str
    priority: str
    category_id: int

def init_tickets_routes(app):
    @app.route('/api/tickets', methods=['POST'])
    def create_ticket():
        try:
            # ✅ Récupérer le token stocké en session
            token = session.get('user_token')

            if not token:
                return jsonify({"error": "Utilisateur non authentifié"}), 401

            current_user = get_current_user(token)  

            # Récupérer les données JSON envoyées
            ticket_data = request.get_json()
            if not ticket_data:
                return jsonify({"error": "Données JSON manquantes"}), 400

            # Créer un nouveau ticket
            new_ticket = Ticket(
                subject=ticket_data['subject'],
                description=ticket_data['description'],
                priority=ticket_data['priority'],
                created_by=current_user['id'],
                category_id=ticket_data['category']
            )

            db.session.add(new_ticket)
            db.session.commit()

            return jsonify({"success": True, "message": "Ticket créé avec succès"}), 201

        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Erreur lors de la création du ticket : {str(e)}"}), 500
            
    @app.route('/api/tickets', methods=['GET'])
    def get_all_tickets():
        try:
            token = session.get('user_token')  # Vérifie si le token est stocké dans les cookies
            print(token)
            if not token:
                return jsonify({'error': 'Unauthorized: Token not found'}), 401  # Message plus clair

            print(f"🔍 Token récupéré : {token}")  # Debugging

            user = get_current_user(token)  # Vérifie l'utilisateur avec le token

            # Log pour voir si l'utilisateur est récupéré correctement
            print(f"👤 Utilisateur connecté : {user}")

            # Récupération des tickets selon le rôle
            if user['role'] == 'Client':
                tickets = Ticket.query.filter_by(created_by=user['id']).all()
            elif user['role'] == 'Helper':
                print("🔍 Recherche des tickets de la catégorie...")
                tickets = Ticket.query.filter(Ticket.category_id == user['category_id']).all() 
                print(f"✅ Tickets trouvés : {len(tickets)}") 
            else:
                tickets = Ticket.query.all()

            tickets_list = [{
                "id": ticket.id,
                "subject": ticket.subject,
                "category": ticket.category.name,
                "priority": ticket.priority,
                "status": ticket.status,
                "created_at": ticket.created_at.strftime("%d/%m/%Y %H:%M")
            } for ticket in tickets]

            return jsonify(tickets_list), 200

        except Exception as e:
            return jsonify({'error': f"Erreur : {str(e)}"}), 500

    
    @app.route('/api/tickets/<int:id>', methods=['GET'])
    def get_ticket(id):
        token = session.get('user_token')
        user = get_current_user(token)
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            query = text("SELECT * FROM ticket WHERE id = :id")
            result = db.session.execute(query, {'id': id}).mappings().fetchone()
            if not result:
                return jsonify({'error': 'Ticket not found'}), 404
            return jsonify(dict(result))
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/tickets/<int:id>', methods=['PUT'])
    def update_ticket(id):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            data = request.json
            update_query = text("""
                UPDATE tickets SET subject = :subject, description = :description, category = :category, priority = :priority
                WHERE id = :id AND created_by = :user_id
            """)
            db.session.execute(update_query, {
                'id': id,
                'subject': data['subject'],
                'description': data['description'],
                'category': data['category'],
                'priority': data['priority'],
                'user_id': user['id']
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
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            close_query = text("UPDATE tickets SET status = 'Fermé' WHERE id = :id")
            db.session.execute(close_query, {'id': id})
            db.session.commit()
            return jsonify({'success': True, 'message': 'Ticket fermé'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    return app