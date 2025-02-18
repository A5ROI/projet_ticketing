from flask import jsonify, request
from sqlalchemy import text
from database import db

def init_messages_routes(app):
    @app.route('/api/messages', methods=['POST'])
    def send_user_message():
        try:
            data = request.json
            # Insérer le message
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

    @app.route('/api/messages/<int:ticket_id>')
    def get_chat_history(ticket_id):
        try:
            # Vérifier d'abord si le ticket existe
            ticket_query = text("""
                SELECT id FROM tickets WHERE id = :ticket_id
            """)
            ticket_result = db.session.execute(ticket_query, {'ticket_id': ticket_id}).fetchone()
            
            if not ticket_result:
                return jsonify({
                    'messages': [],
                    'ticket_info': None,
                    'error': 'Ticket non trouvé'
                })

            # Récupérer les messages et les informations du ticket
            query = text("""
                SELECT 
                    m.id,
                    m.ticket_id,
                    m.sender_id,
                    m.content,
                    m.sender_type,
                    u.username,
                    DATE_FORMAT(m.created_at, '%d/%m/%Y %H:%i') as formatted_date,
                    t.subject,
                    t.status,
                    t.priority,
                    t.category,
                    t.description,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as ticket_created_at
                FROM tickets t
                LEFT JOIN messages m ON t.id = m.ticket_id
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE t.id = :ticket_id 
                ORDER BY m.created_at ASC
            """)
            
            result = db.session.execute(query, {'ticket_id': ticket_id})
            messages = [dict(zip(result.keys(), row)) for row in result]
            
            # Préparer les informations du ticket
            ticket_info = None
            if messages:
                ticket_info = {
                    'subject': messages[0]['subject'],
                    'status': messages[0]['status'],
                    'priority': messages[0]['priority'],
                    'category': messages[0]['category'],
                    'description': messages[0]['description'],
                    'created_at': messages[0]['ticket_created_at']
                }
                # Filtrer les messages nuls (si pas de messages)
                messages = [m for m in messages if m['id'] is not None]
            
            return jsonify({
                'messages': messages,
                'ticket_info': ticket_info
            })
                
        except Exception as e:
            print(f"Erreur dans get_chat_history: {str(e)}")  # Debug
            return jsonify({
                'messages': [],
                'ticket_info': None,
                'error': str(e)
            }), 500

    @app.route('/api/helper/messages', methods=['POST'])
    def send_helper_message():
        try:
            data = request.json
            # Insérer le message du helper
            query = text("""
                INSERT INTO messages (ticket_id, sender_id, content, sender_type, created_at)
                VALUES (:ticket_id, :sender_id, :content, 'helper', NOW())
            """)
            
            db.session.execute(query, {
                'ticket_id': data['ticket_id'],
                'sender_id': data['sender_id'],
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
            return jsonify({'success': True, 'message': 'Message envoyé'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    return app