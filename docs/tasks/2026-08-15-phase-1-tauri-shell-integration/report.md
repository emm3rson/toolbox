# Implementation Report

## Status

SUCCESS — all acceptance criteria and required validation passed (frontend
`npm run build` and native `cargo check`).

## Summary

Phase 1 Tauri shell integration is implemented end to end. The dialog, opener,
and store plugins are registered in the native shell with the minimum
capabilities; a real `inspect_files` Rust command returns real file name,
extension, and size; the typed adapter now uses real pickers, open-folder, and
inspection while image processing stays mocked; drag-and-drop reads real file
paths via `onDragDropEvent`; and settings (theme + export directory) persist to
disk through `tauri-plugin-store` with `localStorage` kept only as a
synchronous boot cache.

## Completed work

- Registered `tauri-plugin-dialog`, `tauri-plugin-opener`, `tauri-plugin-store`
  in `lib.rs`, `Cargo.toml`, `package.json`, and
  `capabilities/default.json` (`dialog:default`, `store:default`,
  `opener:allow-open-path` scoped `**`).
- Added `inspect_files` command (new `commands.rs`, `models.rs`): real
  `name`/`extension`/`size` via `std::fs::metadata`, `width`/`height` = 0
  (unknown), `status` "ready"/"invalid".
- Implemented `realAdapter` (`pickFiles`/`pickFolder`/`openFolder` via
  plugins, `inspectFiles` via `invoke`); trimmed `mockAdapter` to processing
  only; `desktop` export now points at the real adapter.
- Wired DropZone to `getCurrentWebview().onDragDropEvent` (enter/over/leave/
  drop with real paths), kept click/keyboard picker path; guarded for
  plain-browser dev.
- File rows hide the dimension readout when unknown (`width`/`height` = 0);
  Logo Pack preview and "Square" badge do the same; non-square demo removed
  (invalid-state UI kept for Phase 3).
- Export/Generate prompt for a destination folder when none is set
  (USER_FLOWS §7 behavior); `chooseExportPath` returns the picked path and
  ignores cancels.
- Settings persist through a new `src/services/settings` store wrapper;
  `SettingsProvider` seeds from the localStorage boot cache, hydrates from the
  store on mount, and write-throughs both on change. Live theme switching via
  `matchMedia` unchanged.

## Files changed

- `src-tauri/Cargo.toml` — added the three plugin crates
- `src-tauri/src/lib.rs` — plugin registration, modules, `inspect_files` handler
- `src-tauri/src/commands.rs` (new) — `inspect_files` command
- `src-tauri/src/models.rs` (new) — `InputFile` DTO matching the frontend contract
- `src-tauri/capabilities/default.json` — dialog/store/opener permissions
- `package.json` / `package-lock.json` — `@tauri-apps/plugin-{dialog,opener,store}`
- `src/services/tauri/realAdapter.ts` (new) — real OS/inspect adapter
- `src/services/tauri/mockAdapter.ts` — trimmed to `mockProcessing` (convert/compress/generate)
- `src/services/tauri/index.ts` — `desktop = realAdapter`
- `src/services/tauri/contracts.ts` — `pickFolder` returns `string | null`
- `src/services/settings/index.ts` (new) — store-backed load/save with browser guard
- `src/app/providers/SettingsProvider.tsx` — store hydration + write-through, empty default export path
- `src/components/workspace.tsx` — real drag-drop listener, hidden unknown dimensions, click-event leak fix
- `src/tools/batch-workspace/BatchWorkspace.tsx` — drop paths, destination prompt
- `src/tools/web-logo-pack/index.tsx` — drop paths, destination prompt, demo removal, hidden dimensions

## Validation

- `npm run build` (tsc + vite build) — PASSED (run after each incremental fix)
- `cargo check` in `src-tauri` — PASSED after installing Rust + MSVC Build
  Tools, generating a placeholder icon, and making `inspect_files` `pub`.
- Owner smoke-test checklist (7 steps via `npm run tauri dev`) — PASSED by the
  owner, with minor notes outstanding (see below).

## Delegation

None — implementation performed directly (cohesive, small scope; native
toolchain unavailable for any delegated verification anyway).

## Deviations and decisions

- `pickFolder` contract changed to `Promise<string | null>` instead of
  normalizing cancel to `''` (plan §Task 2 guidance), so a cancelled folder
  dialog never persists an empty export path.
- Removed the leftover mock default `exportPath`
  (`C:\Users\avery\Pictures\Exports`); the default is now empty and
  Export/Generate prompt for a destination the first time (USER_FLOWS §7).
- DropZone's `onDragDropEvent` registration is wrapped in try/catch so a
  plain-browser `npm run dev` session does not crash on mount (plan risk note).
- "Add more" in `FileListHeader` now invokes `onAddMore()` without the click
  event, preventing a `MouseEvent` from being passed as the dropped-paths
  argument.
- Placeholder app icons were generated (`src-tauri/icons/`, via
  `npm run tauri icon` from a generated 1024×1024 "T" mark) because the Windows
  tauri-build step requires `icons/icon.ico` for the executable resource.
  This slightly predates the plan's "window icon deferred to Phase 4"; the
  branded icon is still Phase 4 work.
- `inspect_files` is declared `pub` — Tauri's `generate_handler!` macro
  requires the command symbol to be visible.

## Follow-up changes

- 2026-08-15 — fixed `onClick`/`onKeyDown` type error for the new
  `onAdd(paths?)` signature; wrapped drag-drop registration in try/catch;
  fixed the "Add more" click-event leak found during diff review.
- 2026-08-15 — after the owner installed Rust + MSVC Build Tools: generated a
  placeholder icon set to unblock `cargo check` (`icons/icon.ico` required for
  the Windows resource), made `inspect_files` `pub` to fix the
  `generate_handler!` visibility error, and confirmed `cargo check` passes.
- 2026-08-15 — fixed the `npm run tauri dev` failure (`EBUSY: resource busy or
  locked` from Vite watching `src-tauri/target` while cargo compiled) by adding
  `server.watch.ignored: ['**/src-tauri/**']` to `vite.config.ts`; `npm run
  build` re-verified after the change.

## Blockers or questions for the next Sol session

- None architectural. Remaining owner action is the visual smoke-test checklist
  in the plan (requires `npm run tauri dev`). Cosmetic note for a future pass:
  the Settings page shows an empty export path row when none is set; a "Not set
  yet" placeholder would be a small polish item (left out to keep
  `Settings.tsx` untouched per the plan).
