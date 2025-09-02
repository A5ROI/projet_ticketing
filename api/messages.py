from flask import jsonify, request, session
from sqlalchemy import text
from data.database import db
from datetime import datetime
import json
from data.email_notifications import send_email
from security import *


def init_messages_routes(app):
    @app.route('/api/messages', methods=['POST'])
    def send_user_message():
        try:
            data = request.json
            query = text("""
                INSERT INTO message (ticket_id, sender_id, content, sender_type, created_at, is_read)
                VALUES (:ticket_id, :sender_id, :content, 'user', NOW(), FALSE)
            """)
            
            db.session.execute(query, {
                'ticket_id': data['ticket_id'],
                'sender_id': data['sender_id'],
                'content': data['content']
            })
            
            
            db.session.commit()
            return jsonify({'success': True, 'message': 'Message envoyé'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    

    @app.route('/message/<int:ticket_id>/mark-as-read', methods=['PUT'])
    def mark_messages_as_read(ticket_id):
        try:
            query = text("""
                UPDATE message
                SET is_read = TRUE
                WHERE ticket_id = :ticket_id
                AND sender_type = IN ('helper', 'admin','user')'
                AND is_read = FALSE
            """)
            db.session.execute(query, {'ticket_id': ticket_id})
            db.session.commit()

            return jsonify({'success': True, 'message': 'Messages marqués comme lus'})

        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @app.route('/message/<int:ticket_id>/mark-as-read/user', methods=['PUT'])
    def mark_messages_as_read_user(ticket_id):
        try:
            query = text("""
                UPDATE message
                SET is_read = TRUE
                WHERE ticket_id = :ticket_id
                AND sender_type IN ('helper', 'admin')
                AND is_read = FALSE
            """)
            db.session.execute(query, {'ticket_id': ticket_id})
            db.session.commit()

            return jsonify({'success': True, 'message': 'Messages marqués comme lus'})

        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500


    @app.route('/api/helper/messages', methods=['POST'])
    def send_helper_message():
        token = session.get('user_token')

        if not token:
            return jsonify({'error': 'Token manquant'}), 401

        user = get_current_user(token)
        sender_type = user['role'].lower()
        try:
            data = request.json
            
            query = text("""
                INSERT INTO message (ticket_id, sender_id, content, sender_type, created_at, is_read)
                VALUES (:ticket_id, :sender_id, :content, :sender_type, NOW(), FALSE)
            """)
            
            db.session.execute(query, {
                'ticket_id': data['ticket_id'],
                'content': data['content'],
                'sender_id': data['sender_id'],
                'sender_type': sender_type
            })
            
            status_query = text("""
                UPDATE ticket 
                SET status = 'En cours' 
                WHERE id = :ticket_id
            """)
            db.session.execute(status_query, {'ticket_id': data['ticket_id']})
            
            email_query= text("""
                SELECT u.email, t.subject
                FROM ticket t
                JOIN "user" u ON t.created_by = u.id
                WHERE t.id = :ticket_id
                """)
            result = db.session.execute(email_query, {'ticket_id': data['ticket_id']}).fetchone()

            if result:
                user_email = result.email
                ticket_subject = result.subject or "Mise à jour de votre ticket"
                subject= f"Réponse à votre ticket : {ticket_subject}"
                body = data['content']

                send_email(subject, user_email, body)
                
            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'Message envoyé',
                'data': {
                    'content': data['content'],
                    'sender_type': sender_type,
                    'sender_name': sender_type,
                    'created_at': datetime.now()
                }
            })
            
        except Exception as e:
            db.session.rollback()
            print(f"Erreur dans send_helper_message: {str(e)}")
            print(str(e))
            return jsonify({'error': str(e)}), 500



    @app.route('/api/messages/<int:ticket_id>', methods=['GET'])
    def get_chat_history(ticket_id):
        try:
            query = text("""
                SELECT 
                    m.id,
                    m.content,
                    m.sender_type,
                    m.sender_id,
                    u.username as sender_name,
                    TO_CHAR(m.created_at, 'DD/MM/YYYY HH24:MI') as created_at
                FROM message m
                LEFT JOIN "user" u ON m.sender_id = u.id
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
                    'sender_id': row.sender_id,
                    'sender_name': row.sender_type,
                    'created_at': row.created_at,
                    'isAdmin': row.sender_type == 'admin',
                    
                })
            print(json.dumps(messages, indent=4))
            return jsonify(messages)
            
        except Exception as e:
            print(f"Erreur dans get_chat_history: {str(e)}")
            return jsonify({'error': str(e)}), 500