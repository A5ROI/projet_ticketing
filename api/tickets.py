from flask import jsonify, request
from sqlalchemy import text
from datetime import datetime
import random
from database import db

def init_tickets_routes(app):
    @app.route('/api/tickets', methods=['POST'])
    def create_ticket():
        try:
            data = request.json
            random_user_id = random.randint(100000, 999999)
            
            create_user_query = text("""
                INSERT IGNORE INTO users (id, username, role)
                VALUES (:user_id, :username, 'user')
            """)
            
            db.session.execute(create_user_query, {
                'user_id': random_user_id,
                'username': f'user_{random_user_id}'
            })
            
            ticket_query = text("""
                INSERT INTO tickets 
                (subject, description, category, priority, status, created_by, created_at)
                VALUES 
                (:subject, :description, :category, :priority, 'En attente', :user_id, NOW())
            """)
            
            db.session.execute(ticket_query, {
                'subject': data['subject'],
                'description': data['description'],
                'category': data['category'],
                'priority': data['priority'],
                'user_id': random_user_id
            })
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Ticket créé avec succès',
                'user_id': random_user_id
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/tickets/<int:user_id>')
    def get_user_tickets(user_id):
        try:
            # Requête modifiée pour récupérer tous les tickets
            query = text("""
                SELECT 
                    t.id,
                    t.subject,
                    t.description,
                    t.category,
                    t.priority,
                    t.status,
                    t.created_by,
                    t.close_reason,
                    u.username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i') as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                ORDER BY t.created_at DESC
            """)
            
            # Suppression du filtre WHERE t.created_by = :user_id
            result = db.session.execute(query)
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            print(f"Tickets trouvés : {len(tickets)}")  # Debug
            
            return jsonify(tickets)
        except Exception as e:
            print(f"Erreur : {str(e)}")  # Debug
            return jsonify({'error': str(e)}), 500



    @app.route('/api/tickets/<int:user_id>/status/<status>')
    def get_user_tickets_by_status(user_id, status):
        try:
            query = text("""
                SELECT 
                    t.id,
                    t.subject,
                    t.description,
                    t.category,
                    t.priority,
                    t.status,
                    t.created_by,
                    t.close_reason,
                    u.username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i') as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.created_by = :user_id 
                AND t.status = :status
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query, {'user_id': user_id, 'status': status})
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            return jsonify(tickets)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/tickets/search')
    def search_user_tickets():
        try:
            search_term = request.args.get('q', '')
            user_id = request.args.get('user_id')
            
            query = text("""
                SELECT 
                    t.id,
                    t.subject,
                    t.description,
                    t.category,
                    t.priority,
                    t.status,
                    t.created_by,
                    t.close_reason,
                    u.username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i') as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.created_by = :user_id
                AND (t.subject LIKE :search 
                OR t.description LIKE :search 
                OR t.category LIKE :search)
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query, {
                'user_id': user_id,
                'search': f'%{search_term}%'
            })
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            return jsonify(tickets)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # Routes Helper
    @app.route('/api/helper/tickets')
    def get_helper_tickets():
        try:
            query = text("""
                SELECT 
                    t.id,
                    t.subject,
                    t.description,
                    t.category,
                    t.priority,
                    t.status,
                    t.created_by,
                    t.close_reason,
                    u.username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i') as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                ORDER BY 
                    CASE 
                        WHEN t.priority = 'Haute' THEN 1
                        WHEN t.priority = 'Moyenne' THEN 2
                        WHEN t.priority = 'Basse' THEN 3
                    END,
                    t.created_at DESC
            """)
            
            result = db.session.execute(query)
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            return jsonify(tickets)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/helper/tickets/status/<status>')
    def get_helper_tickets_by_status(status):
        try:
            query = text("""
                SELECT 
                    t.id,
                    t.subject,
                    t.description,
                    t.category,
                    t.priority,
                    t.status,
                    t.created_by,
                    t.close_reason,
                    u.username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i') as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.status = :status
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query, {'status': status})
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            return jsonify(tickets)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/helper/tickets/priority/<priority>')
    def get_helper_tickets_by_priority(priority):
        try:
            query = text("""
                SELECT 
                    t.id,
                    t.subject,
                    t.description,
                    t.category,
                    t.priority,
                    t.status,
                    t.created_by,
                    t.close_reason,
                    u.username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i') as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.priority = :priority
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query, {'priority': priority})
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            return jsonify(tickets)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/helper/tickets/search')
    def search_helper_tickets():
        try:
            search_term = request.args.get('q', '')
            query = text("""
                SELECT 
                    t.id,
                    t.subject,
                    t.description,
                    t.category,
                    t.priority,
                    t.status,
                    t.created_by,
                    t.close_reason,
                    u.username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i') as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.subject LIKE :search
                OR t.description LIKE :search
                OR t.category LIKE :search
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query, {'search': f'%{search_term}%'})
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            return jsonify(tickets)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/helper/tickets/<int:ticket_id>/close', methods=['POST'])
    def close_helper_ticket(ticket_id):
        try:
            data = request.json
            query = text("""
                UPDATE tickets
                SET status = 'Fermé',
                    closed_at = NOW(),
                    close_reason = :reason
                WHERE id = :ticket_id
            """)
            
            db.session.execute(query, {
                'ticket_id': ticket_id,
                'reason': data.get('reason')
            })
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Ticket fermé avec succès'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500