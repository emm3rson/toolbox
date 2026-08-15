# Changelog

Concise task-level record of completed project work and important handoff context.

## Phase 3 — Image Compressor + Web Logo Pack — 2026-08-15

- Changed: Both remaining tools now run on real Rust processing and no mock adapters remain. Compress Images re-encodes each file in its own format at the chosen quality (PNG stays lossless, with a UI note), names outputs `photo-compressed.jpg`, and shows actual before/after sizes with a neutral "No size reduction" state instead of a negative percentage. Web Logo Pack generates the Standard Web Pack from a square ≥ 512 px source — multi-res `favicon.ico` (16/32/48) plus PNG icons — into a fresh `web-pack`/`web-pack-2` folder per run (prior packs are never overwritten), with the preset list owned centrally in Rust (`get_logo_presets`), asset checkboxes driven by it, specific validation messages (unsupported / non-square / too-small), per-asset failure reporting, and an inline error banner on command failure. The generated folder path is returned to the UI for "Saved to" and "Open folder".
- Decision: Logo Pack returns a `GenerateLogoPackResult { packDirectory, batch }` so the shared completion flow is reused while the actual output folder is Rust-resolved (integration snippet stays a frontend constant); the shared image primitives were extracted into `decode.rs`/`encode.rs` and the Logo Pack processor stays runtime-agnostic via a progress callback so it is unit-testable without a Tauri app.
- Verified: `cargo check`/`build`/`test` (25 tests incl. compress naming/quality, full-pack ICO header, fresh-folder numbering, square validation) and `npm run build` passed; visual smoke test left to the owner.

## Phase 2 — Image Processing Core + Image Converter — 2026-08-15

- Changed: Replaced the mocked `convertImages` with a real Rust pipeline — real image inspection (format, dimensions, file size) in `inspect_files` with shallow folder-drop expansion and invalid-file flagging, lossy PNG/JPG/WebP conversion with optional resize, bounded-concurrency batch processing with per-file failure isolation and live progress events, auto-renaming non-destructive export, and structured error responses surfaced inline in the workspace. Resize aspect-ratio lock now updates the companion dimension against the source image's ratio (replacing the emoji toggle with library icons), and removing the last file returns to the drop zone instead of an empty list.
- Decision: `image` 0.25 + `image-webp` 0.2 (pure-Rust WebP decode) for the core, with `libwebp-sys2` 0.2 (C FFI) for lossy WebP output only; `convert_images` returns `Result<BatchResult, ProcessingErrorDto>` and the adapter injects a `jobId` to correlate progress events without changing component signatures.
- Verified: `cargo build`, `cargo test` (14 unit/integration tests incl. PNG→JPG→WebP round trips, collision renaming, resize math), and `npm run build` passed; visual smoke test left to the owner.

## Frontend Brief — 2026-08-15

- Changed: Scaffolded the Tauri 2 frontend and implemented the Figma-based launcher, settings, three tool workflows, shared states, themes, and UI refinements.
- Decision: Tools use a static registry and typed mock Tauri boundary so native commands can replace mocks without changing UI components.
- Verified: The production frontend build and mocked workflows passed; native compilation remains pending a local Rust and Visual Studio toolchain.

## Phase 1 — Tauri Shell Integration — 2026-08-15

- Changed: Replaced the OS-level stubs with real Tauri integrations — native file/folder pickers, real drag-and-drop of files, open-in-Explorer, and settings persisted to disk via `tauri-plugin-store` (live theme switching retained). Added a real `inspect_files` command returning actual filenames and file sizes; image processing remains mocked.
- Decision: Settings use `tauri-plugin-store` with `localStorage` kept only as a boot cache; file metadata comes from a minimal Rust `inspect_files` command with dimensions deferred to Phase 2; a placeholder icon was generated to satisfy the Windows build resource (branded icon deferred to Phase 4).
- Verified: `npm run build` and `cargo check` passed; visual smoke test left to the owner.

<!-- task: 2026-08-15-phase-1-tauri-shell-integration -->

<!-- task: 2026-08-15-phase-2-image-core-converter -->

<!-- task: 2026-08-15-phase-3-compressor-logo-pack -->
