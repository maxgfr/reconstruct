# Desktop apps — Electron & Tauri

**When:** `inventory.stack.frameworks` lists `Electron` or `Tauri`. Look for
`electron-builder.yml` / `forge.config.js` / a `main`+`preload` pair (Electron), or
`src-tauri/tauri.conf.json` + `src-tauri/src/main.rs` (Tauri).

A desktop app has **two processes** with a hard security boundary between them. The interface
surface is **not** routes — it is the **IPC contract** across that boundary, plus the OS-level
integrations. Get the boundary wrong and the rebuild is either broken or insecure.

## Where the interface surface lives

### The IPC contract (the main table)

One `INTERFACES.md` row per channel/command: **direction · name · payload type · return type ·
privilege · handler file**.

- **Electron**
  - Renderer → main, awaited: `ipcRenderer.invoke('channel', args)` ↔
    `ipcMain.handle('channel', handler)`. This is the modern shape — treat each channel like an
    RPC procedure with an input and output contract.
  - Renderer → main, fire-and-forget: `ipcRenderer.send` ↔ `ipcMain.on`.
  - Main → renderer: `webContents.send('channel', payload)` ↔ `ipcRenderer.on`. Enumerate these
    too — they are push events, easy to miss.
  - **The `preload` script is the real API surface.** `contextBridge.exposeInMainWorld('api',
    {...})` defines exactly what the renderer can call. That exposed object *is* the public
    interface; enumerate every method with its signature. Anything not exposed there is
    unreachable from the UI.
- **Tauri**
  - `#[tauri::command]` functions in `src-tauri/src/`, registered in
    `.invoke_handler(tauri::generate_handler![...])`, called as `invoke('cmd_name', { args })`.
    Each is an operation: argument types, return type (`Result<T, E>` — the error type is part
    of the contract), and whether it is `async`.
  - Events: `app.emit` / `window.emit` ↔ `listen('event', cb)` on the JS side.
  - **The allowlist / capabilities file is the permission model.** Tauri v1:
    `tauri.conf.json` `allowlist`. Tauri v2: `capabilities/*.json` granting permissions per
    window. Whatever is not granted does not exist at runtime — capture it exactly.

### The window & navigation surface

- Window definitions: size, min/max, `resizable`, `frame`/`titleBarStyle`, `alwaysOnTop`,
  multi-window setups. In Tauri these are in `tauri.conf.json` `windows[]`; in Electron they are
  `new BrowserWindow({...})` calls.
- The **in-app router** (React Router, Vue Router…) still exists inside the renderer. Those are
  UI routes, not IPC — list them separately and say which is which, or the rebuild confuses a
  client route with an operation.

### OS integrations (each one is an operation)

Menus and accelerators (`Menu.buildFromTemplate`, Tauri `menu`), tray icon + its menu, global
shortcuts, file dialogs, notifications, clipboard, deep links / custom protocol handlers
(`app.setAsDefaultProtocolClient`, `tauri://`), drag-and-drop, and **auto-update** (the feed URL,
the signature key, the check cadence — `electron-updater`, `tauri-plugin-updater`).

## Data model

Desktop apps persist locally. `DATA-MODEL.md` covers:

- **Settings/preferences store** — `electron-store`, `conf`, or a JSON file in `app.getPath
  ('userData')` / Tauri's `$APPCONFIG`. Every key, type, default, and the **migration** behaviour
  between schema versions.
- **Embedded database** — SQLite (`better-sqlite3`, `tauri-plugin-sql`, `rusqlite`), LevelDB, or
  a file format the app owns. Full schema: tables, columns, types, constraints, indexes,
  migrations.
- **The on-disk layout** — which directories the app creates, under which OS-specific base paths
  (`userData`, `logs`, `cache`, `temp`). Differences per platform matter.
- Enums/status sets used in persisted records, with complete member lists.

## Entry points & boot

- **Electron**: `main` in `package.json` → the main-process entry. Trace `app.whenReady()` →
  `createWindow()` → `loadURL`/`loadFile`. Note the `webPreferences`:
  `contextIsolation` (must be `true`), `nodeIntegration` (should be `false`), `sandbox`,
  `preload` path. These four flags define the security posture — record them explicitly.
- **Tauri**: `src-tauri/src/main.rs` → `tauri::Builder::default()` with `.setup()`, plugins,
  `.invoke_handler(...)`, `.run(tauri::generate_context!())`. The frontend is a separate app
  (`build.beforeDevCommand` / `frontendDist` in `tauri.conf.json`) — analyze it with **its own**
  stack guide.
- Single-instance locking, deep-link handling on cold start, and what happens on
  `window-all-closed` (macOS keeps the app alive; Windows/Linux quit) — platform-conditional
  behaviour a rebuild must reproduce.
- Packaging: `electron-builder`/`forge` config or `tauri.conf.json` `bundle` — targets per OS,
  code signing, notarization, installer type. Record targets and the signing requirement.

## Config & env

- Build-time config in `tauri.conf.json` / `electron-builder.yml`; runtime config in the settings
  store. Keep the two apart in the PRD — they have different change costs.
- App identity: `productName`, bundle identifier, version. The identifier drives the userData
  path, so changing it orphans user data.
- Env vars are less common than in servers; anything read from `process.env` in the **main**
  process is server-side-ish, anything in the renderer is public.

## Gotchas

- **The process boundary is a security boundary.** `contextIsolation: false` or
  `nodeIntegration: true` gives the renderer full Node access — if the original had it, that is a
  faithfulness fact to record (and flag), not something to silently "fix". Mark any correction as
  `[behavior-change]`.
- **Never document an IPC channel without its privilege.** "Renderer can call `readFile`" is an
  incomplete contract; which paths, validated how?
- **Tauri's allowlist/capabilities are load-bearing.** A rebuild that omits them has a
  non-functional app; one that grants `all: true` has an insecure one.
- **`hints.routeCandidates` will mislead you.** The renderer's client-side router looks like
  routes to the heuristics. Neither those nor `INTERFACES.md` rows should be HTTP routes unless
  the app really does run a local server.
- **Two dependency sets.** Electron has `dependencies` (bundled) vs `devDependencies` (not) — a
  runtime import in devDependencies breaks the packaged build. Tauri has `package.json` *and*
  `src-tauri/Cargo.toml`; `inventory.dependencies` may only surface one.
- **Native modules** must match the Electron ABI (`electron-rebuild`) — that is a build
  requirement for `REBUILD.md`.
- **Auto-update is a distribution contract**: feed URL, signing keys, rollback story. Without it
  documented, a rebuilt app cannot ship to existing users.
- The renderer is a normal web UI: `DESIGN-SYSTEM.md` applies in full, plus native-feel concerns
  (platform title bars, OS light/dark following, `prefers-reduced-motion`).

> tip: the interface surface is the **preload `contextBridge` object** (Electron) or the
> **`#[tauri::command]` set plus the capabilities file** (Tauri) — enumerate every channel with
> its direction, payload, return type *and* privilege. The renderer's own router is UI
> navigation, not an operation; keep the two tables apart.
