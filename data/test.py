# seed.py
from passlib.hash import bcrypt
from data.database import db
from data.models import User, Category, UserRole

def seed_data():
    # 🔹 Catégories désirées
    desired_categories = {
        1: "Problème technique",
        2: "Gestion de compte",
        3: "Facturation",
        4: "Autre"
    }

    # 🔹 Créer les catégories manquantes ou récupérer les existantes
    existing_categories = Category.query.all()
    name_to_id = {c.name: c.id for c in existing_categories}

    for cid, name in desired_categories.items():
        if name not in name_to_id:
            cat = Category(name=name)
            db.session.add(cat)
            db.session.flush()
            name_to_id[name] = cat.id

    db.session.commit()
    print("✅ Catégories vérifiées / créées.")

    # 🔹 Supprimer les anciens utilisateurs ciblés (admins + helpers)
    targets = [
        "admin1@example.com", "admin2@example.com",
        "helper1@example.com", "helper2@example.com",
        "helper3@example.com", "helper4@example.com"
    ]
    User.query.filter(User.email.in_(targets)).delete(synchronize_session=False)
    db.session.commit()

    # 🔹 Créer les admins
    admins = [
        User(username="admin1", email="admin1@example.com",
             password=bcrypt.hash("password123"), role=UserRole.ADMIN),
        User(username="admin2", email="admin2@example.com",
             password=bcrypt.hash("password123"), role=UserRole.ADMIN)
    ]

    # 🔹 Créer les helpers avec les category_id corrects
    helpers = [
        User(username="helper1", email="helper1@example.com",
             password=bcrypt.hash("password123"), role=UserRole.HELPER,
             category_id=name_to_id["Problème technique"]),
        User(username="helper2", email="helper2@example.com",
             password=bcrypt.hash("password123"), role=UserRole.HELPER,
             category_id=name_to_id["Gestion de compte"]),
        User(username="helper3", email="helper3@example.com",
             password=bcrypt.hash("password123"), role=UserRole.HELPER,
             category_id=name_to_id["Facturation"]),
        User(username="helper4", email="helper4@example.com",
             password=bcrypt.hash("password123"), role=UserRole.HELPER,
             category_id=name_to_id["Autre"])
    ]

    # 🔹 Ajouter tous les utilisateurs
    db.session.add_all(admins + helpers)
    db.session.commit()
    print("✅ Admins + Helpers créés avec succès.")

    # 🔹 Affichage de contrôle
    print("—— Catégories en base ———")
    for c in Category.query.order_by(Category.id).all():
        print(f"{c.id} - {c.name}")
    print("———————————————")
    print("Terminé ✅")
