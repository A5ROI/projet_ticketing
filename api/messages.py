from flask import jsonify, request
from sqlalchemy import text
from database import db
from datetime import datetime
import json

def init_messages_routes(app):
    @app.route('/api/messages', methods=['POST'])
    def send_user_message():
        try:
            data = request.json
            query = text("""
                INSERT INTO messages (ticket_id, sender_id, content, sender_type, created_at)
                VALUES (:ticket_id, :sender_id, :content, 'user', NOW())
            """)
            
            db.session.execute(query, {
                'ticket_id': data['ticket_id'],
                'sender_id': data['sender_id'],
                'content': data['content']
            })
            
            # Mettre à jour le statut du ticket
            status_query = text("""
                UPDATE tickets 
                SET status = 'En attente' 
                WHERE id = :ticket_id
            """)
            db.session.execute(status_query, {'ticket_id': data['ticket_id']})
            
            db.session.commit()
            return jsonify({'success': True, 'message': 'Message envoyé'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @app.route('/api/helper/messages', methods=['POST'])
    def send_helper_message():
        try:
            data = request.json
            
            # Insérer le message avec l'ID du helper_admin existant
            query = text("""
                INSERT INTO messages (ticket_id, sender_id, content, sender_type, created_at)
                VALUES (:ticket_id, 1, :content, 'helper', NOW())
            """)
            
            db.session.execute(query, {
                'ticket_id': data['ticket_id'],
                'content': data['content']
            })
            
            # Mettre à jour le statut du ticket
            status_query = text("""
                UPDATE tickets 
                SET status = 'En cours' 
                WHERE id = :ticket_id
            """)
            db.session.execute(status_query, {'ticket_id': data['ticket_id']})
            
            db.session.commit()

            # Retourner les données du message pour mise à jour immédiate
            return jsonify({
                'success': True,
                'message': 'Message envoyé',
                'data': {
                    'content': data['content'],
                    'sender_type': 'helper',
                    'sender_name': 'helper_admin',
                    'created_at': datetime.now().strftime('%d/%m/%Y %H:%M')
                }
            })
            
        except Exception as e:
            db.session.rollback()
            print(f"Erreur dans send_helper_message: {str(e)}")
            return jsonify({'error': str(e)}), 500



    # Route pour récupérer les messages
    @app.route('/api/messages/<int:ticket_id>')
    def get_chat_history(ticket_id):
        try:
            query = text("""
                SELECT 
                    m.id,
                    m.content,
                    m.sender_type,
                    u.username as sender_name,
                    DATE_FORMAT(m.created_at, '%d/%m/%Y %H:%i') as created_at
                FROM messages m
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE m.ticket_id = :ticket_id
                ORDER BY m.created_at ASC
            """)
            
            result = db.session.execute(query, {'ticket_id': ticket_id})
            messages = []
            
            for row in result:
                messages.append({
                    'id': row.id,
                    'content': row.content,
                    'sender_type': row.sender_type,
                    'sender_name': row.sender_name or 'helper_admin',
                    'created_at': row.created_at,
                    'isAdmin': row.sender_type == 'helper'
                })
            
            return jsonify(messages)
            
        except Exception as e:
            print(f"Erreur dans get_chat_history: {str(e)}")
            return jsonify({'error': str(e)}), 500