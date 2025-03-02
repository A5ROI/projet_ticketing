from flask import jsonify
from data.database import db
from datetime import datetime
import logging

def init_reset_routes(app):
    @app.route('/api/helper/reset-data', methods=['POST'])
    def reset_data():
        try:
            # Logger l'action
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            logging.info(f"Data reset initiated at {current_time}")

            try:
                # Suppression des données dans l'ordre
                db.session.execute(db.text("DELETE FROM messages"))
                db.session.execute(db.text("DELETE FROM attachments"))
                db.session.execute(db.text("DELETE FROM tickets"))
                
                # Validation des changements
                db.session.commit()

                logging.info("Data reset completed successfully")
                
                return jsonify({
                    'success': True,
                    'message': 'Données réinitialisées avec succès',
                    'timestamp': current_time
                })

            except Exception as e:
                # En cas d'erreur, annulation des changements
                db.session.rollback()
                raise e

        except Exception as e:
            logging.error(f"Error during data reset: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500