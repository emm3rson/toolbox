# Changelog

Concise task-level record of completed project work and important handoff context.

## Frontend Brief — 2026-08-15

- Changed: Scaffolded the Tauri 2 frontend and implemented the Figma-based launcher, settings, three tool workflows, shared states, themes, and UI refinements.
- Decision: Tools use a static registry and typed mock Tauri boundary so native commands can replace mocks without changing UI components.
- Verified: The production frontend build and mocked workflows passed; native compilation remains pending a local Rust and Visual Studio toolchain.

## Phase 1 — Tauri Shell Integration — 2026-08-15

- Changed: Replaced the OS-level stubs with real Tauri integrations — native file/folder pickers, real drag-and-drop of files, open-in-Explorer, and settings persisted to disk via `tauri-plugin-store` (live theme switching retained). Added a real `inspect_files` command returning actual filenames and file sizes; image processing remains mocked.
- Decision: Settings use `tauri-plugin-store` with `localStorage` kept only as a boot cache; file metadata comes from a minimal Rust `inspect_files` command with dimensions deferred to Phase 2; a placeholder icon was generated to satisfy the Windows build resource (branded icon deferred to Phase 4).
- Verified: `npm run build` and `cargo check` passed; visual smoke test left to the owner.

<!-- task: 2026-08-15-phase-1-tauri-shell-integration -->
