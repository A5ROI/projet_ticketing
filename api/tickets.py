from flask import jsonify, request
from sqlalchemy import text
from datetime import datetime
import random
from database import db
import json

def init_tickets_routes(app):
    # ROUTES UTILISATEUR
    
    # Création d'un ticket
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

    # Détails d'un ticket spécifique
    @app.route('/api/tickets/<int:ticket_id>/details')
    def get_ticket_details(ticket_id):
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
                    CONCAT('user_', t.created_by) as username,
                    DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') as created_at,
                    COALESCE(
                        CASE 
                            WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                            ELSE NULL
                        END,
                        ''
                    ) as closed_at
                FROM tickets t
                WHERE t.id = :ticket_id
            """)
            
            result = db.session.execute(query, {'ticket_id': ticket_id})
            
            # Correction ici : utiliser result.keys() pour obtenir les noms des colonnes
            column_names = result.keys()
            ticket = [dict(zip(column_names, row)) for row in result]
            
            return jsonify(ticket[0] if ticket else {})
            
        except Exception as e:
            print(f"Erreur dans get_ticket_details: {str(e)}")
            return jsonify({'error': str(e)}), 500

    # Liste des tickets d'un utilisateur
        # Liste des tickets d'un utilisateur
    @app.route('/api/tickets/<int:user_id>')
    def get_user_tickets(user_id):
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
                    CASE 
                        WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                        ELSE NULL
                    END as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query)
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            return jsonify(tickets)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # Recherche de tickets pour les utilisateurs
    @app.route('/api/user/tickets/search', endpoint='user_search_tickets')
    def search_user_tickets():
        try:
            search_term = request.args.get('q', '').lower().strip()
            
            # Mapping des catégories avec versions partielles
            category_mapping = {
                # Gestion de compte - toutes les combinaisons possibles
                'g': 'compte',
                'ge': 'compte',
                'ges': 'compte',
                'gest': 'compte',
                'gesti': 'compte',
                'gestio': 'compte',
                'gestion': 'compte',
                'gestion ': 'compte',
                'gestion d': 'compte',
                'gestion de': 'compte',
                'gestion de ': 'compte',
                'gestion de c': 'compte',
                'gestion de co': 'compte',
                'gestion de com': 'compte',
                'gestion de comp': 'compte',
                'gestion de compt': 'compte',
                'gestion de compte': 'compte',

                # Technique - toutes les combinaisons possibles
                't': 'technique',
                'te': 'technique',
                'tec': 'technique',
                'tech': 'technique',
                'techn': 'technique',
                'techni': 'technique',
                'techniq': 'technique',
                'techniqu': 'technique',
                'technique': 'technique',
                'p': 'technique',
                'pr': 'technique',
                'pro': 'technique',
                'prob': 'technique',
                'probl': 'technique',
                'proble': 'technique',
                'problem': 'technique',
                'probleme': 'technique',
                'problème': 'technique',
                'probleme t': 'technique',
                'problème t': 'technique',
                'probleme te': 'technique',
                'problème te': 'technique',
                'probleme tec': 'technique',
                'problème tec': 'technique',
                'probleme tech': 'technique',
                'problème tech': 'technique',
                'probleme techn': 'technique',
                'problème techn': 'technique',
                'probleme techni': 'technique',
                'problème techni': 'technique',
                'probleme techniq': 'technique',
                'problème techniq': 'technique',
                'probleme techniqu': 'technique',
                'problème techniqu': 'technique',
                'probleme technique': 'technique',
                'problème technique': 'technique',

                # Facturation - toutes les combinaisons possibles
                'f': 'facturation',
                'fa': 'facturation',
                'fac': 'facturation',
                'fact': 'facturation',
                'factu': 'facturation',
                'factur': 'facturation',
                'factura': 'facturation',
                'facturat': 'facturation',
                'facturati': 'facturation',
                'facturatio': 'facturation',
                'facturation': 'facturation',

                # Autre - toutes les combinaisons possibles
                'a': 'autre',
                'au': 'autre',
                'aut': 'autre',
                'autr': 'autre',
                'autre': 'autre'
            }

            
            # Vérifier si le terme de recherche correspond à une catégorie
            mapped_category = category_mapping.get(search_term)
            
            query = text("""
                SELECT DISTINCT
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
                    COALESCE(
                        CASE 
                            WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                            ELSE NULL
                        END,
                        ''
                    ) as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE 
                    CASE
                        WHEN :mapped_category IS NOT NULL THEN t.category = :mapped_category
                        ELSE (
                            LOWER(t.subject) LIKE :partial_search
                            OR LOWER(t.description) LIKE :partial_search
                            OR LOWER(t.priority) LIKE :partial_search
                            OR LOWER(t.status) LIKE :partial_search
                            OR LOWER(u.username) LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d/%m/%Y') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d/%m') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%m/%Y') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%Y') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%H:%i') LIKE :partial_search
                        )
                    END
                ORDER BY 
                    CASE 
                        WHEN DATE_FORMAT(t.created_at, '%d/%m/%Y') = :exact_search THEN 1
                        WHEN DATE_FORMAT(t.created_at, '%d/%m/%Y') LIKE :partial_search THEN 2
                        WHEN LOWER(t.subject) = LOWER(:exact_search) THEN 3
                        WHEN LOWER(t.subject) LIKE :partial_search THEN 4
                        ELSE 5
                    END,
                    t.created_at DESC
            """)
            
            result = db.session.execute(query, {
                'mapped_category': mapped_category,
                'exact_search': search_term,
                'partial_search': f"%{search_term}%"
            })
            
            tickets = [dict(zip(result.keys(), row)) for row in result]
            return jsonify(tickets)
            
        except Exception as e:
            print(f"Erreur dans search_user_tickets: {str(e)}")
            return jsonify({'error': str(e)}), 500


    # Filtrage des tickets par statut pour les utilisateurs
    @app.route('/api/tickets/<int:user_id>/status/<status>')
    def get_tickets_by_status(user_id, status):
        try:
            # Afficher le status reçu pour debug
            print(f"Status reçu: {status}")
            
            status_mapping = {
                'en-cours': 'En cours',
                'en-attente': 'En attente',
                'fermes': 'Fermé'
            }
            db_status = status_mapping.get(status.lower())
            
            # Afficher le status mappé pour debug
            print(f"Status mappé: {db_status}")
            
            if not db_status:
                return jsonify({'error': 'Statut invalide'}), 400

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
            
            # Afficher la requête SQL avec les paramètres pour debug
            print(f"Requête SQL: {query}")
            print(f"Paramètres: status={db_status}")
            
            result = db.session.execute(query, {'status': db_status})
            tickets = [dict(zip(result.keys(), row)) for row in result]
            
            # Afficher le nombre de tickets trouvés pour debug
            print(f"Nombre de tickets trouvés: {len(tickets)}")
            
            return jsonify(tickets)
            
        except Exception as e:
            print(f"Erreur dans get_tickets_by_status: {str(e)}")
            return jsonify({'error': str(e)}), 500



    # ROUTES HELPER

    # Liste de tous les tickets pour les helpers
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
                    CONCAT('user_', t.created_by) as username,
                    COALESCE(DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i'), '') as created_at,
                    COALESCE(
                        CASE 
                            WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                            ELSE NULL
                        END,
                        ''
                    ) as closed_at
                FROM tickets t
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query)
            tickets = []
            for row in result:
                ticket_dict = dict(zip(result.keys(), row))
                if not ticket_dict['created_at']:
                    ticket_dict['created_at'] = ''
                if not ticket_dict['closed_at']:
                    ticket_dict['closed_at'] = ''
                tickets.append(ticket_dict)
            
            return jsonify(tickets)
        except Exception as e:
            print(f"Erreur dans get_helper_tickets: {str(e)}")
            return jsonify({'error': str(e)}), 500

    # Filtrage des tickets par statut pour les helpers
    @app.route('/api/helper/tickets/status/<status>')
    def get_helper_tickets_by_status(status):
        try:
            status_mapping = {
                'en-cours': 'En cours',
                'en-attente': 'En attente',
                'fermes': 'Fermé',
                'en cours': 'En cours',
                'en attente': 'En attente',
                'fermé': 'Fermé',
                'ferme': 'Fermé',
                'En cours': 'En cours',
                'En attente': 'En attente',
                'Fermé': 'Fermé'
            }
            
            db_status = status_mapping.get(status.replace('%20', ' ').lower(), status)
            
            if not db_status:
                return jsonify({'error': 'Statut invalide'}), 400

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
                    CASE 
                        WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                        ELSE NULL
                    END as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.status = :status
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query, {'status': db_status})
            tickets = [dict(zip(result.keys(), row)) for row in result]
            return jsonify(tickets)
            
        except Exception as e:
            print(f"Erreur dans get_helper_tickets_by_status: {str(e)}")
            return jsonify({'error': str(e)}), 500

    # Filtrage des tickets par priorité pour les helpers
    @app.route('/api/helper/tickets/priority/<priority>')
    def get_helper_tickets_by_priority(priority):
        try:
            priority_mapping = {
                'haute': 'Haute',
                'moyenne': 'Moyenne',
                'basse': 'Basse',
                'Haute': 'Haute',
                'Moyenne': 'Moyenne',
                'Basse': 'Basse'
            }
            
            db_priority = priority_mapping.get(priority.replace('%20', ' ').lower(), priority)

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
                    CASE 
                        WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                        ELSE NULL
                    END as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.priority = :priority
                ORDER BY t.created_at DESC
            """)
            
            result = db.session.execute(query, {'priority': db_priority})
            tickets = [dict(zip(result.keys(), row)) for row in result]
            return jsonify(tickets)
            
        except Exception as e:
            print(f"Erreur dans get_helper_tickets_by_priority: {str(e)}")
            return jsonify({'error': str(e)}), 500

    # Fermeture d'un ticket par un helper
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

    # Recherche de tickets pour les helpers
    @app.route('/api/helper/tickets/search', endpoint='helper_search_tickets')
    def search_helper_tickets():
        try:
            search_term = request.args.get('q', '').lower().strip()
            
            # Utiliser exactement le même mapping des catégories que dans search_user_tickets
            category_mapping = {
                # Copier tout le dictionnaire category_mapping de search_user_tickets
                # [Le même mapping complet que dans search_user_tickets]
            }
            
            mapped_category = category_mapping.get(search_term)
            
            query = text("""
                SELECT DISTINCT
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
                    COALESCE(
                        CASE 
                            WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                            ELSE NULL
                        END,
                        ''
                    ) as closed_at
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE 
                    CASE
                        WHEN :mapped_category IS NOT NULL THEN t.category = :mapped_category
                        ELSE (
                            LOWER(t.subject) LIKE :partial_search
                            OR LOWER(t.description) LIKE :partial_search
                            OR LOWER(t.priority) LIKE :partial_search
                            OR LOWER(t.status) LIKE :partial_search
                            OR LOWER(u.username) LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d/%m/%Y') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d/%m') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%m/%Y') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%Y') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i') LIKE :partial_search
                            OR DATE_FORMAT(t.created_at, '%H:%i') LIKE :partial_search
                        )
                    END
                ORDER BY 
                    CASE 
                        WHEN DATE_FORMAT(t.created_at, '%d/%m/%Y') = :exact_search THEN 1
                        WHEN DATE_FORMAT(t.created_at, '%d/%m/%Y') LIKE :partial_search THEN 2
                        WHEN LOWER(t.subject) = LOWER(:exact_search) THEN 3
                        WHEN LOWER(t.subject) LIKE :partial_search THEN 4
                        ELSE 5
                    END,
                    t.created_at DESC
            """)
            
            result = db.session.execute(query, {
                'mapped_category': mapped_category,
                'exact_search': search_term,
                'partial_search': f"%{search_term}%"
            })
            
            tickets = [dict(zip(result.keys(), row)) for row in result]
            return jsonify(tickets)
            
        except Exception as e:
            print(f"Erreur dans search_helper_tickets: {str(e)}")
            return jsonify({'error': str(e)}), 500

    # Détails d'un ticket pour les helpers
    @app.route('/api/helper/tickets/<int:ticket_id>')
    def get_helper_ticket_details(ticket_id):
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
                    CASE 
                        WHEN t.closed_at IS NOT NULL THEN DATE_FORMAT(t.closed_at, '%d/%m/%Y %H:%i')
                        ELSE NULL
                    END as closed_at,
                    (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', m.id,
                                'content', m.content,
                                'sender_type', m.sender_type,
                                'formatted_date', DATE_FORMAT(m.created_at, '%d/%m/%Y %H:%i')
                            )
                        )
                        FROM messages m
                        WHERE m.ticket_id = t.id
                        ORDER BY m.created_at ASC
                    ) as messages
                FROM tickets t
                JOIN users u ON t.created_by = u.id
                WHERE t.id = :ticket_id
            """)
            
            result = db.session.execute(query, {'ticket_id': ticket_id})
            row = result.fetchone()
            
            if not row:
                return jsonify({'error': 'Ticket non trouvé'}), 404
                
            ticket = dict(zip(result.keys(), row))
            
            if ticket['messages']:
                ticket['messages'] = json.loads(ticket['messages'])
            else:
                ticket['messages'] = []
                
            return jsonify(ticket)
        except Exception as e:
            print(f"Erreur : {str(e)}")
            return jsonify({'error': str(e)}), 500

    return app
