# Phase 1 — Tauri Shell Integration

## Objective

Replace the OS-level frontend stubs with real Tauri integrations so the app
behaves like a native desktop app while image *processing* remains mocked.

User-visible outcomes (from `docs/DEVELOPMENT_PHASES.md`):

- A native file/folder picker opens instead of returning hardcoded paths.
- Real files can be dragged onto the drop zone and appear in the file list
  with their real names and paths.
- Settings (theme + export directory) survive app restarts via disk, not
  `localStorage` alone.
- System theme detection and live switching keep working.
- "Open folder" launches the system file explorer at the export destination.
- Window configuration (title, default/min size) is in place.

Processing (`convertImages`, `compressImages`, `generateLogoPack`) stays mocked.

## Current state

- **Frontend is complete** per the archived `FRONTEND_BRIEF.md` and is the
  source of truth for interaction behavior.
- Typed adapter boundary exists at `src/services/tauri/contracts.ts`
  (`TauriAdapter` interface) with `desktop` exported from
  `src/services/tauri/index.ts` and backed entirely by
  `src/services/tauri/mockAdapter.ts`.
  - OS-level stubs to replace: `pickFiles`, `pickFolder`, `openFolder`.
  - Processing stubs to keep: `convertImages`, `compressImages`,
    `generateLogoPack`.
  - `inspectFiles` currently fabricates `name`/`width`/`height`/`size` from a
    hardcoded `MOCK_FILES` array.
- `src/app/providers/SettingsProvider.tsx` persists a single JSON blob
  (`theme`, `exportPath`) to `localStorage` and does live theme switching via
  `matchMedia('(prefers-color-scheme: dark)')` + toggling `.dark` on
  `<html>`.
- `src/components/workspace.tsx` `DropZone` uses HTML5 `onDragOver`/`onDrop`
  and calls `onAdd()` with no path argument — it never receives real file
  paths. `FileRow` renders `width × height` unconditionally.
- `src/tools/batch-workspace/BatchWorkspace.tsx` and
  `src/tools/web-logo-pack/index.tsx` both call `desktop.pickFiles(...)` /
  `desktop.inspectFiles(...)` and `desktop.openFolder(...)`.
- **Native scaffold is empty**: `src-tauri/src/lib.rs` is a bare builder with
  no plugins or commands. `src-tauri/Cargo.toml` only has `tauri`, `serde`,
  `serde_json`. `src-tauri/capabilities/default.json` only grants
  `core:default`. `src-tauri/tauri.conf.json` already sets title `Toolbox`,
  `1200×800` default, `880×640` min, centered — so window config is mostly
  done and only needs verification.

## Decisions and constraints

1. **Persistence = `tauri-plugin-store`** (confirmed with owner). A single
   `settings.json` store file, one key `settings` holding
   `{ theme, exportPath }`. JS API `load`/`get`/`set`/`save`, Rust
   `tauri_plugin_store::Builder::new().build()`.
2. **Real file metadata via a minimal Rust `inspect_files` command**
   (confirmed with owner). It returns real `name`, `extension`, and `size`
   from `std::fs::metadata`; `width`/`height` are `0` (meaning "unknown")
   until Phase 2 adds real image inspection. No format validation in Phase 1.
   This is the *only* new Rust command in Phase 1.
   - Contract convention: `width === 0 && height === 0` means "unknown";
     the frontend hides the dimension readout in that case.
3. **Dialogs = `@tauri-apps/plugin-dialog`** `open()`. Files:
   `open({ multiple: mode !== 'logo', directory: false, filters: [images] })`.
   Folder: `open({ directory: true })`.
4. **Open folder = `@tauri-apps/plugin-opener`** `openPath(folderPath)` with
   the `opener:allow-open-path` permission scoped to `**`. This is the modern
   replacement for the "shell → Explorer" phrasing in
   `DEVELOPMENT_PHASES.md` (the shell plugin's `open` is deprecated in favor
   of the opener plugin). See Risks for the scope tradeoff.
5. **Drag-and-drop = `getCurrentWebview().onDragDropEvent()`**
   (`@tauri-apps/api/webview`). This replaces the HTML5 drop handlers, which
   do not receive native file paths on Windows. `dragDropEnabled` defaults to
   `true`, so no config change is needed. Handle `enter`/`over` (set
   drag-over visual), `drop` (read `payload.paths`), `leave` (clear).
6. **Theme detection/switching already works** via `matchMedia`. Phase 1 only
   moves the *persistence* of the chosen `theme` value off `localStorage` onto
   the store. Keep `localStorage` as a synchronous boot cache to avoid a
   theme flash on startup; the store is the canonical source of truth and is
   written through on every change.
7. **Square validation of the Logo Pack is deferred to Phase 2/3.** Because
   `inspect_files` returns unknown dimensions in Phase 1, the Logo Pack's
   "source must be square" check and the "try a non-square source" demo cannot
   be driven by real data. Phase 1 removes the demo button and lets any
   picked/dropped source proceed to the asset-selection screen; Phase 3
   restores real validation using real dimensions.
8. **Window icon is deferred to Phase 4.** `tauri.conf.json` window config
   (title/size/min) is already correct; do not add an icon asset here.
9. **Non-destructive / local-first rules hold.** No uploads, no network, no
   in-place source writes (none are performed in Phase 1; processing is mock).
10. **No new Rust commands beyond `inspect_files`.** Dialogs, opener, and
    store are consumed from JS via their plugins to keep the adapter thin and
    avoid duplicating plugin functionality in custom commands.

## Implementation tasks

The work is ordered; Tasks 0 and 1 must precede 2–4. If delegating, assign
non-overlapping files as noted (Task 0 and Task 1 both touch `lib.rs`, so
Task 1 depends on Task 0).

### Task 0: Register plugins, dependencies, and capabilities

- Goal: Add dialog, opener, and store plugins to both sides of the boundary
  and grant the minimum permissions they need.
- Relevant files:
  - `package.json` (add npm deps)
  - `src-tauri/Cargo.toml` (add crate deps)
  - `src-tauri/src/lib.rs` (register plugins)
  - `src-tauri/capabilities/default.json` (permissions)
  - `src-tauri/tauri.conf.json` (verify only)
- Implementation guidance:
  - npm: `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-opener`,
    `@tauri-apps/plugin-store` (v2, matching `@tauri-apps/api` ^2.11.1).
  - Cargo: `tauri-plugin-dialog = "2"`, `tauri-plugin-opener = "2"`,
    `tauri-plugin-store = "2"`.
  - `lib.rs` builder:
    `.plugin(tauri_plugin_dialog::init())`
    `.plugin(tauri_plugin_opener::init())`
    `.plugin(tauri_plugin_store::Builder::new().build())`
  - `capabilities/default.json` permissions (append to the existing
    `core:default`):
    ```json
    [
      "core:default",
      "dialog:default",
      "store:default",
      { "identifier": "opener:allow-open-path", "allow": [{ "path": "**" }] }
    ]
    ```
    (`dialog:default` grants `allow-open`; `store:default` grants the full
    get/set/load/save set; `opener:allow-open-path` is required for
    `openPath`.)
  - Verify `tauri.conf.json` title/size/min/center values are unchanged and
    correct; no edit expected.
- Dependencies: None.
- Acceptance criteria: `npm install` succeeds; `cargo build` in `src-tauri`
  compiles with the three plugins registered; capabilities JSON is valid.

### Task 1: Add the `inspect_files` Rust command

- Goal: Return real file name, extension, and size from the filesystem, with
  unknown dimensions, so the file list can show real metadata.
- Relevant files:
  - `src-tauri/src/models.rs` (new)
  - `src-tauri/src/commands.rs` (new)
  - `src-tauri/src/lib.rs` (register modules + `invoke_handler`)
- Implementation guidance:
  - `models.rs`: serde `Serialize` struct matching the frontend
    `InputFile` contract in `src/services/tauri/contracts.ts`:
    ```rust
    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct InputFile {
        pub path: String,
        pub name: String,
        pub extension: String,
        pub size: u64,
        pub width: u32,
        pub height: u32,
        pub status: String, // "ready" | "invalid"
        #[serde(skip_serializing_if = "Option::is_none")]
        pub error: Option<String>,
    }
    ```
  - `commands.rs`: `#[tauri::command] fn inspect_files(paths: Vec<String>) -> Vec<InputFile>`.
    For each path use `std::fs::metadata` to read `len()` (size) and
    `is_file()`. Derive `name` from `Path::file_name`, `extension` from
    `Path::extension` (lowercased, no dot). Set `width`/`height` to `0`,
    `status` to `"ready"` when the path exists and is a file, otherwise
    `"invalid"` with `error: Some("File not found")`. Use `Path`/`PathBuf`
    (ARCHITECTURE §27); never hardcode `\`.
  - `lib.rs`: add `mod models; mod commands;` and
    `.invoke_handler(tauri::generate_handler![commands::inspect_files])`.
  - Command arg mapping: JS `invoke('inspect_files', { paths })` maps to the
    `paths` parameter directly.
- Dependencies: Task 0 (lib.rs is shared).
- Acceptance criteria: `cargo build` compiles; command returns real
  `name`/`extension`/`size` for a real file path and `status: "invalid"` for
  a nonexistent path.

### Task 2: Implement the real Tauri adapter and swap it in

- Goal: Point `desktop` at a real implementation for OS methods + inspection
  while keeping processing mocked, with no component changes required for the
  swap.
- Relevant files (owned exclusively by this task):
  - `src/services/tauri/realAdapter.ts` (new)
  - `src/services/tauri/mockAdapter.ts` (trim to processing only)
  - `src/services/tauri/index.ts` (re-export `realAdapter`)
- Implementation guidance:
  - `realAdapter.ts` implements `TauriAdapter`:
    - `pickFiles(mode)`: `open({ multiple: mode !== 'logo', directory: false, filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp'] }] })`; normalize `null → []`, single value → `[value]`.
    - `pickFolder()`: `open({ directory: true })`; normalize `null → ''`.
    - `openFolder(path)`: `openPath(path)`.
    - `inspectFiles(paths)`: `invoke<InputFile[]>('inspect_files', { paths })`.
    - `convertImages` / `compressImages` / `generateLogoPack`: delegate to the
      mock implementation (import from `mockAdapter`).
  - Trim `mockAdapter.ts` to export only the three processing functions (or a
    `mockProcessing` object) and remove its `pickFiles`/`pickFolder`/
    `openFolder`/`inspectFiles` and `MOCK_FILES` metadata (dimensions/sizes
    now come from `inspect_files`).
  - `index.ts`: `export const desktop = realAdapter` (keep `export * from './contracts'`).
- Dependencies: Task 0 and Task 1 (plugins + command must exist).
- Acceptance criteria: `npm run build` passes; importing `desktop` gives an
  adapter whose OS methods hit real plugins and whose processing methods still
  return mock `BatchResult`s.

### Task 3: Wire real pickers, drag-and-drop, and open-folder into the UI

- Goal: DropZone receives real dropped paths, pickers return real selections,
  and open-folder launches Explorer — while the file list hides unknown
  dimensions.
- Relevant files (owned exclusively by this task):
  - `src/components/workspace.tsx`
  - `src/tools/batch-workspace/BatchWorkspace.tsx`
  - `src/tools/web-logo-pack/index.tsx`
- Implementation guidance:
  - `DropZone`: change `onAdd` to `(paths?: string[]) => void`. Add a
    `useEffect` that registers
    `getCurrentWebview().onDragDropEvent((event) => {...})`:
    - `'enter'` / `'over'` → `setOver(true)`
    - `'leave'` → `setOver(false)`
    - `'drop'` → `setOver(false); onAdd(event.payload.paths)`
    Remove the HTML5 `onDragOver`/`onDragLeave`/`onDrop` handlers (native
    drag-drop intercepts them). Keep click/keyboard → `onAdd()` (picker path).
    Clean up the listener on unmount.
  - `BatchWorkspace.addFiles(paths?)`: `const selected = paths ?? await desktop.pickFiles('batch'); if (!selected.length) return; setFiles(await desktop.inspectFiles(selected)); setPhase('editing')`.
  - `WebLogoPack.load(paths?)`: accept optional paths; default to
    `desktop.pickFiles('logo')`; remove the `load(true)` "try a non-square
    source" demo and the button that triggers it. Since Phase 1 dimensions are
    unknown, the invalid-square branch becomes unreachable but is kept for
    Phase 3. Hide the "Square · high resolution" badge when
    `source.width === 0`.
  - `FileRow`: render the `width × height` segment only when
    `file.width > 0 && file.height > 0`.
  - Open-folder calls already use `desktop.openFolder(...)`; no change needed
    beyond the adapter swap.
- Dependencies: Task 2.
- Acceptance criteria: `npm run build` passes; dragging a real file over the
  drop zone highlights it and dropping shows the real filename; clicking the
  zone opens the native picker; "Open folder" invokes `openPath` with the
  export path; file rows no longer show `0 × 0`.

### Task 4: Persist settings to disk via the store

- Goal: Theme and export directory persist through `tauri-plugin-store`,
  keeping the existing live theme switching and avoiding a startup flash.
- Relevant files (owned exclusively by this task):
  - `src/services/settings/index.ts` (new)
  - `src/app/providers/SettingsProvider.tsx`
- Implementation guidance:
  - `src/services/settings/index.ts`: wrap the store. Export `loadSettings()`
    (load `settings.json`, read the `settings` key, return a partial
    `{ theme, exportPath }`) and `saveSettings(value)` (set + `save()`).
    Guard against the plugin being unavailable in a plain-browser dev session
    by returning `{}` / no-op.
  - `SettingsProvider`:
    - Keep the synchronous `useState` seed read from `localStorage` (boot
      cache, prevents theme flash).
    - On mount, `loadSettings()`; merge any stored values over the cache.
    - On `settings` change, call `saveSettings(settings)` and update the
      `localStorage` cache (write-through).
    - Keep the existing `matchMedia` system-theme listener and `.dark` class
      toggle unchanged.
  - No change to `Settings.tsx` (it consumes the context).
- Dependencies: Task 0 (store plugin registered).
- Acceptance criteria: `npm run build` passes; changing theme and export
  folder persists across app restarts; light/dark/system still switch live.

## Validation

- Frontend/browser check: `npm run build` (runs `tsc` + `vite build`) must
  pass.
- Native check (reported separately per AGENTS.md):
  - `cargo build` (or `cargo check`) in `src-tauri` must compile.
  - Note: native compilation requires a local Rust + MSVC toolchain; if
    unavailable, defer to the owner and report it explicitly.
- No automated test framework is present yet (Phase 4 adds Rust/frontend
  tests), so verification is build + owner smoke test.

Owner smoke-test checklist (UI changes — not to be claimed as performed by the
implementer without actually running it):

1. Launch the app via `npm run tauri dev`.
2. Convert Images → click the drop zone → native file picker opens → select
   real images → list shows real filenames (no `0 × 0`).
3. Drag a real image from Explorer onto the drop zone → highlight on hover →
   drop → filename appears.
4. Change the export folder in Settings (or via the workspace "Change") →
   restart the app → the folder is remembered.
5. Switch theme to Dark, restart → Dark persists; set to System and toggle OS
   theme → app follows live.
6. Finish a (mock) convert → "Open folder" → Explorer opens at the export
   folder.
7. Web Logo Pack → pick a square image → proceeds to asset selection (no
   square error shown, since dimensions are deferred).

## Risks and open questions

- **Opener permission scope is broad.** `opener:allow-open-path` with `**`
  lets the frontend open any path via the default handler. Acceptable for a
  local single-user utility whose input is user-selected folders, but a
  stricter alternative is a validated Rust `open_folder(path)` command that
  calls `app.opener().open_path(...)` from Rust. Revisit if tighter scoping is
  desired. (Chosen: JS `openPath` + `**` for simplicity.)
- **Logo Pack square validation is temporarily unavailable** in Phase 1
  (dimensions unknown). This is an intentional deferral to Phase 3; ensure the
  invalid-state UI and validation logic are not deleted, only made
  unreachable.
- **`inspect_files` uses `std::fs::metadata` only** — no image decode, so
  `size` is accurate but `width`/`height` are `0` until Phase 2 extends the
  command.
- **Browser-only `npm run dev`** will no longer exercise real OS behavior
  (dialogs/drop/store need the Tauri window). This matches the phase goal; the
  mock processing paths still render in a plain browser only if the adapter
  gracefully no-ops the store/plugin imports.
- **Theme flash on startup** is mitigated by the `localStorage` boot cache; if
  the dual-write feels over-engineered, dropping the cache and gating the
  first render until the store loads is a simpler fallback.
- **Capability identifiers** (`opener:allow-open-path`, `store:default`,
  `dialog:default`) should be verified against the installed plugin versions
  during Task 0; the `**` path glob should be confirmed to match Windows
  drive-letter paths (e.g. `C:\...`).
