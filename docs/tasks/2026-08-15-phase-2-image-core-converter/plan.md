# Phase 2 — Image Processing Core + Image Converter

**Status: CLOSED** — implemented, validated, and owner smoke-tested on
2026-08-15. See `report.md` for the implementation report and follow-ups.

## Objective

Replace the mocked `convertImages` with a real Rust image-processing pipeline
and deliver the Image Converter end-to-end, while extending `inspect_files` to
return real image dimensions and format validation.

User-visible outcomes (from `docs/DEVELOPMENT_PHASES.md`):

- Dropped/selected images show real dimensions (width × height) in the file
  list.
- Non-image / corrupt files are flagged in the list and excluded from the
  batch.
- Selecting an output format (PNG/JPG/WebP) + optional resize + Export produces
  real converted files in the chosen destination.
- Batch processing reports progress and isolates per-file failures (one bad
  file does not break the batch).
- Files are never overwritten in place; filename collisions auto-rename.

Image Compressor and Web Logo Pack remain mocked (Phase 3).

## Current state

Phase 1 is complete. Relevant as-built facts:

- **Native layer is minimal.** `src-tauri/src/lib.rs` registers the
  dialog/opener/store plugins and a single command, `inspect_files`.
  `src-tauri/src/commands.rs` implements `inspect_files` with
  `std::fs::metadata` only — it returns real `name`/`extension`/`size` but
  `width`/`height` are always `0` and `status` is `"ready"` for any existing
  file (even non-images), `"invalid"` only for missing paths.
  `src-tauri/src/models.rs` holds the `InputFile` DTO. There is no error type,
  no image dependency, no processing services.
- **Adapter boundary** is in `src/services/tauri/contracts.ts` (`TauriAdapter`
  + `ConvertImagesRequest`, `ResizeOptions`, `BatchResult`, `FileResult`,
  `ProcessingProgress`, `ProcessingError`, `ProcessingErrorCode`). The 10 error
  codes are already declared there.
- **`src/services/tauri/realAdapter.ts`** wires real OS/inspect methods but
  delegates `convertImages` (and `compressImages`/`generateLogoPack`) to
  `mockProcessing` in `src/services/tauri/mockAdapter.ts`, which fabricates a
  `BatchResult` after `setTimeout` delays and emits progress through the
  `onProgress` callback.
- **`src/tools/batch-workspace/BatchWorkspace.tsx`** owns the converter and
  compressor UI. `process()` builds a `ConvertImagesRequest`
  (`{files, outputDirectory, outputFormat, quality?, resize}`) and awaits
  `desktop.convertImages(...)` with an `onProgress` callback that drives a
  percentage bar. It has **no error handling** (no try/catch) and sends **all**
  file paths regardless of `status`, so invalid files would be passed straight
  to processing.
- `src/components/workspace.tsx` `FileRow` already renders `width × height`
  only when `> 0` and supports an `error` prop; `status` values map to
  idle/processing/done/failed icons.
- The DropZone hint already advertises "Drop a folder to add every image
  directly inside it", but `inspect_files` does not expand directories
  (a dropped folder path is reported `"invalid"`).

## Decisions and constraints

1. **Image crate set** (durable decision; record in `ARCHITECTURE.md` §17 once
   implemented):
   - `image = "0.25"` — PNG/JPEG decode+encode, resize (`imageops`), dimension
     sniffing, ICO for Phase 3. (Latest verified: 0.25.10.)
   - `image-webp = "0.2"` — pure-Rust WebP **decode** (lossless + lossy +
     alpha) and lossless encode. Its decoder is required because `image`'s
     built-in WebP decoder is lossless-only and cannot read the lossy WebP
     files a converter will commonly receive. (Latest verified: 0.2.4.)
   - `libwebp-sys2 = "0.2"` — raw FFI to libwebp (vendored C source, BSD-3).
     Used **only** for lossy WebP **encode**. MSVC Build Tools are already
     installed (Phase 1).
2. **Lossy WebP output is confirmed** (owner decision). The quality slider
   applies to WebP exactly as to JPG. Implementation: a small safe wrapper
   around `libwebp_sys2::WebPEncodeRGBA` (RGBA buffer + width/height/stride +
   quality 0–100 → `Vec<u8>`). WebP **decode** still uses `image-webp` (pure
   Rust), so libwebp FFI stays minimal and encode-only.
3. **Concurrency = bounded rayon pool.** `convert_images` is an `async fn`
   that wraps CPU work in `tauri::async_runtime::spawn_blocking`. Inside, a
   `rayon::ThreadPoolBuilder` pool of
   `min(std::thread::available_parallelism(), 4)` threads processes files with
   `par_iter`. The cap of 4 is a starting point (image decode is memory-heavy);
   Phase 4 profiles/tunes it.
4. **Progress via one event name.** Rust emits
   `app.emit("processing-progress", ProcessingProgress)` where
   `ProcessingProgress = { jobId, completed, total, currentFile? }`. The
   frontend adapter generates `jobId = crypto.randomUUID()`, `listen`s on
   `processing-progress`, filters by `jobId`, and routes to the existing
   `onProgress` callback. The component's `convertImages(request, onProgress)`
   signature is unchanged; `jobId` is injected by the adapter, so
   `BatchWorkspace` needs no change for the swap itself. The same event name is
   reused by Phase 3 tools.
5. **Export service is the single source of naming/collision rules.** Always
   auto-rename: `photo.webp → photo-2.webp → photo-3.webp`. Non-destructive
   guarantee (§20): if a resolved output path equals the source path, treat it
   as a collision and rename (belt-and-suspenders on top of the `exists()`
   check, since the source file itself already occupies that path). JPEG output
   extension is `.jpg` (png→`.png`, webp→`.webp`).
6. **Resize semantics** (mirror `contracts.ts` `ResizeOptions`):
   - `original` → no resize.
   - `dimensions { width, height, lockAspectRatio }` → resize to exactly
     `width × height`. `lockAspectRatio` is a **frontend-only** affordance (the
     UI already computes the companion dimension); Rust trusts `width`/`height`
     and ignores the flag.
   - `percentage { percentage }` → scale both axes by `percentage / 100`,
     preserving aspect ratio (round to `>= 1`).
   - Resample with `image::imageops::FilterType::Lanczos3`.
   - Validate: `width > 0 && height > 0`; `percentage > 0`. Invalid →
     `INVALID_DIMENSIONS`.
7. **Error model.** A small internal error enum (recommend `thiserror = "2"`)
   mapping to a serializable `ProcessingErrorDto { code, message, detail? }`
   whose `code` is exactly one of the 10 strings already declared in
   `contracts.ts`. Per-file failures land in `FileResult.error`; only setup
   failures (e.g. output directory unavailable) return `Err` from the command.
8. **`convert_images` returns `Result<BatchResult, ProcessingErrorDto>`.** It
   validates the output directory up front (`OUTPUT_UNAVAILABLE` if missing or
   not a directory) and otherwise always returns a `BatchResult` (even an
   all-failed one). The frontend must catch the command `Err` (new, small error
   state in `BatchWorkspace`).
9. **`inspect_files` gains real image inspection** but stays cheap: use header
   reads (`ImageReader::into_dimensions()`; `image_webp::WebPDecoder::dimensions()`
   for WebP) rather than full decode. Mark `status: "invalid"` with a
   descriptive `error` for unsupported formats (anything not PNG/JPEG/WebP) and
   corrupt files. Square validation stays Phase 3 (Logo Pack domain logic, per
   ARCHITECTURE §5).
10. **Folder input (shallow, non-recursive) is folded into `inspect_files`** to
    close a Phase 1 gap: a directory path expands to its direct children that
    are supported image files; a file path yields itself. This honors the
    existing DropZone hint and ARCHITECTURE §13. (Flagged as confirm-with-owner
    in Risks.)
11. **Local-first / non-destructive / no network** hold. Use `Path`/`PathBuf`,
    never hard-coded separators (ARCHITECTURE §27). Treat frontend input as
    untrusted at the command boundary (validate paths, output directory).

## Implementation tasks

The Rust work is cohesive and touches shared wiring files (`lib.rs`,
`commands.rs`, `services/mod.rs`, `tools/image/mod.rs`); implement it in order
(Tasks 0 → 6). The two frontend tasks (7, 8) depend on the backend and can run
in parallel with each other afterwards.

### Task 0: Dependencies, error model, and request/result DTOs

- Goal: Add the image crates and establish the serializable types both the
  processing and command layers will use, so later tasks compile against them.
- Relevant files:
  - `src-tauri/Cargo.toml`
  - `src-tauri/src/errors.rs` (new)
  - `src-tauri/src/models.rs`
  - `src-tauri/src/lib.rs` (`mod errors;`)
- Implementation guidance:
  - `Cargo.toml` additions: `image = "0.25"`, `image-webp = "0.2"`,
    `libwebp-sys2 = "0.2"`, `rayon = "1"`, `thiserror = "2"`.
  - `errors.rs`: a `thiserror` enum `ProcessingError` with variants mirroring
    the contract codes — `UnsupportedFormat`, `InvalidImage`,
    `InvalidDimensions`, `FileNotFound`, `PermissionDenied`,
    `OutputUnavailable`, `EncodeFailed`, `DecodeFailed`, `WriteFailed`,
    `ProcessingFailed` — each carrying a user-facing `message` and an optional
    `detail` (source path, underlying error string). Add
    `impl ProcessingError { fn into_dto(self) -> ProcessingErrorDto }` and a
    `ProcessingErrorDto { code, message, detail? }` with `#[serde(rename_all =
    "camelCase")]` and `skip_serializing_if` on `detail`. Add a convenience
    `ProcessingErrorDto::processing_failed(msg)` for the join/panic path. Map
    `image::ImageError::Unsupported(_)` → `UnsupportedFormat`,
    `image::ImageError::Decoding(_)` → `DecodeFailed`, io-not-found →
    `FileNotFound`, io-permission → `PermissionDenied` (exact match arms belong
    in the tasks that surface those errors; this task just provides the
    constructor helpers).
  - `models.rs`: add `#[derive(serde::Deserialize)]` request/option DTOs
    (`rename_all = "camelCase"`) and `#[derive(serde::Serialize)]` result DTOs
    (`rename_all = "camelCase"`), matching `contracts.ts` exactly:
    - `ConvertImagesRequest { files: Vec<String>, output_directory: String,
      output_format: ImageFormat, quality: Option<u8>, resize: ResizeOptions,
      job_id: String }`
    - `ImageFormat` enum `{ Png, Jpeg, Webp }` with `rename_all = "lowercase"`
      and a helper `fn extension(&self) -> &'static str` returning
      `"png"`/`"jpg"`/`"webp"`.
    - `ResizeOptions` enum using `#[serde(tag = "mode", rename_all =
      "camelCase")]` with variants `Original`, `Dimensions { width, height,
      lock_aspect_ratio }`, `Percentage { percentage }`.
    - `FileResult { source_path, output_path: Option, success, original_size,
      output_size: Option, error: Option<ProcessingErrorDto> }`
    - `BatchResult { total, succeeded, failed, items }`
    - `ProcessingProgress { job_id, completed, total, current_file: Option }`
      (Serialize).
  - Keep the existing `InputFile` struct; it already has `width`/`height`.
- Dependencies: None.
- Acceptance criteria: `cargo check` compiles with the new deps and types; the
  DTO shapes deserialize from a sample `contracts.ts`-shaped JSON blob.

### Task 1: Export service (naming + collision + non-destructive)

- Goal: Centralize output-path resolution with auto-rename and the
  non-destructive guard, as pure, unit-testable functions.
- Relevant files:
  - `src-tauri/src/services/mod.rs` (new; `pub mod export;`)
  - `src-tauri/src/services/export.rs` (new)
  - `src-tauri/src/lib.rs` (`mod services;`)
- Implementation guidance:
  - `pub fn resolve_output_path(output_dir: &Path, source_path: &Path, ext: &str)
    -> Result<PathBuf, ProcessingError>`:
    - `stem = source_path.file_stem()` (missing → `ProcessingFailed`).
    - candidate `n = 0`: `output_dir.join(stem.ext)`; for `n >= 2`:
      `output_dir.join(format!("{stem}-{n}.{ext}"))`.
    - Loop while `candidate == source_path || candidate.exists()` → increment.
      (The `== source` check implements the §20 non-destructive rule even if
      `exists()` semantics ever diverge.)
    - Return the first free candidate.
  - `pub fn ensure_output_dir(dir: &Path) -> Result<(), ProcessingError>`:
    error `OutputUnavailable` if `!dir.is_dir()` (covers missing/moved paths).
  - Add unit tests here (collision `photo.webp → photo-2.webp`, source-in-output
    rename, `.jpeg → .jpg`). Tests belong to the file; Phase 4 extends them.
- Dependencies: Task 0 (`ProcessingError`).
- Acceptance criteria: `cargo test` in `src-tauri` passes the collision/naming
  tests; no source-path overwrite can be produced.

### Task 2: Real image inspection in `inspect_files` (+ folder expansion)

- Goal: `inspect_files` returns real dimensions and format validity, and
  expands directories shallowly, so the file list shows real metadata and
  invalid files are flagged.
- Relevant files:
  - `src-tauri/src/services/inspect.rs` (new)
  - `src-tauri/src/services/mod.rs` (`pub mod inspect;`)
  - `src-tauri/src/commands.rs` (delegate `inspect_files` to the service)
- Implementation guidance:
  - `pub fn inspect_paths(paths: Vec<String>) -> Vec<InputFile>`:
    - For each path: if it is a directory (`fs::metadata(...).is_dir()`),
      `read_dir` and return each direct child that is a file and has a supported
      extension (png/jpg/jpeg/webp) — shallow, no recursion. Preserve input
      order and stable child ordering (`sort_by_file_name`).
    - For a file: `ImageReader::open(path)` → on error return `status
      "invalid"` with `error` "File not found" (or permission message).
      `format = reader.format()`; if not `Png | Jpeg | Webp` → `status
      "invalid"`, `error: Some("Unsupported format")`, but still set `size`
      from metadata. Then read dimensions via header only: for WebP use
      `image_webp::WebPDecoder::new(...).dimensions()`; for PNG/JPEG use
      `ImageReader::into_dimensions()`. Decode not performed here.
    - On dimension-read failure → `status "invalid"`, `error: Some("Not a
      valid image")`.
    - Success → `status "ready"`, real `width`/`height`.
  - Keep `inspect_files` `pub` (Tauri `generate_handler!` visibility) and have
    `commands.rs::inspect_files` simply call `services::inspect::inspect_paths`.
  - Note: because dimensions become real, the Web Logo Pack "Square · high
    resolution" badge (in `web-logo-pack/index.tsx`) will now render for any
    sized image — this is a known cosmetic deferral to Phase 3's real square
    validation; do not "fix" it here.
- Dependencies: Task 0, Task 1 (services/mod shared).
- Acceptance criteria: `cargo build` compiles; a real PNG/JPEG returns correct
  dimensions, a `.txt`/`.gif` returns `status "invalid"`, a corrupt file
  returns `"invalid"`, and a folder path expands to its direct image children.

### Task 3: Resize engine + lossy WebP encoder

- Goal: Provide the two image primitives the converter composes: resize math
  and lossy WebP encoding.
- Relevant files:
  - `src-tauri/src/tools/mod.rs` (new; `pub mod image;`)
  - `src-tauri/src/tools/image/mod.rs` (new; `pub mod resize; pub mod webp;`)
  - `src-tauri/src/tools/image/resize.rs` (new)
  - `src-tauri/src/tools/image/webp.rs` (new)
  - `src-tauri/src/lib.rs` (`mod tools;`)
- Implementation guidance:
  - `resize.rs`:
    - `pub fn target_size(original: (u32, u32), opts: &ResizeOptions) ->
      Result<Option<(u32, u32)>, ProcessingError>` implementing Decision 6
      (`None` for `original`; exact for `dimensions`; proportional for
      `percentage`). Validate and return `InvalidDimensions`.
    - `pub fn resize(img: &DynamicImage, (w, h)) -> DynamicImage` using
      `imageops::resize(..., FilterType::Lanczos3)`.
    - Unit tests: aspect-preserving percentage math, zero/overflow rejection.
  - `webp.rs`:
    - `pub fn encode_lossy(img: &DynamicImage, quality: u8) -> Result<Vec<u8>,
      ProcessingError>`: `let rgba = img.to_rgba8();` call
      `libwebp_sys2::WebPEncodeRGBA(rgba.as_ptr(), w, h, w*4, quality)`
      (returns a `*mut u8` + size; copy into `Vec`, free via the crate's
      free function). Clamp quality to `1..=100`. Map a null pointer to
      `EncodeFailed`. This is the only `unsafe` block in the phase; keep it
      isolated here and documented.
    - Verify the exact FFI signatures (encode + free) against the installed
      `libwebp-sys2` version during implementation.
- Dependencies: Task 0 (`ResizeOptions`, `ProcessingError`).
- Acceptance criteria: `cargo test` passes resize tests; a smoke unit test
  encodes a tiny RGBA image to non-empty WebP bytes (this also proves libwebp
  links on the local toolchain).

### Task 4: Batch service (bounded concurrency + progress events)

- Goal: A reusable batch runner that processes files in parallel with bounded
  concurrency and emits `processing-progress` events.
- Relevant files:
  - `src-tauri/src/services/batch.rs` (new)
  - `src-tauri/src/services/mod.rs` (`pub mod batch;`)
- Implementation guidance:
  - `pub fn run_batch<F>(app: &tauri::AppHandle, job_id: String, files: &
    [PathBuf], process: F) -> Result<BatchResult, ProcessingError> where
    F: Fn(&Path) -> FileResult + Sync`:
    - Build `rayon::ThreadPoolBuilder::new().num_threads(min(available_parallelism,
      4))`.
    - `pool.install(|| files.par_iter().map(|p| { let r = process(p); let done =
      counter.fetch_add(1) + 1; let _ = app.emit("processing-progress",
      ProcessingProgress { job_id, completed: done, total: files.len(),
      current_file: Some(path_string) }); r }).collect::<Vec<_>>())`.
    - Assemble `BatchResult { total, succeeded, failed, items }` from the vec.
    - Use an `AtomicUsize` counter. `AppHandle` is `Send + Sync`, so emitting
      from worker threads is safe.
  - Keep the event name string as a shared `const` (e.g. `EVENT_PROGRESS`).
  - No rayon pooling for a single file (skip the pool when `files.len() <= 1`).
- Dependencies: Task 0 (`ProcessingProgress`, `BatchResult`, `FileResult`).
- Acceptance criteria: `cargo build` compiles; unit test with a small closure
  processes N files and returns a `BatchResult` with correct counts.

### Task 5: Convert processor (per-file decode → resize → encode → export)

- Goal: The per-file pipeline used by `run_batch` for conversion.
- Relevant files:
  - `src-tauri/src/tools/image/convert.rs` (new)
  - `src-tauri/src/tools/image/mod.rs` (`pub mod convert;`)
- Implementation guidance:
  - `pub fn convert_file(source: &Path, output_dir: &Path, format: ImageFormat,
    quality: Option<u8>, resize_opts: &ResizeOptions) -> FileResult`:
    - `original_size = fs::metadata(source).len()` (error → `FileNotFound`
      FileResult).
    - Decode: `format == Webp` → `image_webp::WebPDecoder`; else
      `image::ImageReader::open(...).with_guessed_format()?.decode()`. Map
      errors per Decision 1/7 (unsupported → `UNSUPPORTED_FORMAT`, decode →
      `DECODE_FAILED`).
    - Resize via `resize::target_size` + `resize::resize`.
    - Encode to `Vec<u8>`: `Png` → `write_to(Cursor, ImageFormat::Png)`;
      `Jpeg` → `JpegEncoder::new_with_quality(&mut buf, quality.unwrap_or(82))`
      then `img.write_with_encoder(...)`; `Webp` → `webp::encode_lossy(img,
      quality.unwrap_or(82))`.
    - `resolve_output_path(output_dir, source, format.extension())` (Task 1),
      then `fs::write` (map to `WRITE_FAILED`/`OUTPUT_UNAVAILABLE`).
    - Return `FileResult { success, output_path: Some, original_size,
      output_size: Some(bytes.len()) }` or the appropriate failure `FileResult
      { success: false, error: Some(dto) }`. Never panic: catch per-file
      errors and return them.
  - This module composes Tasks 1/3/4 primitives; keep it free of its own
    collision/FFI logic.
- Dependencies: Tasks 1, 3, 4.
- Acceptance criteria: `cargo build` compiles; a fixture PNG→JPG conversion
  writes a real `.jpg` and reports `success: true` with plausible sizes.

### Task 6: `convert_images` command + registration

- Goal: Wire the command that validates the destination, runs the batch, and
  returns `Result<BatchResult, ProcessingErrorDto>`.
- Relevant files:
  - `src-tauri/src/commands.rs`
  - `src-tauri/src/lib.rs` (add `convert_images` to `generate_handler!`)
- Implementation guidance:
  - `#[tauri::command] pub async fn convert_images(app: tauri::AppHandle,
    request: ConvertImagesRequest) -> Result<BatchResult, ProcessingErrorDto>`:
    - `export::ensure_output_dir(&PathBuf::from(&request.output_directory))?`
    - Capture `app`, `request`, clone the paths into `Vec<PathBuf>`.
    - `tauri::async_runtime::spawn_blocking(move ||
      batch::run_batch(&app, request.job_id, &paths, |src| convert::convert_file(
      src, &out_dir, request.output_format, request.quality, &request.resize)))`
      `.await.map_err(|_| ProcessingErrorDto::processing_failed(...))?`
    - Return the inner `Result<BatchResult, ProcessingError>` mapped to
      `Result<BatchResult, ProcessingErrorDto>`.
  - Ensure `commands::convert_images` is `pub`.
  - JS invocation is `invoke('convert_images', { request })` — a single
    `request` argument; Tauri injects `app` automatically.
- Dependencies: Tasks 4, 5.
- Acceptance criteria: `cargo build` compiles; command is registered; a manual
  or fixture-driven call returns a real `BatchResult` (or `OUTPUT_UNAVAILABLE`
  for a bad directory).

### Task 7: Real `convertImages` adapter (event listen + invoke)

- Goal: Point `desktop.convertImages` at the real command with job-correlated
  progress, keeping the component signature unchanged.
- Relevant files:
  - `src/services/tauri/realAdapter.ts`
  - `src/services/tauri/mockAdapter.ts` (trim `convertImages`)
- Implementation guidance:
  - `realAdapter.convertImages(request, onProgress)`:
    - `const jobId = crypto.randomUUID()`.
    - If `onProgress`, `const unlisten = await listen<ProcessingProgress>(
      'processing-progress', (e) => { if (e.payload.jobId === jobId)
      onProgress(e.payload) })` (import `listen` from `@tauri-apps/api/event`).
    - `try { return await invoke<BatchResult>('convert_images', { request:
      { ...request, jobId } }) } finally { unlisten?.() }`.
  - Remove the `convertImages` delegation to `mockProcessing`; leave
    `compressImages`/`generateLogoPack` mocked (Phase 3). Trim the now-unused
    mock `convertImages` (or keep behind the mock object if the browser-dev
    fallback needs it — coordinator's call; do not leave dead imports).
  - No `contracts.ts` change is required (the component-facing request shape
    and `ProcessingProgress`/`BatchResult` already match; `jobId` is
    adapter-internal).
- Dependencies: Task 6.
- Acceptance criteria: `npm run build` passes; invoking `desktop.convertImages`
  calls `convert_images` and forwards progress events with the matching `jobId`.

### Task 8: Invalid-file handling + command-error state in `BatchWorkspace`

- Goal: Exclude invalid files from the batch and surface a top-level command
  error, so the converter degrades gracefully.
- Relevant files:
  - `src/tools/batch-workspace/BatchWorkspace.tsx`
- Implementation guidance:
  - In `addFiles`, after `inspectFiles`, keep all files in state but mark
    `status === 'invalid'` ones in the list (pass `status: 'failed'` and
    `error: file.error` to `FileRow`).
  - In `process()`, build `paths` only from `status === 'ready'` files; if
    none are ready, do nothing (or disable the action). Compute a count of
    excluded files for the list header/hint if straightforward.
  - Wrap the `desktop.convertImages(...)` (and `compressImages`, though still
    mocked) await in try/catch; on error set a local `error` string and show a
    compact dismissible message (reuse existing card/border tokens), and return
    to `editing` rather than `done`.
  - Keep the existing progress/result display and `FileRow` wiring otherwise
    intact.
- Dependencies: Task 2 (real `invalid` status), Task 7 (real command that can
  reject).
- Acceptance criteria: `npm run build` passes; dropping a mix of images and a
  `.txt` shows the `.txt` flagged and excludes it from the export; a deleted
  export directory surfaces an inline error instead of an unhandled rejection.

## Validation

- Frontend/browser check: `npm run build` (`tsc` + `vite build`) must pass.
- Native checks (reported separately per AGENTS.md):
  - `cargo check` / `cargo build` in `src-tauri` must compile (including the
    vendored libwebp C build).
  - `cargo test` in `src-tauri` runs the export/resize/webp/batch unit tests.
- No automated frontend test framework is present yet (Phase 4), so frontend
  verification is build + owner smoke test.
- Rust unit tests added in this phase (export collision, resize math, WebP
  encode smoke, batch counts) are the seed for Phase 4's fuller suite.

Owner smoke-test checklist (UI changes — not to be claimed as performed by the
implementer without actually running it):

1. `npm run tauri dev` → Convert Images → drop a PNG, JPG, and WebP (one lossy)
   → list shows real dimensions.
2. Drop a `.txt` (or `.gif`) alongside images → the invalid file is flagged and
   excluded from the export.
3. Choose WebP + quality 50 → Export → real `.webp` files appear in the
   destination with visibly lossy output.
4. Choose PNG and JPEG outputs → correct files with correct extensions (`.jpg`
   for JPEG).
5. Apply a percentage resize (e.g. 50%) and a dimensions resize → output
   dimensions match.
6. Re-export the same batch to the same folder → files auto-rename
   (`photo-2.webp`, etc.); originals untouched.
7. Set the export directory to the source directory and convert a `photo.png`
   to PNG → a renamed copy is produced, never overwriting the source.
8. Delete the export directory after choosing it, then Export → an inline error
   is shown (no crash).
9. Confirm progress advances and one corrupt file does not stop the batch.

## Risks and open questions

- **Lossy WebP via `libwebp-sys2`** adds an `unsafe` FFI + vendored C build.
  The wrapper is ~50 lines and isolated in `tools/image/webp.rs`. Build requires
  a working C compiler (MSVC Build Tools, already installed). Verify the exact
  `WebPEncodeRGBA`/free signatures against the installed crate version during
  Task 3.
- **WebP decode path needs `image-webp`.** `image`'s built-in WebP decoder is
  lossless-only; without branching to `image_webp::WebPDecoder`, lossy WebP
  inputs (common) would fail decode. The plan branches on `format == Webp`;
  confirm the exact `WebPDecoder` constructor API on docs.rs.
- **Progress ordering is nondeterministic** under `par_iter` (completion order,
  not input order). The percentage is driven by `completed/total` so it stays
  correct; the `currentFile` row highlight may flicker slightly. Acceptable for
  V1; revisit only if the owner flags it.
- **Folder input is folded into `inspect_files`** (Decision 10) to close the
  advertised-but-missing Phase 1 behavior. This is slightly beyond the literal
  Phase 2 scope in `DEVELOPMENT_PHASES.md`; confirm with the owner or drop Task
  2's directory-expansion sub-step if they prefer to defer it.
- **Logo Pack "Square · high resolution" badge** now shows for any image once
  dimensions are real (it only checks `width > 0 && height > 0`). This is a
  known cosmetic deferral to Phase 3's real square validation; the Logo Pack's
  `invalid` branch also currently assumes "not square" for any invalid status,
  which Phase 3 must disambiguate (unsupported format vs. non-square).
- **Command `Err` handling in the frontend is new.** `BatchWorkspace` currently
  has no error branch; Task 8 adds a minimal one. If the owner prefers the
  command to always return a `BatchResult` (folding `OUTPUT_UNAVAILABLE` into
  per-file errors), that is a simpler frontend and should be confirmed before
  Task 6.
- **Crate selection is a durable decision** (Decision 1/2). Once validated,
  record the `image` + `image-webp` + `libwebp-sys2` choice in
  `ARCHITECTURE.md` §17 so Phase 3/4 don't re-litigate it.
- **Concurrency cap (4)** and resample filter (`Lanczos3`) are starting points;
  Phase 4 profiles and tunes them.
