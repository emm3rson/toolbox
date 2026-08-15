# Implementation Report

## Status

SUCCESS — all acceptance criteria and required validation passed: `cargo check`,
`cargo test` (41 passed, 1 ignored large-batch test also verified separately),
`cargo check --release`, `npm run test` (8 frontend tests), `npm run build`,
and `npm run tauri build` (NSIS installer produced; release binary launches and
stays alive). Installer installation and the visual smoke test remain with the
owner.

## Summary

Phase 4 is implemented end to end, producing a release-ready Windows build.

**Rust hardening:** `decode` now rejects PNG/JPEG sources beyond 16 384 px per
side or 64 MP (`MAX_DIMENSION`/`MAX_PIXELS` constants) with `INVALID_IMAGE`
before decoding, so extremely large images cannot exhaust memory. Corrupt,
truncated, zero-byte, and missing files are proven to degrade to clean errors
(decode) or `invalid` rows (inspect) without panicking. `run_batch` was
refactored to take a progress callback instead of a `&AppHandle` (mirroring the
Logo Pack processor), so batch behavior is testable without a Tauri app; new
tests prove one bad file never aborts a batch, progress fires per file, the
empty batch short-circuits, and a 64-file batch completes bounded (ignored
perf test). Error mapping now asserts all ten stable codes, and export tests
cover `ensure_output_dir` (missing path / regular file) and same-dir same-ext
non-destructive resolution.

**Frontend:** tool preferences persist through the existing settings
service/store (`tool.imageConverter.lastFormat`/`quality`,
`tool.imageCompressor.quality`, `tool.webLogoPack.selectedAssets`), seeded on
mount from the boot cache and written through on change. Vitest 4 + React
Testing Library + jsdom were introduced with centralized Tauri mocks
(`src/test/`); eight interaction-state tests cover the DropZone-only empty
state, invalid-file feedback + blocked export, progress + completion display,
partial-failure reporting, Logo Pack source validation messages, preset
listing/toggling, and inline command errors.

**Release:** a simple branded icon (charcoal rounded tile with three stacked
utility-drawer bars, source kept at `app-icon.png`) was generated and the full
icon set regenerated via `npm run tauri icon`. `tauri.conf.json` now bundles a
per-user NSIS installer (`Toolbox_0.1.0_x64-setup.exe`) with publisher,
description, category, and copyright metadata. ARCHITECTURE.md was reconciled
(decode guard in §17/§28, implemented tool-preference keys in §21, NSIS in
§33, stale 6-phase sketch in §32 replaced by a pointer to
`DEVELOPMENT_PHASES.md`).

## Completed work

- `tools/image/decode.rs` — `MAX_DIMENSION`/`MAX_PIXELS` constants +
  `check_size` guard on the PNG/JPEG decode path (header-only dimension read
  via `into_dimensions`, then re-open + decode); 5 tests (corrupt, truncated,
  zero-byte, over-limit, valid).
- `services/inspect.rs` — 4 tests (valid ready, corrupt invalid, zero-byte
  invalid, missing path).
- `services/batch.rs` — `run_batch(files, process, on_progress)` without
  `AppHandle`; concurrency rationale comment on `MAX_WORKER_THREADS`; 4 tests
  (partial failure, empty batch, ignored large batch, per-file progress).
- `commands.rs` — convert/compress commands wrap `run_batch`'s callback in
  `app.emit` (`use tauri::Emitter` at module top); `generate_logo_pack`
  unchanged.
- `errors.rs` — test asserting all ten `into_dto()` codes.
- `services/export.rs` — tests for `ensure_output_dir` (missing / file) and
  same-dir same-extension non-overwrite.
- `src/services/settings/index.ts` — `ToolPrefs` shape added to
  `PersistedSettings`.
- `src/app/providers/SettingsProvider.tsx` — tool prefs in state/context,
  typed `setToolPrefs(section, values)` deep-merge, hydration includes `tool`.
- `src/tools/batch-workspace/BatchWorkspace.tsx` — format/quality seeded from
  stored prefs, persisted via `changeFormat`/`changeQuality`.
- `src/tools/web-logo-pack/index.tsx` — asset selection seeded from stored
  `selectedAssets` (defaults when none), persisted on toggle/select-all via
  `persistAssets`.
- `package.json` / `package-lock.json` — `test`/`test:watch` scripts; devDeps
  vitest 4.1.10, jsdom 30, @testing-library/react 16, user-event 14,
  jest-dom 7.
- `vitest.config.ts` (new) — jsdom, `@` alias, setup file, no CSS.
- `src/test/setup.tsx` (new) — jest-dom matchers, `matchMedia` shim,
  vi.mock stubs for `@/services/tauri`, `@/services/settings`,
  `@tauri-apps/api/webview`, `mockTauri`/`resetMockTauri` helpers,
  `renderWithProviders`, explicit `afterEach(cleanup)`.
- `src/tools/batch-workspace/BatchWorkspace.test.tsx` (new) — 4 tests.
- `src/tools/web-logo-pack/WebLogoPack.test.tsx` (new) — 4 tests.
- `src-tauri/icons/**` — regenerated branded icon set; `app-icon.png` (new,
  repo root) is the 1024² source mark.
- `src-tauri/tauri.conf.json` — `bundle.active: true`, `targets: ["nsis"]`,
  icons, publisher/category/copyright/descriptions, NSIS `currentUser` +
  English, no language selector.
- `docs/ARCHITECTURE.md` — §17 decode guard, §21 tool-pref keys implemented,
  §28 concurrency/memory rationale, §32 legacy sketch superseded, §33 NSIS.

## Files changed

See Completed work (each bullet names the file and its change). Full diff:
`git diff` against `149b5a7` (phase 3 head).

## Validation

- `cargo check` — PASSED (zero warnings)
- `cargo test` — PASSED (41 passed, 1 ignored; the ignored 64-file batch test
  also run explicitly with `-- --ignored` and passed)
- `cargo check --release` — PASSED
- `npm run test` — PASSED (2 files, 8 tests)
- `npm run build` (tsc + vite build) — PASSED
- `npm run tauri build` — PASSED; installer at
  `src-tauri/target/release/bundle/nsis/Toolbox_0.1.0_x64-setup.exe` (2.7 MB)
- Release exe launch smoke (non-visual, process-alive check) — PASSED
  (stayed alive 6 s, then terminated)
- NOT RUN by agent (owner): installer install + launch on a clean profile,
  branded-icon visual acceptance, real large-batch profiling, read-only
  destination and over-limit image spot checks, restart persistence of tool
  preferences, full visual smoke of the three tools.

## Delegation

None — implementation performed directly. The Rust tasks share wiring
(`commands.rs` depends on `batch.rs`'s new signature), and the frontend tasks
are a small cohesive chain over the settings service/provider and two
components; parallel delegation offered no safe writable-area split worth the
context cost.

## Deviations and decisions

- **`run_batch` drops the `job_id` parameter** (the plan proposed keeping it in
  the signature). The callback emits at the command layer where `job_id` is
  already captured; keeping it inside `run_batch` would be a dead parameter.
- **Tool-pref keys use the ARCHITECTURE §21 names** (`lastFormat`,
  `selectedAssets`) instead of the plan's illustrative `format`/`assetIds`, so
  the docs and implementation agree without doc churn.
- **Tool-pref seeding is synchronous from the localStorage boot cache only**
  (same mechanism as `theme`/`exportPath`). If the on-disk store has prefs but
  the boot cache was cleared, the current session uses defaults; the next
  restart rehydrates. Acceptable per the existing settings design.
- **`src/test/setup.tsx` not `.ts`** — the helper renders JSX, which the oxc
  parser rejects in `.ts` files; vitest config points at `.tsx`.
- **Two test assertions use regexes** because of existing DOM shapes: the
  progress line renders "Processing 2 of 2" at 50% (`min(doneCount + 1,
  total)`), and row/failure error text is prefixed "— ".
- **Explicit `afterEach(cleanup)` in setup** — RTL auto-cleanup does not run
  with vitest `globals: false` (repo style uses explicit imports), and without
  it rendered DOM leaked between tests.
- **`app-icon.png` committed at repo root** as the tauri-icon source mark so
  rebranding is a one-command job.
- **`image` 0.25 API check:** `ImageReader` has no non-consuming
  `dimensions()`, so the guard reads header dimensions via `into_dimensions()`
  and re-opens the file for decode (WebP path unchanged, still bounded by its
  buffer-size query).

## Follow-up changes

- 2026-08-15 — **Release binary spawned a console window.** `main.rs` was
  missing `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`,
  so Windows treated the release app as a console-subsystem process (empty
  shell window on launch; closing it killed the app). Added the attribute
  (standard Tauri template pattern — the console remains for `tauri dev`),
  rebuilt `npm run tauri build`, verified the PE subsystem is GUI (2), and
  re-ran the launch smoke check (stays alive). Fixed in
  `src-tauri/target/release/bundle/nsis/Toolbox_0.1.0_x64-setup.exe`.

## Blockers or questions for the next Sol session

None architectural. Remaining owner actions: install `Toolbox_0.1.0_x64-setup.exe`,
verify the branded icon (agent could not visually inspect images), run the
manual checklist in `plan.md` (Validation), and optionally profile a real
100+ image batch to confirm the `min(cores, 4)` concurrency bound and peak
memory are comfortable in practice.
