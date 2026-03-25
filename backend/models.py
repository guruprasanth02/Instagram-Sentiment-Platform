from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone

db = SQLAlchemy()


def _utcnow():
    return datetime.now(timezone.utc)


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    photo_url = db.Column(db.String(500), nullable=True)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_expires = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)
    analyses = db.relationship('Analysis', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        self.reset_token = None
        self.reset_expires = None

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Analysis(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    post_url = db.Column(db.String(500), nullable=False)
    post_id = db.Column(db.String(50))
    results_json = db.Column(db.Text)
    total = db.Column(db.Integer)
    positive_count = db.Column(db.Integer)
    neutral_count = db.Column(db.Integer)
    negative_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=_utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'post_url': self.post_url,
            'post_id': self.post_id,
            'positive_pct': round(self.positive_count / self.total * 100) if self.total else 0,
            'total': self.total,
            'created_at': self.created_at.isoformat()
        }

