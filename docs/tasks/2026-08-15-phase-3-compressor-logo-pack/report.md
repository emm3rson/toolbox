# Implementation Report

## Status

SUCCESS — all acceptance criteria and required validation passed (frontend
`npm run build`, native `cargo check`, `cargo build`, `cargo test`, and
`cargo check --release`). Owner smoke test completed; the one requested
behavior change (Logo Pack fresh-folder output) was implemented and validated
in a direct follow-up (see Follow-up changes).

## Summary

Phase 3 is implemented end to end. Both remaining tools now run on real Rust
processing, and no mock adapter remains (`mockAdapter.ts` deleted).

**Image Compressor:** `compress_images` preserves each source's format
(decode → optional resize → re-encode in the same format), writes
`photo-compressed.jpg` style names via the extended export service, runs the
shared bounded-concurrency batch with per-file failure isolation and
`processing-progress` events, and the completion summary shows actual
before/after sizes. PNG stays lossless (quality is a no-op for PNG, noted in
the UI); `BeforeAfter` now renders "No size reduction" instead of a negative
percentage when a re-encode is not smaller.

**Web Logo Pack:** `get_logo_presets` exposes the Standard Web Pack
(6 assets, owned centrally in Rust as a `LazyLock` preset list), and
`generate_logo_pack` validates a square ≥ 512 px source, generates the selected
assets (multi-res 16/32/48 ICO via `image::codecs::ico`, PNG resizes), writes
them into the `web-pack` folder (parent must exist, folder created), emits
progress, and returns a per-asset `BatchResult`. The frontend fetches presets
for the checkbox list (with a local fallback), validates early with specific
messages (unsupported / non-square / too-small), sends `assetIds`, shows
per-asset failures on completion, surfaces command errors inline, and only
shows the "Square · high resolution" badge for genuinely valid sources.

## Completed work

- `models.rs`: `CompressImagesRequest`, `GenerateLogoPackRequest`
  (`asset_ids`), `LogoAssetDefinition` DTOs (camelCase, matching the updated
  `contracts.ts`).
- `services/export.rs`: `resolve_output_path` gained an optional filename
  suffix (`-compressed`); new `create_output_dir` (`create_dir_all`) for the
  pack folder; suffix + nested-create unit tests.
- `tools/image/decode.rs` (new): shared `decode` (WebP via `image-webp`,
  PNG/JPEG via `image`) and `detect_format` (header → model `ImageFormat`).
- `tools/image/encode.rs` (new): shared PNG/JPEG/WebP encode dispatch (PNG
  lossless, JPEG `new_with_quality`, WebP `encode_lossy`, quality clamped).
- `tools/image/resize.rs`: public `resize(img, (w, h))` primitive (Lanczos3);
  `apply` refactored onto it.
- `tools/image/convert.rs`: uses the shared `decode`/`encode`; passes
  `suffix: None`.
- `tools/image/compress.rs` (new): `compress_file` — same-format re-encode at
  quality, `-compressed` suffix, non-destructive export; PNG + JPEG fixture
  tests.
- `tools/image/logo_pack.rs` (new): `STANDARD_WEB_PACK` preset (favicon.ico
  multi-res, 16/32/48 PNG, apple-touch 180, icon-192, icon-512), `preset_by_id`,
  `generate` (parent validation, square ≥ 512 validation, per-asset generation
  with sequential progress callback, `BatchResult`); 5 tests incl. full-pack
  ICO header check.
- `commands.rs`/`lib.rs`: `compress_images`, `generate_logo_pack`
  (spawn_blocking + progress emission), `get_logo_presets`; all registered.
- Frontend `contracts.ts`: `GenerateLogoPackRequest.assets` →
  `assetIds: string[]`; `LogoAssetDefinition`; `getLogoPresets()` on the
  adapter. `realAdapter.ts`: shared `runWithProgress` helper used by all three
  processing commands; `getLogoPresets` via invoke. `mockAdapter.ts` deleted.
- `Completion.tsx`: `BeforeAfter` handles `after >= before` with a neutral
  "No size reduction" state.
- `BatchWorkspace.tsx`: compress panel note — "PNG is lossless — quality
  applies to JPG and WebP only."
- `web-logo-pack/index.tsx`: presets fetched from Rust (local fallback for
  browser dev), asset rows keyed by id, specific source-validation messages
  (unsupported / non-square / too-small), `assetIds` in the request, try/catch
  with inline error banner, per-asset failures shown in completion, badge only
  for square ≥ 512 sources.

## Files changed

- `src-tauri/src/models.rs` — compress/logo request + preset DTOs
- `src-tauri/src/services/export.rs` — suffix naming, `create_output_dir`, tests
- `src-tauri/src/tools/image/decode.rs` (new) — shared decode + `detect_format`
- `src-tauri/src/tools/image/encode.rs` (new) — shared format encode dispatch
- `src-tauri/src/tools/image/resize.rs` — `resize(img, (w, h))` primitive
- `src-tauri/src/tools/image/convert.rs` — uses shared decode/encode
- `src-tauri/src/tools/image/compress.rs` (new) — compress processor + tests
- `src-tauri/src/tools/image/logo_pack.rs` (new) — presets + ICO processor + tests
- `src-tauri/src/tools/image/mod.rs` — module wiring
- `src-tauri/src/commands.rs` / `lib.rs` — three new commands + registration
- `src/services/tauri/contracts.ts` — `assetIds`, `LogoAssetDefinition`, `getLogoPresets`
- `src/services/tauri/realAdapter.ts` — real commands + `runWithProgress` helper
- `src/services/tauri/mockAdapter.ts` (deleted) — last mock processing removed
- `src/components/processing/Completion.tsx` — negative-savings guard
- `src/tools/batch-workspace/BatchWorkspace.tsx` — PNG-lossless note
- `src/tools/web-logo-pack/index.tsx` — presets, validation, errors, assetIds

## Validation

- `cargo check` — PASSED (zero warnings)
- `cargo build` — PASSED
- `cargo test` — PASSED (23 tests: 14 existing + 2 export suffix/create, 2
  compress, 5 logo pack)
- `cargo check --release` — PASSED (optimized profile compiles)
- `npm run build` (tsc + vite build) — PASSED

## Delegation

None — implementation performed directly. The Rust work is a cohesive
sequential chain over shared wiring files (`models.rs`, `services/export.rs`,
`tools/image/*`, `commands.rs`, `lib.rs`), so delegation offered no safe
parallelism; the frontend tasks share the same adapter/contract surface and
were integrated in place.

## Deviations and decisions

- **Shared `encode` module.** The plan said to keep `encode` local to
  `convert.rs` for now; it was extracted to `tools/image/encode.rs` instead so
  `compress.rs` reuses the identical PNG/JPEG/WebP dispatch rather than
  duplicating it (single clamping/error-mapping path for all encoders).
- **`logo_pack::generate` takes an `on_progress` callback instead of an
  `AppHandle`.** The planned `tauri::test::mock_app()` approach required
  tauri's `test` feature, which produced a `STATUS_ENTRYPOINT_NOT_FOUND`
  (0xc0000139) crash running the test binary on Windows. Making the processor
  runtime-agnostic (progress callback; the command wraps it in `app.emit`)
  fixed the tests, removed the dev-dependency, and is closer to ARCHITECTURE
  §35's "processors testable without rendering the UI".
- **`STANDARD_WEB_PACK` is a `LazyLock<Vec<LogoAssetDefinition>>`, not a
  `const &[...]`** — `String` fields cannot be constructed in a const
  initializer.
- **Logo Pack completion now passes `failures` to `Completion`** so per-asset
  failures render inline on the completion screen (the plan's per-asset
  failure isolation surfaced this naturally; the mock previously never failed).
- **Owner-confirmed decisions applied as planned:** Decision 3 (PNG lossless,
  quality no-op with UI note), Decision 7 (`BatchResult` return; snippet stays
  a frontend constant), Decision 9 (pack folder overwrites prior outputs,
  canonical filenames), ICO internal sizes 16/32/48.

  Decision 9 was **revised by the owner after the initial smoke test**: each
  run now creates a fresh numbered folder (`web-pack`, `web-pack-2`, ...)
  instead of overwriting; see Follow-up changes.
- **`IcoEncoder` API verified against `image` 0.25.10**: multi-size ICO via
  `IcoFrame::with_encoded(png_bytes, w, h, ExtendedColorType::Rgba8)` +
  `IcoEncoder::new(w).encode_images(&frames)` (sizes must be ≤ 256; our max is
  48).

## Follow-up changes

- 2026-08-15 — `non-square` object key in `invalidCopy` must be quoted in
  JavaScript (`'non-square':`), caught by `tsc`; fixed, `npm run build` re-run.
- 2026-08-15 — compress panel note originally duplicated the em-dash style;
  exact-match edit applied against the file's em-dash character.
- 2026-08-15 — **Logo Pack fresh-folder output (owner request).** Decision 9
  revised: each run now resolves a fresh pack folder (`web-pack`,
  `web-pack-2`, ...) instead of overwriting prior outputs. Rust owns the
  naming (`export::resolve_output_dir` + `PACK_FOLDER_NAME` in
  `logo_pack.rs`); `generate_logo_pack` returns a new
  `GenerateLogoPackResult { packDirectory, batch }` DTO and the frontend
  passes the export root (no more `\web-pack` literal), shows the export root
  in the pre-generation Export Location, and uses the returned
  `packDirectory` for "Saved to" and "Open folder". Export service tests +
  `second_generation_uses_numbered_folder_and_keeps_first` added. Validated:
  `cargo test` (25) and `npm run build` pass.

## Blockers or questions for the next Sol session

- None architectural. Remaining owner action is the visual smoke-test checklist
  in `plan.md` (requires `npm run tauri dev`), especially: real compressed
  files with `-compressed` naming and "No size reduction" at high quality, the
  generated `web-pack` folder contents incl. a multi-size `favicon.ico`, the
  three specific source-validation messages, and asset toggling.
