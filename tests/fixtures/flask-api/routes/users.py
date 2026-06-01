from flask import Blueprint, jsonify, request
from models import db, User

bp = Blueprint("users", __name__)

@bp.route("/", methods=["GET"])
def list_users():
    return jsonify([])

@bp.route("/", methods=["POST"])
def create_user():
    user = User(email=request.json["email"])
    db.session.add(user)
    db.session.commit()
    return jsonify(id=user.id), 201
