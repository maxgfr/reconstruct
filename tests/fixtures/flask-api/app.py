from flask import Flask, jsonify
from models import db
from routes.users import bp as users_bp

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = __import__("os").environ.get("DATABASE_URL", "sqlite:///app.db")
    db.init_app(app)
    app.register_blueprint(users_bp, url_prefix="/api/users")

    @app.route("/health")
    def health():
        return jsonify(ok=True)

    return app

if __name__ == "__main__":
    create_app().run()
