# Toolbox

Local-first Windows desktop utility app for image asset preparation: convert,
compress, and generate website icon packs. Files never leave your machine.

## Requirements

- Node.js 24+ and npm
- Rust 1.97+ (MSVC toolchain) — `~/.cargo/bin` if not on PATH

## Commands

| Command | Purpose |
|---|---|
| `npm run tauri dev` | Run the desktop app in dev mode (frontend + Rust) |
| `npm run dev` | Frontend-only Vite dev server (no Tauri runtime) |
| `npm run build` | Type-check + production frontend build |
| `npm run test` | Frontend tests (Vitest) |
| `npm run tauri build` | Release build + NSIS installer (`src-tauri/target/release/bundle/nsis/`) |
| `cargo check` / `cargo test` / `cargo check --release` | Rust checks/tests (from `src-tauri/`) |

## Documentation

- `docs/PROJECT.md` — product, capabilities, boundaries, current state,
  decisions, maintenance
- `docs/UI_RULES.md` — visual and interaction rules
- `AGENTS.md` — agent working rules
- `CHANGELOG.md` — outcome history
- `docs/tasks/` — plan + report per completed task
- `docs/archive/2026-08-baseline/` — archived V1 planning docs (not current truth)

## Notes

- Installer: per-user NSIS, product name "Toolbox".
- App icon source: `app-icon.png` (regenerate with `npm run tauri icon app-icon.png`).
