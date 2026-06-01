# Go HTTP (net/http, chi, gin, echo, gorilla/mux)

**When:** inventory.stack lists Go (`go.mod` present); imports include `net/http`, `github.com/go-chi/chi`, `github.com/gin-gonic/gin`, `github.com/labstack/echo`, or `github.com/gorilla/mux`. Handlers are `func(w http.ResponseWriter, r *http.Request)` or framework `gin.HandlerFunc`/`echo.HandlerFunc`.

## Where the interface surface lives
Routes are registered imperatively in Go — grep, don't expect a manifest. Each registration call is one INTERFACES.md row.
- **net/http**: `http.HandleFunc("/path", h)`, `mux := http.NewServeMux(); mux.HandleFunc(...)`, `mux.Handle("/x", handler)`. **Go 1.22+** method+path patterns: `mux.HandleFunc("GET /users/{id}", h)` — method and `{wildcard}`/`{path...}` are in the string; read method from there. Pre-1.22 ServeMux has no method/params — method is checked inside the handler (`if r.Method != "POST"`), params parsed from `r.URL.Path`.
- **chi**: `r := chi.NewRouter()`, `r.Get/Post/Put/Patch/Delete/Method("PATH", h)`. Path params `{id}`, read via `chi.URLParam(r, "id")`. Prefixes from `r.Route("/api", func(r chi.Router){...})` and `r.Mount("/v1", subrouter)` — **concatenate the nesting chain** for the full path. `r.With(mw).Get(...)` and `r.Group(...)` attach middleware (auth).
- **gin**: `r := gin.Default()`, `r.GET/POST/...("PATH", h)`. Groups: `v1 := r.Group("/api/v1"); v1.GET(...)` — full path = group prefix(es) + leaf. Params `:id` and `*wildcard`. Middleware on `r.Use(...)` or `group.Use(...)`.
- **echo**: `e := echo.New()`, `e.GET/POST/...("PATH", h)`. Groups `g := e.Group("/admin")`. Params `:id`, read `c.Param("id")`.
- **gorilla/mux**: `r := mux.NewRouter()`, `r.HandleFunc("/x", h).Methods("GET","POST")` — **method is a chained `.Methods()`/`.Queries()`/`.Host()` call, not the registration**. Subrouters: `s := r.PathPrefix("/api").Subrouter()`. Params `{id}` / `{id:[0-9]+}`, read `mux.Vars(r)`.
- **Auth**: infer from middleware wrapping a route/group (`r.Use(AuthMiddleware)`, `r.With(jwtauth.Verifier)`, gin `authRequired`). Note per-group vs global.
- Handler bodies live in `handlers/`, `api/`, `internal/handler/`, `internal/transport/http/`, or `controllers/`. Map each route's handler func to its file for the handler-file column.

## Data model
- **GORM**: structs in `models/`, `internal/models/`, `internal/domain/` with `gorm:"..."` tags. Fields = struct fields; type from Go type; tags give `primaryKey`, `index`, `uniqueIndex`, `not null`, `default`, `column:`. Embedded `gorm.Model` adds ID/CreatedAt/UpdatedAt/DeletedAt. Relations: `belongs to` (FK field `UserID` + `User User`), `has many` (`[]Order`), `many2many:join_table` tag. Table created by `db.AutoMigrate(&User{}, ...)` — that call lists the entities.
- **sqlc**: source of truth is `*.sql` — schema in `schema.sql`/`migrations/`, queries in `query.sql` (annotated `-- name: GetUser :one`). Generated Go in `db/`/`internal/db/` (`models.go` = structs/tables, `*.sql.go` = query methods). Read tables from the schema SQL, not the generated code. Config in `sqlc.yaml`.
- **ent**: schema in `ent/schema/*.go` — each type has `Fields()` (`field.String("name")`, `field.Int(...)`) and `Edges()` (`edge.To/From` = relations), `Indexes()`. Generated code in `ent/` (ignore for the model).
- **database/sql**: no ORM — entities are raw `CREATE TABLE` in `.sql` migration files (`migrations/`, golang-migrate `NNN_name.up.sql`, goose, atlas) plus hand-written structs. Read the SQL.

## Entry points & boot
`main()` in `cmd/<app>/main.go` (common for multi-binary) or root `main.go`. Boot wires router + starts server: `http.ListenAndServe(addr, mux)`, `http.Server{...}.ListenAndServe()`, `r.Run(":8080")` (gin), `e.Start(...)` (echo). Route registration is often factored into `routes.go`/`router.go`/`func registerRoutes(r)` or `internal/server/`. Background jobs: goroutines, `robfig/cron`, `time.Ticker`, asynq/machinery workers (often a separate `cmd/worker`).

## Config & env
Env via `os.Getenv` / `os.LookupEnv`, flags via `flag.String(...)`, or **viper** (`viper.AutomaticEnv()`, `viper.SetConfigName`, reads `config.yaml`/`.env`). Config structs often in `config/config.go` via `envconfig`/`caarlos0/env` tags. Build/run: `go build ./cmd/...`, `go run .`, `Makefile`, `Dockerfile`, `docker-compose.yml`. DB URL in `DATABASE_URL`/`DB_DSN`.

## Gotchas
- net/http method+path patterns are a **1.22 feature** — pre-1.22 code has no method in the registration; the method gate is an `if r.Method` branch inside the handler. Check `go` directive in go.mod.
- gorilla/mux `.Methods()` is chained after `HandleFunc` — a route can serve multiple methods in one line; emit a row per method.
- Full path requires walking `Route`/`Group`/`Mount`/`PathPrefix().Subrouter()` nesting — a leaf `"/{id}"` may actually be `/api/v1/users/{id}`.
- Handlers registered via a slice/loop or a `[]Route{...}` table (common pattern) won't show as literal `r.Get(...)` calls — scan for route-table structs.
- GORM table names are pluralized + snake_cased by default (`User` → `users`); a `TableName()` method overrides it.
- sqlc/ent/golang-migrate generated dirs (`ent/`, `db/`, `*_gen.go`) duplicate the schema — read the `.sql`/`schema.go` source, never the generated structs, to avoid double-counting.
- Auth lives in middleware, not the handler signature; trace `Use`/`With`/group wrapping to fill the auth column.

> tip: Routes and the data model are both registered in imperative Go, not declared — exhaustively grep every `HandleFunc`/`.Get/.POST`/`.Methods()` call and every `AutoMigrate`/`schema.sql`/`ent/schema`, then resolve full paths by walking the group/subrouter nesting chain.
