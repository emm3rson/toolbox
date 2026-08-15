# Phase 3 — Image Compressor + Web Logo Pack

**Status: PLANNED** — implementation belongs to a separate dev-coordinator
session. See `docs/DEVELOPMENT_PHASES.md` for the phase definition.

## Objective

Deliver the two remaining tools end-to-end on top of the Phase 2 image core,
so that no mock adapters remain:

- **Image Compressor** — `compressImages` becomes a real command that preserves
  the source format, re-encodes at the requested quality, optionally resizes,
  and names outputs `photo.jpg → photo-compressed.jpg`. The completion summary
  shows actual before/after sizes and savings.
- **Web Logo Pack** — `generateLogoPack` becomes a real command that validates
  a square, high-resolution source, generates the Standard Web Pack assets
  (favicon.ico multi-res, PNG sizes, apple-touch-icon), writes the selected
  assets to a `web-pack` folder, and returns a per-asset result. Preset
  definitions are owned centrally in Rust.

Phase 2 already delivered the reusable primitives these tools compose: decode
(PNG/JPEG via `image`, WebP via `image-webp`), lossy WebP encode via
`libwebp-sys2`, resize math, the export/collision service, bounded-concurrency
batch with progress events, and structured errors. No new crates are required
(`image`'s `ico` feature is already enabled in `Cargo.toml`).

## Current state

Relevant as-built facts (Phase 2 closed, owner smoke-tested):

- **Rust** (`src-tauri/src/`):
  - `models.rs` has `ConvertImagesRequest`, `ImageFormat` (`png`/`jpeg`/`webp`
    + `.jpg` extension rule), `ResizeOptions`, `FileResult`, `BatchResult`,
    `ProcessingProgress`, `InputFile`. There is **no** `CompressImagesRequest`,
    `GenerateLogoPackRequest`, or logo preset model yet.
  - `errors.rs` has the ten `ProcessingError` variants and
    `ProcessingErrorDto`; all codes the new tools need already exist (no new
    codes required).
  - `services/export.rs` has `ensure_output_dir` (fails when the dir is missing)
    and `resolve_output_path(output_dir, source, ext)` with auto-rename and the
    source-path-equality non-destructive guard. No suffix support and no
    create-if-missing helper yet.
  - `services/batch.rs` `run_batch(app, job_id, files, process)` processes a
    `&[PathBuf]` in parallel (rayon, `min(available_parallelism, 4)` threads),
    emits `processing-progress` after each file, and returns `BatchResult`.
    It is keyed to source paths, so it does not directly fit the Logo Pack's
    "one source → N assets" shape.
  - `tools/image/convert.rs` holds a **private** `decode` (WebP via
    `image_webp::WebPDecoder`, PNG/JPEG via `image::ImageReader`) and a private
    `encode`. `tools/image/resize.rs` exposes `target_size`/`apply` (both keyed
    on `ResizeOptions`) but no direct resize-to-dims primitive.
    `tools/image/webp.rs` has `encode_lossy`.
  - `commands.rs` has `inspect_files` and `convert_images` (async,
    `spawn_blocking` → `run_batch`). `lib.rs` registers those two commands.
- **Frontend** (`src/`):
  - `contracts.ts` declares `CompressImagesRequest { files, outputDirectory,
    quality, resize }` and `GenerateLogoPackRequest { sourcePath,
    outputDirectory, assets: string[] }` (filenames, not ids). No
    `LogoAssetDefinition` type and no `getLogoPresets` method on `TauriAdapter`.
  - `realAdapter.ts` implements `convertImages` (jobId + `listen` +
    `invoke('convert_images')`) but delegates `compressImages` and
    `generateLogoPack` to `mockProcessing` from `mockAdapter.ts`.
  - `mockAdapter.ts` exports only `mockProcessing` (`compressImages`,
    `generateLogoPack`). Once both are real, this file is dead and should be
    deleted.
  - `BatchWorkspace.tsx` already handles the compress mode fully: it builds a
    `CompressImagesRequest` (`quality` from the slider, `resize`), calls
    `desktop.compressImages` inside the same try/catch as convert, excludes
    `status === 'invalid'` files, and renders `BeforeAfter` (before/after +
    "% smaller") in the compress completion. The compress UI therefore needs
    only the adapter swap; no structural frontend work for compression.
  - `web-logo-pack/index.tsx` hardcodes `initialAssets` (filename + display
    size) and the integration snippet; `load()` marks a source `invalid` only
    when `inspectFiles` returns `status === 'invalid'`, and shows a single
    "Source must be square" error regardless of the real cause; the
    "Square · high resolution" badge currently renders for any image with
    `width > 0 && height > 0` (Phase 2 cosmetic deferral). `generate()` calls
    `desktop.generateLogoPack` with `assets: selected.map(a => a.file)` and has
    **no** try/catch (unhandled-rejection risk, same gap Phase 2 closed for the
    converter). `packPath` is computed as `` `${exportPath}\web-pack` ``.
  - `Completion.tsx` `BeforeAfter` computes `saved = round((1 - after/before) *
    100)`; it does not handle `after >= before` (would render a negative
    "% smaller").

## Decisions and constraints

1. **No new crates.** Reuse `image` 0.25 (`png`/`jpeg`/`ico` features),
   `image-webp` 0.2, `libwebp-sys2` 0.2, `rayon`, `thiserror`. `Cargo.toml` is
   unchanged.
2. **Compressor preserves the source format.** Decode → optional resize →
   re-encode in the *same* format → `stem-compressed.ext`. Output extension
   follows the existing `ImageFormat::extension()` rule, so `.jpeg`/`.jpg`
   both normalize to `.jpg` (consistent with the converter).
3. **Quality is a no-op for PNG (lossless).** JPEG uses
   `JpegEncoder::new_with_quality(quality)`; WebP uses `webp::encode_lossy`;
   PNG uses the lossless `write_to(Png)` path with quality ignored. The
   compressor quality slider still renders for all files (a batch may mix
   formats); a one-line muted note is added to the compress panel clarifying
   that PNG stays lossless. (Confirm-with-owner in Risks.)
4. **Naming lives in the export service.** Extend `resolve_output_path` to take
   an optional filename suffix (e.g. `Some("-compressed")`) rather than adding
   a parallel implementation, so collision auto-rename and the non-destructive
   guard stay centralized. The converter keeps passing `None`.
5. **Logo Pack presets are owned centrally in Rust** (ARCHITECTURE §18,
   DEVELOPMENT_PHASES Phase 3). A new `tools/image/logo_pack.rs` defines the
   Standard Web Pack as a `const` slice of `LogoAssetDefinition`, and a new
   `get_logo_presets` command returns them so the frontend renders the checkbox
   list from the single source of truth. The request changes from
   `assets: string[]` (filenames) to `assetIds: string[]`.
6. **Standard Web Pack** (matches the current frontend `initialAssets`):
   | id | filename | format | size | default |
   |---|---|---|---|---|
   | `favicon-ico` | `favicon.ico` | ico | multi-res (16/32/48) | on |
   | `favicon-16` | `favicon-16x16.png` | png | 16 × 16 | on |
   | `favicon-32` | `favicon-32x32.png` | png | 32 × 32 | on |
   | `apple-touch` | `apple-touch-icon.png` | png | 180 × 180 | on |
   | `icon-192` | `icon-192.png` | png | 192 × 192 | on |
   | `icon-512` | `icon-512.png` | png | 512 × 512 | on |
   The `favicon.ico` ICO packs 16/32/48 into one file. (Confirm-with-owner in
   Risks: exact ICO internal sizes.)
7. **Logo Pack result reuses `BatchResult`** (one `FileResult` per generated
   asset, `sourcePath` = the asset filename), so the existing `Completion` UI
   ("N assets generated", failures list, open-folder, copy snippet) is reused
   unchanged. The integration snippet stays a frontend constant (it is
   presentation of the standard pack, not a generation rule); no new result DTO
   field is added. (Confirm-with-owner in Risks.)
8. **Logo Pack output directory.** The frontend keeps passing
   `outputDirectory = <exportPath>\web-pack` (so `packPath` and "Open folder"
   are unchanged). Rust validates the *parent* with `ensure_output_dir` and
   creates the pack folder with a new `create_output_dir` (`create_dir_all`)
   helper in the export service. The `web-pack` folder name remains a frontend
   concern.
9. **Logo Pack overwrite semantics.** Generated assets are written to the
   dedicated `web-pack` folder and overwrite any prior run's outputs there
   (deterministic regeneration; filenames stay canonical per PRD §10). The
   non-destructive guarantee (§20) protects *source* files only, and the source
   lives outside the pack folder. No auto-rename inside the pack folder.
   (Confirm-with-owner in Risks.)
10. **Square + resolution validation is duplicated deliberately.** The frontend
    validates early from real `inspectFiles` dimensions (specific message:
    unsupported vs non-square vs too-small, USER_FLOWS §15) for immediate
    feedback; Rust re-validates in `generate_logo_pack` (frontend input is
    untrusted, ARCHITECTURE §25) and returns `INVALID_IMAGE`/`INVALID_DIMENSIONS`
    via a failed `FileResult` or command `Err` if violated. Minimum resolution:
    `width == height && width >= 512`.
11. **Logo Pack progress is emitted sequentially**, not via `run_batch`. The
    source is decoded once, then each selected asset is resized/encoded/encoded
    in a loop that emits `processing-progress` (`EVENT_PROGRESS` const) with
    `completed`/`total` over the asset count. `run_batch` stays parallel over
    source paths and is not generalized in this phase (the Logo Pack is a
    single-source, ~6-asset, I/O-light job where parallelism adds no value).
12. **Progress correlation for both commands mirrors Phase 2.** `compress_images`
    and `generate_logo_pack` are async commands that `spawn_blocking` the CPU
    work; the frontend adapter injects `jobId` and filters `processing-progress`
    by it. `CompressImagesRequest` and `GenerateLogoPackRequest` both gain a
    `job_id` field (adapter-internal, like convert).
13. **Local-first / non-destructive / no network hold.** `Path`/`PathBuf`
    everywhere, no hard-coded separators, frontend input treated as untrusted
    at the command boundary (ARCHITECTURE §27, §25).
14. **Tool-preference persistence is out of scope for this phase**
    (`tool.imageCompressor.quality`, `tool.webLogoPack.selectedAssets` from
    ARCHITECTURE §21). The compressor/Logo Pack defaults stay in component
    state as today. Defer to Phase 4 polish. This keeps Phase 3 focused on
    making both tools real.
15. **The compressor UI needs no structural change.** `BatchWorkspace` already
    drives compress through the shared try/catch + progress + `BeforeAfter`
    flow; only the adapter swap and a minor `BeforeAfter` negative-savings guard
    are required (see Tasks 7–8).

## Implementation tasks

The Rust work is cohesive and touches shared wiring files (`lib.rs`,
`commands.rs`, `models.rs`, `services/export.rs`, `tools/image/mod.rs`), so it
should be implemented in order (Tasks 0 → 5). The three frontend tasks
(6 → 8) depend on the backend and can run in parallel with each other
afterwards. Task 6 owns the adapter/contracts; Task 7 owns
`BatchWorkspace.tsx` + `Completion.tsx`; Task 8 owns
`web-logo-pack/index.tsx` — non-overlapping writable areas.

### Task 0: Request/result DTOs for compress and logo pack

- Goal: Add the serializable types the new commands and processors compile
  against, matching `contracts.ts` exactly (after Task 6's contract update).
- Relevant files:
  - `src-tauri/src/models.rs`
- Implementation guidance:
  - `#[derive(Deserialize)] #[serde(rename_all = "camelCase")]`:
    - `CompressImagesRequest { files: Vec<String>, output_directory: String,
      quality: u8, resize: ResizeOptions, job_id: String }`
    - `GenerateLogoPackRequest { source_path: String, output_directory:
      String, asset_ids: Vec<String>, job_id: String }`
  - `#[derive(Serialize)] #[serde(rename_all = "camelCase")]`:
    - `LogoAssetDefinition { id: String, filename: String, width: u32,
      height: u32, format: String, default_enabled: bool }` where `format` is
      `"png" | "ico"` and `width`/`height` are `0` for the multi-res ICO.
- Dependencies: None.
- Acceptance criteria: `cargo check` compiles; a sample `contracts.ts`-shaped
  JSON deserializes into `CompressImagesRequest`/`GenerateLogoPackRequest`.

### Task 1: Export service — suffix naming + create-directory helper

- Goal: Centralize the `-compressed` suffix naming and the pack-folder creation,
  preserving the existing collision/non-destructive behavior.
- Relevant files:
  - `src-tauri/src/services/export.rs`
- Implementation guidance:
  - Change `resolve_output_path` signature to
    `resolve_output_path(output_dir, source_path, ext, suffix: Option<&str>)`:
    base name becomes `{stem}{suffix}.{ext}` (e.g. `photo-compressed.jpg`);
    `None` preserves the converter's `photo.webp` behavior. Update the existing
    unit tests' call sites.
  - Add `pub fn create_output_dir(dir: &Path) -> Result<(), ProcessingError>`
    using `std::fs::create_dir_all`, mapping `PermissionDenied` /
    `OutputUnavailable` (reuse the io-kind pattern from `convert.rs`).
  - Add a unit test for the `-compressed` suffix naming + collision
    (`photo-compressed.jpg → photo-compressed-2.jpg`) and one asserting
    `create_output_dir` creates a missing nested path.
- Dependencies: Task 0.
- Acceptance criteria: `cargo test` passes the export tests; the converter's
  existing naming is unchanged (`suffix: None`).

### Task 2: Shared image primitives — decode, format detect, direct resize

- Goal: Extract the decode logic so convert/compress/logo-pack share it, and
  expose a direct resize-to-dimensions primitive for the Logo Pack.
- Relevant files:
  - `src-tauri/src/tools/image/decode.rs` (new)
  - `src-tauri/src/tools/image/mod.rs` (`pub mod decode;`)
  - `src-tauri/src/tools/image/resize.rs` (add `resize(img, (w, h))`)
  - `src-tauri/src/tools/image/convert.rs` (use the shared `decode`)
- Implementation guidance:
  - `decode.rs`: move `convert.rs::decode` here as `pub fn decode(source: &Path)
    -> Result<DynamicImage, ProcessingError>` (unchanged logic: `WebP` →
    `image_webp::WebPDecoder`, `Png`/`Jpeg` → `reader.decode()`, else
    `UnsupportedFormat`). Add `pub fn detect_format(source: &Path) ->
    Result<ImageFormat, ProcessingError>` using `ImageReader::open` +
    `with_guessed_format` + `.format()`, mapping `image::ImageFormat::{Png,
    Jpeg, WebP}` to the model `ImageFormat` and anything else to
    `UnsupportedFormat`.
  - `resize.rs`: add `pub fn resize(img: &DynamicImage, (w, h): (u32, u32)) ->
    DynamicImage` (the `imageops::resize` + `Lanczos3` call); refactor `apply`
    to call it.
  - `convert.rs`: delete the private `decode` and `use super::decode::decode;`
    (keep `encode` local to convert for now).
- Dependencies: Task 0.
- Acceptance criteria: `cargo test` (convert tests still pass via the shared
  decode); `cargo build` compiles.

### Task 3: Compress processor (decode → resize → re-encode same format)

- Goal: The per-file pipeline for `run_batch` in compress mode.
- Relevant files:
  - `src-tauri/src/tools/image/compress.rs` (new)
  - `src-tauri/src/tools/image/mod.rs` (`pub mod compress;`)
- Implementation guidance:
  - `pub fn compress_file(source: &Path, output_dir: &Path, quality: u8,
    resize_opts: &ResizeOptions) -> FileResult`, mirroring `convert_file`'s
    success/failure `FileResult` shape and never panicking:
    - `original_size = fs::metadata(source).len()` with the same
      permission/not-found mapping as convert.
    - `let format = decode::detect_format(source)?; let img =
      decode::decode(source)?; let img = resize::apply(&img, resize_opts)?;`
    - Encode in the detected format: `Png` → `write_to(Png)` (quality ignored),
      `Jpeg` → `JpegEncoder::new_with_quality(quality)`, `Webp` →
      `webp::encode_lossy(quality)`.
    - `resolve_output_path(output_dir, source, format.extension(),
      Some("-compressed"))`, then `fs::write` with the same error mapping as
      convert.
  - Add a fixture unit test: PNG → `photo-compressed.png` (round-trips size),
    JPEG → `photo-compressed.jpg` with a smaller output size at low quality.
- Dependencies: Tasks 1, 2.
- Acceptance criteria: `cargo test` passes; a fixture compress writes
  `stem-compressed.ext` and reports `success: true` with plausible sizes.

### Task 4: Logo Pack preset definitions + processor (ICO generation)

- Goal: Own the Standard Web Pack in Rust and generate the selected assets from
  a decoded source, including the multi-res ICO.
- Relevant files:
  - `src-tauri/src/tools/image/logo_pack.rs` (new)
  - `src-tauri/src/tools/image/mod.rs` (`pub mod logo_pack;`)
- Implementation guidance:
  - Define `pub const STANDARD_WEB_PACK: &[LogoAssetDefinition] = &[...]` per
    Decision 6, and `pub fn preset_by_id(id: &str) -> Option<&LogoAssetDefinition>`.
  - `pub fn generate(source_path: &Path, output_dir: &Path, asset_ids: &[String],
    app: &tauri::AppHandle, job_id: &str) -> Result<BatchResult, ProcessingError>`:
    - `ensure_output_dir(output_dir.parent())?` (parent must exist);
      `create_output_dir(output_dir)?`.
    - Validate the source: `detect_format` (unsupported → `UnsupportedFormat`),
      `decode`, then `if w != h || w < 512` → `InvalidDimensions` ("Source must
      be square and at least 512 × 512"). Return this as a command `Err` (not a
      per-asset failure) so the frontend can show it as a top-level error.
    - For each selected `asset_id` (preserving the `asset_ids` order), decode
      once then per asset: `resize::resize(&img, (w, h))` for PNG targets, or
      for `favicon-ico` resize to 16/32/48 and write a multi-size ICO.
    - ICO encoding: use `image::codecs::ico::IcoEncoder::new(&mut buf)`, call
      `encode_image(&rgba_bytes, w, h, ColorType::Rgba8)` for each size, then
      `finish()`. **Verify the exact `IcoEncoder` API against the installed
      `image` 0.25** (like Phase 2 verified libwebp signatures). Map failures to
      `EncodeFailed`.
    - Write each asset to `output_dir.join(filename)`; `FileResult { source_path:
      filename, output_path: Some(path), success: true, original_size: 0 (or the
      source size), output_size: Some(bytes.len()), error: None }`. A per-asset
      encode/write failure becomes a failed `FileResult` (batch continues).
    - Emit `app.emit(EVENT_PROGRESS, ProcessingProgress { job_id, completed,
      total, current_file: Some(filename) })` after each asset (import the
      `EVENT_PROGRESS` const from `services::batch`).
    - Assemble `BatchResult { total, succeeded, failed, items }`.
- Dependencies: Tasks 1, 2.
- Acceptance criteria: `cargo test` passes a fixture generating the full pack
  from a 512×512 PNG and asserts the expected filenames exist and the ICO file
  begins with the ICO header; a non-square source returns `InvalidDimensions`.

### Task 5: Commands + registration (compress_images, generate_logo_pack, get_logo_presets)

- Goal: Wire the three commands and register them.
- Relevant files:
  - `src-tauri/src/commands.rs`
  - `src-tauri/src/lib.rs`
- Implementation guidance:
  - `#[tauri::command] pub async fn compress_images(app: tauri::AppHandle,
    request: CompressImagesRequest) -> Result<BatchResult, ProcessingErrorDto>`:
    mirror `convert_images` — `ensure_output_dir`, capture `app`/paths/quality/
    resize, `spawn_blocking` → `run_batch(&app, job_id, &paths, |src|
    tools::image::compress::compress_file(src, &out_dir, quality, &resize))`,
    double `map_err` as in convert.
  - `#[tauri::command] pub async fn generate_logo_pack(app: tauri::AppHandle,
    request: GenerateLogoPackRequest) -> Result<BatchResult, ProcessingErrorDto>`:
    capture `app`/source/output/assets/job_id, `spawn_blocking` →
    `tools::image::logo_pack::generate(&src, &out_dir, &asset_ids, &app,
    &job_id)`, double `map_err`.
  - `#[tauri::command] pub fn get_logo_presets() -> Vec<LogoAssetDefinition>` →
    `tools::image::logo_pack::STANDARD_WEB_PACK.to_vec()`.
  - Register all three in `lib.rs` `generate_handler!` (add `commands::compress_images`,
    `commands::generate_logo_pack`, `commands::get_logo_presets`). JS invokes
    `compress_images`/`generate_logo_pack` with a single `request` argument and
    `get_logo_presets` with no arguments.
- Dependencies: Tasks 3, 4.
- Acceptance criteria: `cargo build` compiles; a fixture/manual call returns a
  real `BatchResult` (or `OUTPUT_UNAVAILABLE`/`INVALID_DIMENSIONS` for bad
  destinations/sources); `get_logo_presets` returns the six preset definitions.

### Task 6: Real compressImages/generateLogoPack + getLogoPresets in the adapter

- Goal: Point `desktop` at the real commands and expose the presets, removing
  the last mock processing.
- Relevant files (owned exclusively by this task):
  - `src/services/tauri/contracts.ts`
  - `src/services/tauri/realAdapter.ts`
  - `src/services/tauri/mockAdapter.ts` (delete)
  - `src/services/tauri/index.ts` (unchanged re-export; verify only)
- Implementation guidance:
  - `contracts.ts`: add `export interface LogoAssetDefinition { id: string;
    filename: string; width: number; height: number; format: 'png' | 'ico';
    defaultEnabled: boolean }`; change `GenerateLogoPackRequest.assets` to
    `assetIds: string[]`; add `getLogoPresets(): Promise<LogoAssetDefinition[]>
    ` to `TauriAdapter`.
  - `realAdapter.ts`: implement `compressImages` and `generateLogoPack` exactly
    like `convertImages` (generate `jobId`, `listen` on `PROCESSING_EVENT`,
    filter by `jobId`, `invoke('compress_images' | 'generate_logo_pack', {
    request: { ...request, jobId } })`, `finally` unlisten). Implement
    `getLogoPresets()` as `invoke<LogoAssetDefinition[]>('get_logo_presets')`.
    Remove the `mockProcessing` import.
  - Delete `src/services/tauri/mockAdapter.ts` (now dead). If a browser-dev
    fallback is still desired for `npm run dev`, keep it as an explicit,
    isolated fallback behind the adapter rather than silently mixing mocks —
    coordinator's call; do not leave a dead import.
- Dependencies: Task 5.
- Acceptance criteria: `npm run build` passes; `desktop.compressImages`/
  `generateLogoPack` invoke the real commands and forward progress;
  `getLogoPresets` returns the six definitions.

### Task 7: Compress completion guard (negative savings) + PNG note

- Goal: Make the compressor's completion summary correct when a re-encode is
  not smaller than the source, and clarify PNG's lossless behavior.
- Relevant files (owned exclusively by this task):
  - `src/components/processing/Completion.tsx`
  - `src/tools/batch-workspace/BatchWorkspace.tsx`
- Implementation guidance:
  - `BeforeAfter`: when `before <= 0 || after >= before`, render "No size
    reduction" (muted) instead of the negative "% smaller" pill (guard
    `saved <= 0`).
  - `BatchWorkspace.tsx` compress panel: add a one-line muted note under the
    quality slider ("PNG is lossless — quality applies to JPG and WebP") per
    Decision 3, using the existing `text-muted-foreground`/`text-[12px]` tokens.
  - No other compressor changes (try/catch, invalid-file exclusion, progress,
    `BeforeAfter` wiring already exist from Phase 2).
- Dependencies: Task 6.
- Acceptance criteria: `npm run build` passes; compressing to a larger output
  shows a neutral summary; the PNG note renders in compress mode.

### Task 8: WebLogoPack — real presets, real validation, real generate + errors

- Goal: Read presets from Rust, validate square + resolution specifically, send
  asset ids, surface command errors, and make the "Square · high resolution"
  badge real.
- Relevant files (owned exclusively by this task):
  - `src/tools/web-logo-pack/index.tsx`
- Implementation guidance:
  - Add `presets` state seeded empty; `useEffect` calls
    `desktop.getLogoPresets()` and derives `assets` as
    `{ id, filename, sizeLabel: format === 'ico' ? 'multi-res' : `${width} ×
    ${height}`, on: defaultEnabled }`. Keep a local `initialAssets` fallback for
    the plain-browser case where `getLogoPresets` throws (wrap in try/catch).
  - Replace the hardcoded `initialAssets` usage with the derived list
    (checkboxes keyed by `id`, labels from `filename`/`sizeLabel`).
  - In `load()`, after `inspectFiles`, compute a specific `sourceError`:
    `status === 'invalid'` → "This file isn't a supported image"
    (`file.error` if present); `width !== height` → "This image is W × H. Use
    a square source."; `width < 512` → "Use a source at least 512 × 512.";
    else `undefined` + phase `valid`. Drive the `invalid` phase message from
    `sourceError` (no longer a hardcoded "must be square").
  - `generate()`: send `assetIds: selected.map(a => a.id)`; wrap the await in
    try/catch and show a dismissible inline error (reuse the `error` string +
    existing danger banner pattern) on failure, returning to `valid` instead of
    an unhandled rejection.
  - Badge: render "Square · high resolution" only when
    `source.width > 0 && source.width === source.height && source.width >= 512`.
  - Keep `packPath`, the snippet, "Copy snippet", and "Open folder" unchanged.
- Dependencies: Tasks 6, 7.
- Acceptance criteria: `npm run build` passes; the asset list renders from
  `getLogoPresets`; a non-square or too-small source shows the specific message;
  selecting/deselecting assets toggles ids; a failed generate shows an inline
  error; the badge only shows for genuinely square ≥ 512 sources.

## Validation

- Frontend/browser check: `npm run build` (`tsc` + `vite build`) must pass.
- Native checks (reported separately per AGENTS.md):
  - `cargo check` / `cargo build` in `src-tauri` must compile.
  - `cargo test` in `src-tauri` runs the existing 14 tests plus the new export
    suffix, compress, and logo-pack tests.
- No automated frontend test framework is present yet (Phase 4), so frontend
  verification is build + owner smoke test.

Owner smoke-test checklist (UI changes — not to be claimed as performed by the
implementer without actually running it):

1. `npm run tauri dev` → Compress Images → drop a JPEG, PNG, and lossy WebP →
   export → `photo-compressed.jpg` etc. appear, PNG unchanged size (lossless),
   JPG/WebP smaller at low quality.
2. Set quality high (e.g. 90) on an already-small JPEG → summary shows "No size
   reduction" instead of a negative percentage.
3. Re-export the same compress batch → `photo-compressed-2.jpg` auto-rename.
4. Compress with a percentage resize → output dimensions match.
5. Web Logo Pack → pick a 512×512 square PNG → asset list shows the six presets
   with real labels → generate → `web-pack` folder contains `favicon.ico`,
   `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`,
   `icon-192.png`, `icon-512.png`; ICO opens as a multi-size favicon.
6. Pick a non-square image → specific "W × H, use square" message; pick a small
   square (e.g. 256) → "at least 512 × 512" message.
7. Toggle off `icon-192`/`icon-512` → those files are not generated.
8. Delete the export directory after choosing it, then generate → inline error
   (no crash).
9. Confirm the "Square · high resolution" badge only appears for valid sources.

## Risks and open questions

- **PNG "compression" is lossless and quality-inert.** The `image` crate's
  default PNG encoder may not shrink PNGs (re-encode with default compression).
  Decision 3 keeps the slider always visible with a clarifying note. If the
  owner wants meaningful PNG size reduction, that requires a different codec
  (e.g. `oxipng`) — out of scope for V1; confirm Decision 3 is acceptable.
- **Negative savings are common** when re-encoding lossy formats at high
  quality (generation loss can grow the file). Task 7 guards the summary
  display; the underlying "re-encode at quality" model is the PRD's stated V1
  behavior (no target-size search, no estimate).
- **`IcoEncoder` API must be verified** against `image` 0.25 during Task 4
  (multi-size `encode_image` + `finish`; `ColorType::Rgba8` support). Phase 2
  hit analogous crate-API surprises (libwebp lib name, `image-webp` decoder
  shape); budget for the same here.
- **Logo Pack return type** is kept as `BatchResult` (Decision 7) to reuse the
  completion UI, deferring a richer "integration metadata" result DTO. If the
  owner wants the snippet/asset list returned by Rust instead of a frontend
  constant, that is a small follow-up; confirm Decision 7.
- **Logo Pack overwrite vs rename** (Decision 9): overwriting prior outputs in
  the dedicated `web-pack` folder keeps filenames canonical. If the owner
  prefers the "always auto-rename" shared rule to apply here too, switch the
  pack write path to `resolve_output_path` (which would produce
  `favicon-2.ico` etc.). Confirm Decision 9.
- **ICO internal sizes** (16/32/48) are a chosen default. Confirm with the
  owner or adjust `STANDARD_WEB_PACK` (the preset is centralized, so this is a
  one-line change).
- **`get_logo_presets` in plain-browser dev** will fail (no Tauri runtime).
  Task 8 keeps a local fallback default so `npm run dev` still renders; if the
  owner prefers dropping browser-dev support for the Logo Pack, the fallback
  can be omitted.
- **`web-pack` folder name** remains a frontend literal while asset definitions
  move to Rust. Acceptable split (folder naming is UX, not a generation rule),
  but note it if the owner wants the pack path fully Rust-owned later.
- **Tool-preference persistence** (ARCHITECTURE §21) is explicitly deferred
  (Decision 14); the compressor quality and Logo Pack selection reset on remount
  today. Flag if the owner considers this a Phase 3 requirement.
- **Sequential Logo Pack generation** (Decision 11) is intentionally not
  parallel; the job is tiny. If profiling in Phase 4 shows otherwise, the loop
  can move to `par_iter` over assets.
