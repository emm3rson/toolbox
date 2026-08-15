# Implementation Report

## Status

SUCCESS — all acceptance criteria and required validation passed (frontend
`npm run build`, native `cargo build` and `cargo test`).

CLOSED 2026-08-15 — owner smoke test completed; the two UI issues found were
fixed (see Follow-up changes).

## Summary

Phase 2 is implemented end to end. `inspect_files` now returns real image
format, dimensions, and file size, flags unsupported/corrupt files as invalid,
and expands dropped folders shallowly (Decision 10 — owner approved going
beyond literal Phase 2 scope). A real Rust processing pipeline
(decode → optional resize → encode → non-destructive export) backs the new
`convert_images` command, with bounded-concurrency batch execution, per-file
failure isolation, and `processing-progress` events correlated by an
adapter-injected `jobId`. The converter UI now excludes invalid files, reports
per-file errors inline, and surfaces top-level command errors instead of
unhandled rejections. Compress and Logo Pack remain mocked.

## Completed work

- Added `image` 0.25 (png/jpeg/ico features only — trimmed the heavy default
  AVIF/EXR/TIFF features), `image-webp` 0.2 (WebP decode; its encoder is
  lossless-only and unused), `libwebp-sys2` 0.2 (lossy WebP encode), `rayon`,
  and `thiserror`.
- `errors.rs`: `ProcessingError` enum with constructors for all ten contract
  codes and `into_dto()` → serializable `ProcessingErrorDto {code, message,
  detail?}`; `From<ProcessingError> for ProcessingErrorDto`.
- `models.rs`: `ConvertImagesRequest`, `ImageFormat` (png/jpeg/webp +
  `.jpg` extension rule), `ResizeOptions` (tagged `mode` enum), `FileResult`,
  `BatchResult`, `ProcessingProgress` — camelCase-serialized to match
  `contracts.ts`.
- `services/export.rs`: `ensure_output_dir` (`OUTPUT_UNAVAILABLE` for
  missing/moved destinations) and `resolve_output_path` with
  `photo → photo-2 → photo-3` auto-rename and an explicit source-path equality
  guard (non-destructive guarantee).
- `services/inspect.rs`: header-only inspection — PNG/JPEG via
  `ImageReader::into_dimensions()`, WebP via `image_webp::WebPDecoder` (lossy
  WebP would fail under `image`'s lossless-only decoder); invalid status with
  descriptive error for unsupported/corrupt files; shallow, sorted, non-
  recursive folder expansion.
- `tools/image/resize.rs`: `target_size`/`apply` with exact dimensions mode,
  aspect-preserving percentage mode, `Lanczos3`, `INVALID_DIMENSIONS`
  validation; `lockAspectRatio` intentionally ignored (frontend affordance).
- `tools/image/webp.rs`: the only `unsafe` block in the phase — a safe
  wrapper around `WebPEncodeRGBA`/`WebPFree` with quality clamping and
  null/zero-size handling.
- `services/batch.rs`: rayon pool of `min(available_parallelism, 4)` threads
  (`spawn_blocking`-offloaded from the async command), atomic completed
  counter, `processing-progress` emission after each file, single-file fast
  path.
- `tools/image/convert.rs`: per-file decode → resize → encode (PNG lossless,
  JPEG `new_with_quality`, WebP lossy via libwebp) → export; io error kinds
  mapped to `PERMISSION_DENIED` vs `WRITE_FAILED`/`FILE_NOT_FOUND`.
- `commands.rs`/`lib.rs`: `convert_images` async command registered.
- Frontend: `realAdapter.convertImages` now listens on `processing-progress`,
  filters by its own `crypto.randomUUID()` jobId, and invokes `convert_images`;
  `BatchWorkspace` marks invalid rows as failed with their error, excludes them
  from the batch (with a skipped-count note), and shows a dismissible inline
  error banner on command failure; mock `convertImages` removed.
- ARCHITECTURE.md §17 updated with the concrete crate selection.

## Files changed

- `src-tauri/Cargo.toml` / `Cargo.lock` — image/image-webp/libwebp-sys2/rayon/thiserror
- `src-tauri/src/errors.rs` (new) — error enum + DTO mapping
- `src-tauri/src/models.rs` — request/result DTOs, `ImageFormat`, `ResizeOptions`
- `src-tauri/src/lib.rs` — module wiring + `convert_images` handler
- `src-tauri/src/commands.rs` — `inspect_files` delegation + `convert_images`
- `src-tauri/src/services/mod.rs`, `export.rs`, `inspect.rs`, `batch.rs` (new)
- `src-tauri/src/tools/mod.rs`, `tools/image/mod.rs`, `resize.rs`, `webp.rs`, `convert.rs` (new)
- `src/services/tauri/realAdapter.ts` — real `convertImages` with event listen
- `src/services/tauri/mockAdapter.ts` — removed mock `convertImages`
- `src/tools/batch-workspace/BatchWorkspace.tsx` — invalid-file + error handling
- `docs/ARCHITECTURE.md` — crate selection recorded (§17)

## Validation

- `cargo check` in `src-tauri` — PASSED (zero warnings)
- `cargo test` in `src-tauri` — PASSED (14 tests: export collision/naming/non-
  destructive, resize math, WebP lossy encode smoke, PNG→JPG, PNG→WebP→PNG
  round trip, percentage resize output dimensions)
- `cargo build` in `src-tauri` — PASSED (vendored libwebp C compiles/links)
- `npm run build` (tsc + vite build) — PASSED

## Delegation

None — implementation performed directly. The Rust work is a cohesive sequence
over shared wiring files (`lib.rs`, `commands.rs`, `services/mod.rs`,
`tools/image/mod.rs`), so delegation offered no safe parallelism.

## Deviations and decisions

- **Owner decisions on the plan's open questions:** (1) folder input expansion
  included in `inspect_files` (slightly beyond literal Phase 2 scope — closes
  the advertised DropZone promise); (2) `convert_images` returns
  `Result<BatchResult, ProcessingErrorDto>` with frontend catch — kept as the
  architecturally cleaner structured-error design.
- **`libwebp-sys2` imports as `libwebp_sys`** — the package's `[lib]` name is
  `libwebp_sys` (0.2.0), so the FFI wrapper references `libwebp_sys::` (the
  plan/README said `libwebp_sys2::`; verified against the installed crate).
- **`image-webp` has no `image::ImageDecoder` impl in 0.2.4**, so WebP decode
  uses its native API directly (`WebPDecoder::new` + `dimensions()` +
  `output_buffer_size()` + `read_image()`), constructing `Rgb8`/`Rgba8`
  `DynamicImage`s based on `has_alpha()`.
- **`image` features trimmed** to `png, jpeg, ico` (defaults pull in the heavy
  AVIF/EXR/TIFF crates, e.g. `rav1e`).
- **`with_guessed_format` consumes the reader** — reassignment pattern used in
  `inspect.rs` and `convert.rs`.
- **`lock_aspect_ratio` field** carries `#[allow(dead_code)]` — intentionally
  unused in Rust (Decision 6).
- Per-file integration tests added now (beyond the plan's Phase 2 minimum) to
  prove the full pipeline; they seed Phase 4's processor fixture suite.

## Follow-up changes

- 2026-08-15 — fixed compile errors from crate-API verification: reader
  consumption by `with_guessed_format` (both call sites), `libwebp_sys` lib
  name, `par_iter`/`GenericImageView` trait imports, `imageops::resize` return
  wrap, `spawn_blocking` double-error mapping.
- 2026-08-15 — wired `PERMISSION_DENIED` io-kind mapping in `convert.rs` to
  resolve the unused-variant warning rather than suppressing it.
- 2026-08-15 — owner smoke-test UI fixes: removing the last file via the row
  X now returns to the DropZone empty state (was stuck on an empty list;
  `removeFile` helper in `BatchWorkspace`); the resize aspect-ratio lock now
  works — when locked, editing one dimension recomputes the other against the
  first source image's ratio (seeded via a new `sourceSize` prop on
  `ResizePanel`, falling back to the live pair ratio), and the emoji
  lock/unlock glyphs were replaced with new `LockIcon`/`UnlockIcon` from the
  shared icon library.

## Blockers or questions for the next Sol session

- None architectural. Remaining owner action is the visual smoke-test checklist
  in `plan.md` (requires `npm run tauri dev`), plus confirming the Logo Pack
  badge/cosmetic deferrals land correctly in Phase 3.
