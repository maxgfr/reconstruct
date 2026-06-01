# Spring Boot (Java / Kotlin)

**When:** inventory.stack includes `spring-boot`/`spring`; a `pom.xml` or `build.gradle(.kts)` with `spring-boot-starter-*` deps, a class annotated `@SpringBootApplication`, and `src/main/resources/application.yml|.properties`.

## Where the interface surface lives
HTTP controllers live under `src/main/java|kotlin/.../**/*Controller.{java,kt}`, annotated `@RestController` (JSON) or `@Controller` (often `@ResponseBody` / view names).
- **Class base path:** `@RequestMapping("/api/x")` on the class. **Method path:** `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`, or `@RequestMapping(method=...)`. Full path = class base + method value (e.g. `@RequestMapping("/users")` + `@GetMapping("/{id}")` → `GET /users/{id}`). Dynamic segments are `{id}` bound via `@PathVariable`; query via `@RequestParam`; body via `@RequestBody`.
- **Global prefix:** check `server.servlet.context-path` and `spring.mvc.servlet.path` / `spring.webflux.base-path` in application.yml — prepend to every route. `@RequestMapping` `produces`/`consumes` narrow content type.
- **Handler file** = the controller method (`Class#method`). **Auth** = method/class `@PreAuthorize`/`@Secured`/`@RolesAllowed`, plus SecurityFilterChain rules (see below) — the two compose.
- **WebFlux functional routes:** `RouterFunction<ServerResponse>` beans using `route().GET(...).POST(...)` — grep `RouterFunctions.route` / `RouterFunction`.
- **GraphQL:** `@Controller` + `@QueryMapping`/`@MutationMapping`/`@SchemaMapping`/`@SubscriptionMapping`; schema in `src/main/resources/graphql/*.graphqls`.
- **gRPC:** `@GrpcService` (grpc-spring-boot-starter), service impls extend generated `*Grpc.*ImplBase`; protos under `src/main/proto/`.
- **Messaging/jobs:** `@KafkaListener`, `@RabbitListener`, `@JmsListener`, `@EventListener`, `@SqsListener`; scheduled jobs `@Scheduled(cron=...)` / `@Scheduled(fixedRate=...)`. **CLI:** `CommandLineRunner`/`ApplicationRunner` beans, or Spring Shell `@ShellComponent`+`@ShellMethod`.

## Data model
JPA (Hibernate) is default. Entities: `@Entity` classes (often under `model`/`domain`/`entity`), `@Table(name=...)`, `@Id` (+`@GeneratedValue`), `@Column`, `@Enumerated`. Relations: `@OneToMany(mappedBy=...)`, `@ManyToOne`, `@OneToOne`, `@ManyToMany`, `@JoinColumn`/`@JoinTable`; indexes via `@Table(indexes=@Index(...))` / `@Column(unique=true)`. Repositories = interfaces extending `JpaRepository<T,ID>` / `CrudRepository` / `PagingAndSortingRepository` (or `R2dbcRepository`, `MongoRepository`, `CassandraRepository`). Derived-query method names and `@Query` reveal access patterns. **MyBatis** alt: `@Mapper` interfaces + `src/main/resources/**/*Mapper.xml` (`<select>/<insert>/<resultMap>`). **Migrations:** Flyway `src/main/resources/db/migration/V*__*.sql` or Liquibase `db/changelog/*` — read these for the authoritative DDL (columns, FKs, indexes) when annotations are thin.

## Entry points & boot
Main class with `@SpringBootApplication` (= `@Configuration`+`@EnableAutoConfiguration`+`@ComponentScan`) and `public static void main` → `SpringApplication.run(App.class, args)`. `@Configuration` classes define `@Bean`s; `@ComponentScan` base package limits where `@Component/@Service/@Repository/@Controller` are discovered. Embedded server (Tomcat default; Netty for WebFlux) starts automatically.

## Config & env
`src/main/resources/application.{yml,properties}` + profile files `application-{profile}.yml`; active via `SPRING_PROFILES_ACTIVE` / `--spring.profiles.active`. Any key is overridable by env var (relaxed binding: `server.port` → `SERVER_PORT`); `@Value("${...}")` and `@ConfigurationProperties(prefix=...)` bind config to beans. Build/run: Maven `./mvnw spring-boot:run` / `package`; Gradle `./gradlew bootRun` / `bootJar`. DB creds, datasource URL, `spring.jpa.hibernate.ddl-auto` in config.

## Gotchas
- Routes can be split across `@RequestMapping` on class AND method — neither alone is the path; also account for `context-path`/`servlet.path`/`base-path` prefixes the analyzer often drops.
- Auth lives in `SecurityFilterChain`/`WebSecurityConfigurerAdapter` (`.authorizeHttpRequests(...).requestMatchers("/admin/**").hasRole(...)`) — separate from controllers; merge both for the auth column.
- `@RestController` vs `@Controller`: latter returns view names unless `@ResponseBody` — not all are JSON endpoints.
- `ddl-auto: create/update` means no migration files exist; schema is inferred from `@Entity` only.
- Constructor/field injection means handlers may not call repos directly — trace through `@Service` beans.
- Kotlin: same annotations; data classes for entities/DTOs; method-reference router DSL in WebFlux. Meta-annotations (`@GetMapping` is itself `@RequestMapping`) and custom composed annotations can hide mappings — resolve them.

> tip: Reconstruct the full path by composing class `@RequestMapping` + method mapping + global `context-path`, and the auth column by composing method `@PreAuthorize` with the `SecurityFilterChain` matcher rules — both are split across files.
