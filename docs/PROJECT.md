# Toolbox — Project

## 1. Product

Local-first Windows desktop app for image-asset prep: convert, compress, and
generate website icon packs. Flow: choose tool → add files → adjust settings →
export.

## 2. Current capabilities

- **Converter:** PNG/JPG/WebP ⇄ PNG/JPG/WebP; optional resize (exact or
  percentage, aspect-preserving, no cropping); lossy quality. Outputs
  `photo.webp`, auto-renamed on collision.
- **Compressor:** same-format re-encode at a quality slider (PNG lossless;
  quality applies to JPG/WebP); outputs `photo-compressed.jpg`; summary shows
  before/after sizes.
- **Logo Pack:** square source ≥ 512 px; Standard Web Pack = multi-res
  `favicon.ico` (16/32/48) + `favicon-16x16.png`, `favicon-32x32.png`,
  `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`; fresh numbered
  `web-pack` folder per run; asset checkboxes; copyable snippet.
- **Shared:** drag-drop/picker/shallow-folder intake; bounded-concurrency batch
  with per-file failure isolation; progress events; auto-rename export to one
  remembered destination; 10 stable error codes (`errors.rs`); theme +
  persisted settings.
- **Guard:** decode rejects > 16 384 px/side or 64 MP (`tools/image/decode.rs`).

## 3. Non-goals

No accounts, cloud, backend, database, auto-updates, telemetry, history. No
target-size compression, size estimates, cropping/editor, recursive folders,
filename prefixes, extra formats (AVIF/GIF/SVG/HEIC), ZIP logo output, custom
layouts, plugin SDK, website edits. No macOS/Linux release in V1.

## 4. Boundaries

- Stack: Tauri 2 + React 19/TS/Vite; frontend owns interaction state;
  processing via typed service boundary (`src/services/tauri/`).
- Commands (5): `inspect_files`, `convert_images`, `compress_images`,
  `generate_logo_pack`, `get_logo_presets`; DTOs in `contracts.ts` + `models.rs`.
- Tools: static registry via `ToolDefinition` (`src/tools/registry.ts`).
- Crates: `image` 0.25, `image-webp` 0.2 (WebP decode), `libwebp-sys2` 0.2
  (lossy WebP encode only), `rayon` (batch pool), `thiserror`; plugins
  dialog/opener/store.
- Persistence: key-value `settings.json` via plugin-store; no DB.

## 5. Data, privacy, security

Files stay on-device; no network. Outputs never overwrite sources (export
treats source as collision and auto-renames). Frontend input revalidated in
Rust. Minimal capabilities (`capabilities/default.json`): core/dialog/store
defaults + scoped opener.

## 6. Current state

V1 shipped (all phases complete, smoke-tested). Installer: `npm run tauri build`
→ `target/release/bundle/nsis/Toolbox_0.1.0_x64-setup.exe` (per-user NSIS,
GUI-subsystem exe). Tests: 41 Rust (+1 ignored perf) + 8 frontend.

## 7. Active decisions

- Static registry; conflicts always auto-rename; one app-wide export directory.
- Logo Pack: fresh numbered folder per run; presets owned in Rust.
- PNG compression lossless (quality no-op; UI notes it).
- Persisted prefs: converter `lastFormat`/`quality`, compressor `quality`, logo
  `selectedAssets` (not resize).
- Batch concurrency min(cores, 4); decode limits are tunable constants.
- NSIS per-user; product "Toolbox"; id `com.emmersonmena.toolbox`.

## 8. Sources of truth

Code is authoritative: `src-tauri/src/`, `contracts.ts`, `tauri.conf.json`.
UI behavior: `UI_RULES.md`. History: `CHANGELOG.md` + `docs/tasks/`. Archived:
`docs/archive/2026-08-baseline/` (frozen, not current).

## 9. Maintenance

- Add a tool: module in `src/tools/<name>/` exporting `ToolDefinition`;
  register in `registry.ts`; add Rust command/processor; reuse shared
  intake/export/batch/errors.
- Checks: `npm run build`, `npm run test`, `cargo check`/`test`/`check --release`
  (in `src-tauri`), `npm run tauri build`. Rust 1.97+ MSVC (`~/.cargo/bin`).
- Releases & versioning: follow `docs/RELEASE_RUNBOOK.md`.
- Docs: update PROJECT/UI_RULES on durable changes; task-grouped CHANGELOG
  entries; never treat archive as current truth.
