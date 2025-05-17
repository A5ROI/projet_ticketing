from data.database import db, Boolean
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    CLIENT = "Client"
    HELPER = "Helper"
    ADMIN = "Admin"

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    helpers = db.relationship('User', back_populates='category')
    tickets = db.relationship('Ticket', back_populates='category')

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default=UserRole.CLIENT)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    category = db.relationship('Category', back_populates='helpers')
    tickets = db.relationship('Ticket', back_populates='creator')

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    subject = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), default='En attente')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    closed_at = db.Column(db.DateTime, nullable=True)
    close_reason = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    creator = db.relationship('User', back_populates='tickets')
    category = db.relationship('Category', back_populates='tickets')
    image_path = db.Column(db.String(255)) 

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    sender_type = db.Column(db.String(50), nullable=False)  # 'user' ou 'helper'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(Boolean, default=False)
    # Relations
    ticket = db.relationship('Ticket', back_populates='messages')
    sender = db.relationship('User', back_populates='messages')
    
    @property
    def sender_name(self):
        return self.sender.username if self.sender else "Inconnu"

# Ajout de la relation dans Ticket et User
Ticket.messages = db.relationship('Message', back_populates='ticket', cascade="all, delete-orphan")
User.messages = db.relationship('Message', back_populates='sender', cascade="all, delete-orphan")
