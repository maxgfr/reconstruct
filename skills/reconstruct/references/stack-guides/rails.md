# Ruby on Rails — Reconstruction Cheat-Sheet

**When:** `inventory.stack` includes ruby/rails; root has `config/routes.rb`, `Gemfile` with `gem "rails"`, `app/controllers/`, `app/models/`, `db/schema.rb`, `bin/rails`, `config/application.rb`.

## Where the interface surface lives
HTTP routes are declared in `config/routes.rb` (plus any `config/routes/*.rb` via `draw`). Run `bin/rails routes -E` (or `--expanded`) to get the canonical truth: method · path · controller#action · name — use this over hand-parsing when the repo runs. Map DSL → INTERFACES.md rows:
- `resources :posts` → 7 routes (index/show/new/create/edit/update/destroy) → `PostsController#<action>`. `resource :session` (singular) drops index. Add/remove with `only:`/`except:`.
- `get "/x", to: "foo#bar"`, `post`, `patch`, `put`, `delete`, `match … via:` → explicit action.
- `namespace :admin` → URL prefix `/admin` AND module `Admin::` → controller at `app/controllers/admin/posts_controller.rb`. `scope module: :admin` adds module without URL prefix; `scope "/admin"` adds URL without module. `scope path:`/`as:` tweak path/name only.
- `member do … end` → `/posts/:id/publish`; `collection do … end` → `/posts/search`. Nested `resources` → `/posts/:post_id/comments`.
- `concern :commentable` + `concerns: [:commentable]` reuse route blocks.
- `root "home#index"` → `GET /`. `mount RackApp => "/path"` and engines (`mount Sidekiq::Web`, GraphQL) mount sub-apps — note them.
- Auth/filters: handler controller + its `before_action :authenticate_user!` (Devise), `:require_login`, etc. Filters live in the controller, inherited from `ApplicationController`, or pulled from `app/controllers/concerns/*.rb` (`include Authenticatable`). Record the effective filter as the auth column; check `skip_before_action` for public actions.
- Format/version: `defaults format: :json`, `constraints`, and `namespace :api do namespace :v1` give paths like `/api/v1/...` with `Api::V1::` controllers.
GraphQL (graphql-ruby): one route `post "/graphql"` → `GraphqlController#execute`; real operations live in `app/graphql/types/*_type.rb` (`field :name, …`), `mutation_type.rb`, `query_type.rb` — enumerate fields there, not routes. gRPC: `*_services_pb.rb` + service impls. ActionCable channels in `app/channels/*_channel.rb` (`subscribed`, `def speak`) are realtime endpoints — list them.

## Data model
Source of truth is `db/schema.rb` (`create_table "posts" do |t| t.string :title; t.references :user, foreign_key: true; t.index [...] end`) — read every column type, `null:`, default, `add_index`, and FK. If schema format is `:sql`, read `db/structure.sql` instead. Entities = `app/models/*.rb` (`< ApplicationRecord`). Relations from macros: `belongs_to`, `has_many`, `has_many :through`, `has_one`, `has_and_belongs_to_many` (join table, no model), polymorphic (`belongs_to :x, polymorphic: true` + `*_type`/`*_id`). Also note `enum status: {...}`, `validates`, `scope`, STI (`type` column + subclasses). `db/migrate/*.rb` shows history/intent; schema is current state. Table name = pluralized model unless `self.table_name=`.

## Entry points & boot
`config/application.rb` (`Rails.application.initialize!` config) + `config/boot.rb` + `config/environment.rb`. Server starts via `bin/rails server` (Puma, `config/puma.rb`); rack entry is `config.ru` (`run Rails.application`). `config/initializers/*.rb` run at boot. Background jobs: `app/jobs/*_job.rb` (`< ApplicationJob`, `perform`), adapter in `config.active_job.queue_adapter` (Sidekiq → `app/workers/`/`config/sidekiq.yml`, `Sidekiq::Web` mount). Scheduled tasks in `config/schedule.rb` (whenever) or `lib/tasks/*.rake` + `Rakefile`.

## Config & env
`Gemfile`/`Gemfile.lock` = deps & exact Rails version. Per-env config in `config/environments/{development,test,production}.rb`. Routable secrets/DB: `config/database.yml`, `config/credentials.yml.enc` + `config/master.key`, `ENV[...]`/`Rails.application.credentials`, `.env` (dotenv). Run scripts: `bin/rails`, `bin/setup`, `bin/dev` (+ `Procfile.dev`). CLI/custom commands: rake tasks and `lib/tasks/*.rake` (`namespace :data do task :backfill`).

## Gotchas
- `bin/rails routes` is authoritative; the routes.rb DSL alone hides defaults, concerns, and engine-mounted routes — always reconcile.
- `namespace` vs `scope module:` vs `scope path:` differ in whether they touch the URL, the controller module, or both — easy to mis-derive the full path.
- Auth is rarely on the action: it's an inherited `before_action` in `ApplicationController` or an included concern; a public action uses `skip_before_action`.
- `has_and_belongs_to_many` and `has_many :through` join tables exist in schema but have no model file — don't miss them as relations.
- Polymorphic and STI associations hide behind `*_type`/`type` columns; index `db/schema.rb` columns, not just association macros.
- Engines (in `Gemfile` or `engines/`/`components/`) ship their own `config/routes.rb`, controllers, and models — mounted routes pull in a whole second surface.
- Implicit routes: `resources` generates new/edit (form pages) even when only the API actions are implemented; verify the controller actually defines the action.

> tip: When the app runs, trust `bin/rails routes` + `db/schema.rb` as ground truth and use models/controllers only to fill auth, relations, and field semantics.
