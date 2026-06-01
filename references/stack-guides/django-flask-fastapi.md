# Python Web — Django · Flask · FastAPI

**When:** `inventory.stack` includes python + one of: `django`/`manage.py`/`settings.py` (Django), `flask`/`Flask(__name__)` (Flask), `fastapi`/`uvicorn`/`APIRouter` (FastAPI); confirm via `requirements.txt`, `pyproject.toml`, `Pipfile`, or top imports.

## Where the interface surface lives
**Django:** routes in `urls.py` (project root + per-app). `urlpatterns = [...]` with `path("posts/<int:pk>/", views.detail, name=...)` / `re_path(r"...")`. Full path = nested `include("app.urls")` prefixes concatenated — trace `ROOT_URLCONF` (in settings) downward. Views in `views.py`: function views OR CBVs (`class X(View/ListView/DetailView)` → HTTP verb = `get`/`post` methods). **DRF:** `routers.DefaultRouter().register("prefix", ViewSet)` auto-generates list/detail/CRUD routes — expand ViewSet actions (`list`,`create`,`retrieve`,`update`,`partial_update`,`destroy` + `@action(detail=, methods=)`) into rows; IO shape from `serializer_class`. Auth from `permission_classes`/`authentication_classes` (`IsAuthenticated`, etc.) or global `REST_FRAMEWORK` settings. Admin routes in `admin.py`.
**Flask:** `@app.route("/x", methods=["GET","POST"])` or `@app.get/post`. Blueprints: `bp = Blueprint("name", __name__, url_prefix="/api")` then `@bp.route(...)`; full path = `url_prefix` + route, mounted via `app.register_blueprint(bp, url_prefix=...)` (register prefix overrides/concats). Class views via `MethodView` + `app.add_url_rule`. Flask-RESTful: `api.add_resource(Res, "/path")` with `get/post` methods.
**FastAPI:** `@app.get/post/put/patch/delete("/x")` and `router = APIRouter(prefix="/users", tags=[...])` → `@router.get(...)`; full path = router `prefix` + path, plus prefix from `app.include_router(router, prefix="/api/v1")` (concat all). Path params `{id}`, request/response models in `response_model=`, body via Pydantic param. Auth via `Depends(get_current_user)`/`Security(...)` / `OAuth2PasswordBearer`. Background work: `BackgroundTasks`, Celery `@shared_task`/`@app.task` (search `tasks.py`), APScheduler, Django management commands (`management/commands/*.py` → `Command.handle`).

## Data model
**Django ORM:** `models.py` per app. `class Post(models.Model)` → fields = `CharField/IntegerField/DateTimeField/...`; relations `ForeignKey`/`OneToOneField`/`ManyToManyField(to, on_delete=, related_name=)`. `class Meta` holds `db_table`, `indexes`, `unique_together`, `ordering`. Migrations in `app/migrations/00xx_*.py` (authoritative DDL). **SQLAlchemy** (Flask/FastAPI): `class X(Base)` with `__tablename__`, `Column(Type, primary_key=, ForeignKey("t.id"))`, `relationship(..., back_populates=)`; or 2.0 `Mapped[]`/`mapped_column()`. **SQLModel** (FastAPI): `class X(SQLModel, table=True)` — doubles as Pydantic + table. Migrations: Alembic `alembic/versions/*.py`. Note: Pydantic models are IO DTOs, NOT tables — keep them out of DATA-MODEL.md unless SQLModel.

## Entry points & boot
Django: `manage.py` (CLI), `wsgi.py`/`asgi.py` (server), `settings.py` (`INSTALLED_APPS`, `ROOT_URLCONF`, `DATABASES`, `MIDDLEWARE`). Flask: app factory `create_app()` or module-level `app = Flask(__name__)`; run via `flask run`/`app.run()`/gunicorn. FastAPI: `main.py` with `app = FastAPI()`, served by `uvicorn main:app`; startup in `@app.on_event`/`lifespan`.

## Config & env
Env via `os.environ`, `python-decouple`, `django-environ`, `pydantic-settings BaseSettings`, or `.env` + `python-dotenv`. Deps: `requirements*.txt`, `pyproject.toml` (poetry/pdm/uv), `Pipfile`. Run/build: `Procfile`, `Makefile`, `docker-compose.yml`, `gunicorn.conf.py`, `pytest.ini`/`tox.ini`.

## Gotchas
- DRF router routes are **implicit** — never literal in urls.py; you must enumerate ViewSet+`@action` methods to get the real endpoint list.
- Django CBV path = which HTTP methods the class implements (`get`/`post`/`put`), not the URL line.
- Multiple `include()` levels + DRF `NestedRouter` mean the real path is a concatenation; resolve every prefix hop.
- Flask blueprint prefix can be set at `register_blueprint` AND in `Blueprint(...)` — both apply; don't double-count or miss either.
- FastAPI dependencies in `dependencies=[...]` on `APIRouter`/`include_router` apply auth to ALL child routes (easy to miss per-route).
- Same `path/route` string with different `methods` = separate INTERFACES.md rows. Trailing-slash behavior differs (Django `APPEND_SLASH`, DRF `trailing_slash`).

> tip: Resolve every prefix hop (project urls → app urls → router/blueprint → decorator) and EXPAND DRF/SQLModel magic — the implicit, generated routes are exactly what a naive scan misses.
