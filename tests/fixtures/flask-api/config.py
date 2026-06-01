import os
SECRET_KEY = os.environ.get("SECRET_KEY", "dev")
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///app.db")
