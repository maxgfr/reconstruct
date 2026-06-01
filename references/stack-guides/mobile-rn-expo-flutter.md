# Mobile (React Native / Expo Router / Flutter)

**When:** inventory.stack lists `react-native`/`expo`/`flutter`; presence of `app.json`/`app.config.{js,ts}`, `App.{tsx,js}`, `metro.config.js`, an `app/` dir with `_layout.tsx` (Expo Router), or `pubspec.yaml` + `lib/main.dart` (Flutter). The "interface surface" here is **screen navigation + the remote API calls the app makes** — document BOTH.

## Where the interface surface lives
Each navigable screen = one INTERFACES.md row (kind `screen`, path = route, handler = component file). Each remote call = one row (method · URL · caller file · auth header).
- **Expo Router** (`app/` file-based): every file under `app/` is a route. Filename → path: `index.tsx`→`/`, `[id].tsx`→`/:id`, `[...rest].tsx`→catch-all, `(group)/` = layout group (NOT in URL), `+not-found.tsx`, `+native-intent.ts`. `_layout.tsx` wraps a subtree (`Stack`/`Tabs`/`Drawer` from `expo-router`); `<Stack.Screen name="x" options>` registers/configures. Full path = nested dir segments minus `(groups)`. Deep links/scheme in `app.json` → `expo.scheme`, `expo.ios.associatedDomains`.
- **React Navigation** (manual): navigators built with `createNativeStackNavigator()`/`createBottomTabNavigator()`/`createDrawerNavigator()`; screens via `<Stack.Screen name="Detail" component={DetailScreen}/>`. Grep `navigation.navigate('X')`, `navigation.push`. Linking/deep-link map in `linking={{ config: { screens: {...} } }}` passed to `NavigationContainer` — that map IS the URL↔screen table.
- **Flutter**: `MaterialApp(routes: {...}, onGenerateRoute:)` or **GoRouter** `GoRoute(path:'/user/:id', builder:)` in a `GoRouter([...])` config (often `lib/router.dart`). Imperative nav: `Navigator.pushNamed(context,'/x')`, `context.go('/x')`, `context.push`. Path params = `:id`; query via `state.uri.queryParameters`.
- **Remote APIs (all)**: search clients — `fetch(`, `axios`/`api.get|post`, `useQuery`/`useMutation` (React Query), Apollo `gql\`\`` + `useQuery`; Flutter `http`/`dio`/`Dio()` , `graphql_flutter`. Base URL usually in an env/config const — resolve it to write full URLs.

## Data model
Document local stores AND the remote schema the API implies.
- **RN local**: `expo-sqlite` (raw `CREATE TABLE`, or `drizzle-orm`/expo schema in `db/schema.ts`), **WatermelonDB** (`@nozbe/watermelondb` — `appSchema/tableSchema` + `Model` classes with `@field/@relation/@children` decorators, migrations dir), **Realm** (`Realm.Object` schema statics / `schema = {...}`), **Drizzle** (`*.schema.ts`), `@react-native-async-storage` (KV, no schema).
- **Flutter local**: **Drift** (`@DriftDatabase`, `Table` subclasses in `*.dart`, generated `*.g.dart`), **Isar** (`@collection` classes), **Hive** (`@HiveType`/`@HiveField` + adapters), `sqflite` (raw SQL in `onCreate`), Floor (`@Entity`).
- **Remote**: derive entities from GraphQL `schema.graphql`/codegen types, or from TS interfaces / Dart model classes (`fromJson`/`toJson`, `@JsonSerializable`) that mirror API payloads. Each becomes a DATA-MODEL.md entity with fields+types; relations from `@relation`/foreign keys/`@children`.

## Entry points & boot
- **Expo**: `app.json`→`expo.entryPoint` or default `expo-router/entry`; `app/_layout.tsx` is root layout. Plain RN: `index.js` → `AppRegistry.registerComponent` → `App.tsx`. `babel.config.js` may add `expo-router/babel`.
- **Flutter**: `lib/main.dart` `void main() => runApp(MyApp())`; `MyApp.build` returns `MaterialApp`/`MaterialApp.router(routerConfig:)`.

## Config & env
- RN/Expo: `app.json`/`app.config.ts` (dynamic, can read `process.env`), `eas.json` (build profiles + env), `package.json` scripts (`expo start`, `expo run:ios`). Env via `expo-constants` (`Constants.expoConfig.extra`), `EXPO_PUBLIC_*` vars, or `react-native-config` (`Config.X` from `.env`).
- Flutter: `pubspec.yaml` (deps, assets, `flutter:` block), env via `--dart-define`/`String.fromEnvironment` or `flutter_dotenv` (`.env`), flavors in `android/app/build.gradle` + iOS schemes.

## Gotchas
- **Platform files**: `Foo.ios.tsx`/`.android.tsx`/`.web.tsx`/`.native.tsx` resolve per-platform — same screen may have divergent behavior; check all variants. Flutter: `Platform.isIOS` branches.
- `(group)` and `(tabs)` dirs in Expo Router do **not** appear in the URL; `+`-prefixed files are special, not routes.
- Deep-link config (Expo `scheme`, RN `linking.config`, Flutter app links / `AndroidManifest.xml` intent-filters + `apple-app-site-association`) defines external entry routes the file tree alone won't show.
- Base API URL is often injected at build time (`EXPO_PUBLIC_API_URL`, `--dart-define`) — endpoints look relative; resolve the env var or you'll log wrong/empty URLs.
- Native modules (`ios/`, `android/`, `*.podspec`, Turbo/Expo modules) and `react-native.config.js` add surface the JS-only scan misses.
- React Navigation screen "names" are arbitrary strings, not paths — the URL only exists if a `linking` map maps them; otherwise record the name as the route id.

> tip: Produce two interface tables — a **navigation map** (every screen + its route/param/deep-link) and a **remote-call map** (every endpoint the app hits with resolved base URL) — and split persistence into local stores vs. the remote schema the models imply.
