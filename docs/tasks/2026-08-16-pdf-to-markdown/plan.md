# PDF to Markdown

## Objective

Add a fourth Toolbox utility that converts one or more local PDFs into Markdown
files without uploading content or calling an AI/OCR service. Native-text pages
must be extracted locally with `pdf-inspector`; mixed PDFs must produce an
honest partial Markdown file with explicit markers for pages that require OCR;
fully scanned/image-only PDFs must fail clearly without creating a misleading
empty output.

The user flow is: choose **PDF to Markdown** → add PDFs → choose the shared
export location → convert → review complete, partial, and failed results → open
the export folder.

## Current state

- Toolbox v0.1.1 is a shipped local-first Windows app with three image tools.
  The current baseline passes `npm run test` (8 tests), `npm run build`,
  `cargo test` (41 passed, 1 ignored), and `cargo check --release`.
- Frontend tools export a static `ToolDefinition` from `src/tools/<name>/` and
  are registered in `src/tools/registry.ts`; `ToolId` is closed in
  `src/tools/types.ts`.
- React owns intake, progress, completion, and interaction state. Typed calls
  and progress events pass through `src/services/tauri/contracts.ts` and
  `src/services/tauri/realAdapter.ts` to commands in
  `src-tauri/src/commands.rs`.
- Rust owns file validation, processing, output naming/writing, and batch
  isolation. Existing shared seams are `services/inspect.rs`,
  `services/export.rs`, `services/batch.rs`, `models.rs`, and `errors.rs`.
- `InputFile` can represent a non-image with zero width/height, but current
  inspection, picker filters, queue copy, and icon fallback are image-specific.
- The earlier implementation in `C:\Projects\agents` uses
  `@firecrawl/pdf-inspector` 1.11.2 behind a Node adapter plus PDF.js, canvas,
  selective OCR, AI tool/context, and artifact contracts. Its page ordering,
  partial-marker, filename, and validation tests are useful references, but its
  web/server/OCR stack must not be copied into Toolbox.
- Upstream was checked on 2026-08-16. The current unified release is
  `pdf-inspector` 1.14.2 (MIT), including a first-class Rust crate with
  path/memory APIs, per-page Markdown, zero-indexed `PageMarkdown.page`,
  `needs_ocr`, OCR reasons, and resource-hardening fixes. Relevant upstream
  references:
  - <https://github.com/firecrawl/pdf-inspector/tree/v1.14.2>
  - <https://github.com/firecrawl/pdf-inspector/blob/v1.14.2/docs/rust-api.md>
  - <https://github.com/firecrawl/pdf-inspector/releases/tag/v1.14.2>

## Decisions and constraints

- Integrate the Rust crate directly in the Tauri backend. Pin
  `pdf-inspector = "=1.14.2"` initially; do not add the Node, WASM, PDF.js,
  canvas, OCR, or AI stacks. Upgrades must be explicit because upstream is
  changing quickly.
- Keep all processing local and offline. No PDF bytes, extracted text,
  filenames, or diagnostics may leave the machine.
- Use the per-page path API (`extract_pages_markdown(path, None)`) behind a
  small Toolbox adapter. Convert the upstream zero-indexed page number to a
  one-indexed application page number once at that boundary.
- V1 supports batch intake and shallow folder drops for `.pdf` files. Process
  PDFs sequentially: the parser already uses native parallelism and outer
  concurrency would multiply peak memory for little user benefit.
- V1 has no conversion settings, Markdown preview/editor, page-range picker,
  password field, OCR fallback, AI cleanup, or persisted PDF preferences.
- Apply explicit guard constants before expensive work: 100 MiB maximum input
  size and 500 pages maximum per PDF. Keep the constants centralized and show
  the limits in the intake guidance/error copy. The parser still validates the
  signature and document structure.
- For each page with usable local Markdown, preserve its extracted content. For
  each page flagged `needs_ocr`, insert an ordered marker such as:

  ```markdown
  <!-- PDF page 4 requires OCR: scanned -->

  > Page 4 was not converted because OCR is not included in Toolbox yet.
  ```

  Map upstream machine reasons to stable, readable copy; do not expose raw
  parser details. Join every page in original order with a single blank
  section boundary.
- A PDF is partial when at least one page is exported and at least one page is
  marked as requiring OCR. It is a failure with `OCR_REQUIRED` when every page
  needs OCR or no usable Markdown can be produced; do not write an output in
  that case.
- Reject encrypted/password-protected PDFs in V1 with a specific stable error.
  Do not ask for or persist passwords.
- Successful and partial outputs use the sanitized original stem with `.md`
  and the existing collision policy (`report.md`, `report-2.md`, ...). Never
  modify the source PDF or overwrite an existing output. Resolve and write the
  output only after conversion has completed; clean up any temporary file if an
  atomic write/rename fails.
- Extend `FileResult` with an optional typed warning/notice collection rather
  than treating partial output as failure. A warning has a stable code,
  message, and optional one-indexed page list. Existing image result payloads
  remain wire-compatible by omitting empty warnings.
- Add stable PDF error codes: `INVALID_PDF`, `ENCRYPTED_PDF`, `OCR_REQUIRED`,
  and `LIMIT_EXCEEDED`. Preserve all existing error codes and their behavior.
- Native CID/CJK fallback maps are a packaging concern: in 1.14.2 the native
  crate looks for `external/bcmaps` under its compile-time manifest or
  `PDF_INSPECTOR_BCMAPS_DIR`, while only WASM embeds them. Bundle the upstream
  CMap resources and license as Tauri resources, resolve their installed path
  at startup, and configure the library before any conversion runs. Prove this
  in a packaged-build smoke test; do not rely on the developer Cargo registry
  existing on an end user's machine.
- Preserve the established launcher, workspace, completion, palette, and copy
  rules. UI copy must not use em dashes. The owner performs final visual
  acceptance.
- Implementation is plan-driven. Update active docs and add the required
  concise changelog entry only after the feature and validation succeed. Do not
  bump the app version or publish a release unless separately requested.

## Technical contracts & DTOs

### Rust models (`src-tauri/src/models.rs`)

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWarning {
  pub code: String,
  pub message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub pages: Option<Vec<u32>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileResult {
  pub source_path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub output_path: Option<String>,
  pub success: bool,
  pub original_size: u64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub output_size: Option<u64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<ProcessingErrorDto>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub warnings: Option<Vec<FileWarning>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertPdfsRequest {
  pub files: Vec<String>,
  pub output_directory: String,
  pub job_id: String,
}
```

### TypeScript contracts (`src/services/tauri/contracts.ts`)

```typescript
export type ProcessingErrorCode =
  | 'UNSUPPORTED_FORMAT' | 'INVALID_IMAGE' | 'INVALID_DIMENSIONS' | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED' | 'OUTPUT_UNAVAILABLE' | 'ENCODE_FAILED' | 'DECODE_FAILED'
  | 'WRITE_FAILED' | 'PROCESSING_FAILED'
  | 'INVALID_PDF' | 'ENCRYPTED_PDF' | 'OCR_REQUIRED' | 'LIMIT_EXCEEDED'

export interface FileWarning {
  code: string
  message: string
  pages?: number[]
}

export interface FileResult {
  sourcePath: string
  outputPath?: string
  success: boolean
  originalSize: number
  outputSize?: number
  error?: ProcessingError
  warnings?: FileWarning[]
}

export interface ConvertPdfsRequest {
  files: string[]
  outputDirectory: string
  jobId?: string
}

export interface TauriAdapter {
  // Existing image methods...
  inspectPdfs(paths: string[]): Promise<InputFile[]>
  convertPdfs(request: ConvertPdfsRequest, onProgress?: ProgressHandler): Promise<BatchResult>
  pickFiles(mode: 'batch' | 'logo' | 'pdf'): Promise<string[]>
}
```

## Implementation tasks

### Task 1: Prove and package the native parser dependency

- Goal: Establish a reproducible `pdf-inspector` 1.14.2 integration that works
  in both development and an installed/release-like Tauri build.
- Relevant files: `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`,
  `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, new bundled resource and
  third-party license paths (`resources/bcmaps/*`), small PDF fixtures.
- Implementation guidance:
  - Pin the exact crate version `pdf-inspector = "=1.14.2"` and record the upstream
    tag/commit in a third-party notice.
  - Bundle the required `external/bcmaps` data from the same v1.14.2 tag with
    its license in `src-tauri/resources/bcmaps/` and declare it in
    `tauri.conf.json` under `bundle.resources`.
  - Resolve the Tauri resource directory at startup and configure the library /
    environment variable before any conversion runs.
  - Add a minimal adapter smoke test for an ordinary text PDF and a CID/CJK PDF
    whose correct extraction depends on the bundled maps.
  - Measure and record the installer/binary size change; do not optimize it
    away unless it is materially problematic.
- Dependencies: None.
- Acceptance criteria:
  - The pinned crate compiles with the repository's Rust/MSVC toolchain.
  - Text and CID/CJK fixtures extract correctly without network access.
  - A packaged executable resolves bundled maps without depending on a Cargo
    checkout or registry path.

### Task 2: Implement deterministic PDF inspection and conversion core

- Goal: Validate PDFs, extract ordered page Markdown, write non-destructive
  complete/partial outputs, and return stable results.
- Relevant files: new `src-tauri/src/tools/pdf/mod.rs` and focused child
  modules, `src-tauri/src/tools/mod.rs`, `src-tauri/src/services/inspect.rs`,
  `src-tauri/src/services/export.rs`, `src-tauri/src/errors.rs`, fixtures and
  Rust tests.
- Implementation guidance:
  - Add shallow PDF inspection: reject missing paths, non-files, wrong
    extensions/signatures, zero-byte files, and files > 100 MiB with readable
    row feedback.
  - Keep all upstream types inside a narrow adapter. Normalize 0-indexed pages
    to 1-indexed application numbers, and map upstream reasons to stable text.
  - Merge page results in original order with single blank line boundaries.
    Preserve extracted text and insert the decided marker for every OCR-required
    page:
    ```markdown
    <!-- PDF page 4 requires OCR: scanned -->

    > Page 4 was not converted because OCR is not included in Toolbox yet.
    ```
  - Return a successful `FileResult` plus `FileWarning` for partial output.
    Return a stable error (`OCR_REQUIRED`, `ENCRYPTED_PDF`, `INVALID_PDF`,
    `LIMIT_EXCEEDED`) and no output file for fully OCR-required, encrypted,
    corrupt, oversized, or > 500 page documents.
  - Process multi-file batches sequentially with per-file failure isolation and
    one progress emission after each settled file.
- Dependencies: Task 1.
- Acceptance criteria:
  - Native-text, mixed, scanned/image-only, corrupt, encrypted, zero-byte,
    oversized, over-page-limit, table/multi-column, and CID/CJK fixtures have
    deterministic outcomes.
  - Mixed output preserves page order and contains one explicit marker for
    every unavailable page; fully scanned input creates no output.
  - Output naming, collision handling (`file.md`, `file-2.md`), temporary-file
    cleanup, and source preservation are covered by tests.
  - One bad PDF does not abort the remaining batch.

### Task 3: Add the typed Tauri command and frontend service contracts

- Goal: Expose PDF intake and conversion through the existing typed boundary
  without weakening image-tool contracts.
- Relevant files: `src-tauri/src/models.rs`, `src-tauri/src/commands.rs`,
  `src-tauri/src/lib.rs`, `src/services/tauri/contracts.ts`,
  `src/services/tauri/realAdapter.ts`, `src/services/tauri/index.ts`, and test
  mocks in `src/test/setup.tsx`.
- Implementation guidance:
  - Add PDF-specific picker filter (`pickFiles('pdf')`) and inspection method
    `inspectPdfs` / `inspect_pdfs`.
  - Define `ConvertPdfsRequest`, `FileWarning`, and `convertPdfs` / `convert_pdfs`
    command; reuse correlated progress events.
  - Extend shared result contracts additively so existing tools and tests keep
    their current behavior.
  - Register the new Tauri commands statically.
- Dependencies: Task 2 establishes the Rust-owned contracts.
- Acceptance criteria:
  - TypeScript and Rust DTO names, casing, warning codes, page numbering, and
    optional fields agree exactly.
  - PDF progress is correlated by job ID and command failures surface stable
    messages.
  - Existing convert/compress/logo adapter calls remain unchanged.

### Task 4: Build the PDF to Markdown tool UI

- Goal: Add a coherent fourth launcher tool with batch intake, progress,
  export location, and complete/partial/failure completion states.
- Relevant files: new `src/tools/pdf-to-markdown/index.tsx` and tests,
  `src/tools/types.ts`, `src/tools/registry.ts`,
  `src/components/workspace.tsx`, `src/components/processing/Completion.tsx`,
  `src/components/ui/icons.tsx`.
- Implementation guidance:
  - Register `ToolId` `pdf-markdown`, route `/pdf-markdown`, launcher name
    `PDF to Markdown`, and description `Convert local PDFs to Markdown text`.
  - Use a dedicated 2-column workspace layout:
    - Left column (`minmax(0, 1fr)`): `FileListHeader` with `Add more` and
      `Clear all`, scrollable queue of `FileRow` with PDF icon badge and size,
      idle/processing/done/failed statuses, and row removal.
    - Right sidebar (`340px`): Informational card explaining local extraction
      and OCR markers, `ExportLocation` selector card, and primary
      "Convert X files" button.
  - Extend `FileRow` / `workspace.tsx` to display a clean document icon for PDF
    items rather than attempting image thumbnails.
  - Extend `Completion.tsx` with warning card support (amber/notice surface)
    displaying partial files and the exact pages requiring OCR (e.g.
    `document.pdf: pages 4, 7 require OCR`).
  - Distinguish complete successes, partial files, and failures. `Open folder`
    and `Convert more` remain explicit user actions.
  - Do not add Markdown preview, editor, OCR controls, or AI wording.
- Dependencies: Task 3. UI component work and Task 2's fixture-heavy core can
  proceed independently only after the warning/result contract is frozen;
  otherwise keep the tasks sequential to avoid shared-contract churn.
- Acceptance criteria:
  - Empty, intake, invalid, processing, all-success, partial, all-failed, and
    mixed batch states are covered by frontend tests.
  - Partial output is visually clear with amber warning styling and is never
    counted or styled as a fully failed file.
  - The three existing tools retain their current queue and completion UI.

### Task 5: Integrate, validate, and document the feature

- Goal: Complete repository-wide regression checks, package validation, active
  documentation, and the owner handoff.
- Relevant files: `docs/PROJECT.md`, `docs/UI_RULES.md` only for durable new
  behavior, this task's future `report.md`, and `CHANGELOG.md` after successful
  completion.
- Implementation guidance:
  - Update PROJECT's product/capabilities/boundaries/current state, command and
    crate inventory, tests, and add-tool notes.
  - Update UI_RULES only for durable PDF queue and partial-warning behavior.
  - Add one task-grouped changelog entry using the repository format after all
    required checks pass. Keep commands and detailed logs in `report.md`, not
    the changelog.
  - Do not claim owner visual acceptance or clean-machine installed acceptance
    unless the owner performs and confirms it.
- Dependencies: Tasks 1-4.
- Acceptance criteria:
  - Automated and native package checks below pass.
  - The report distinguishes browser/frontend, native Rust, packaged runtime,
    and owner-only visual evidence.
  - Active docs match shipped behavior and no archived V1 plan is edited.

## Validation

- Rust fixtures/tests:
  - ordinary native-text PDF;
  - headings, lists, links, table, and multi-column reading order;
  - mixed PDF with known OCR-required pages and exact ordered markers;
  - fully scanned/image-only PDF with no output;
  - CID/CJK font PDF using bundled CMaps;
  - corrupt, truncated, zero-byte, wrong-signature, encrypted/password,
    oversized (> 100 MiB), and over-page-limit (> 500 pages) inputs;
  - duplicate output collision, write failure/cleanup, and multi-file partial
    failure isolation.
- Frontend tests for picker/drag-drop filtering, invalid rows, progress,
  complete/partial/failed completion, warning page lists, and reset/open-folder
  actions; rerun all existing image and logo tests.
- Required commands:
  - `npm run test`
  - `npm run build`
  - `cargo check`
  - `cargo test`
  - `cargo check --release`
  - `npm run tauri build`
- Packaged-runtime smoke (separate from unit checks): run text, mixed, scanned,
  and CID/CJK fixtures through the release executable; verify Markdown output,
  partial markers, no output for scanned input, bundled CMap resolution,
  non-destructive collision naming, and offline operation. Record installer
  size before/after.
- Owner visual checklist:
  1. Confirm the fourth launcher card fits the fixed three-column grid and the
     PDF workspace matches the established visual system in light/dark themes.
  2. Drop one PDF, several PDFs, and a folder; confirm PDF-only intake and queue
     clarity.
  3. Convert one text PDF and inspect the generated `.md` headings, lists,
     links, reading order, and filename.
  4. Convert one mixed PDF; confirm the warning names the exact unavailable
     pages and the file contains visible markers in the right order.
  5. Try a scanned and encrypted PDF; confirm clear failures and no empty
     output files.
  6. Confirm `Open folder` and `Convert more` behave correctly and none of the
     three existing tools regressed.

## Risks and open questions

- **Upstream churn:** 1.14.2 is recent and releases are frequent. Exact pinning,
  adapter isolation, fixtures, and an intentional upgrade process reduce this
  risk.
- **CMap packaging:** native resource lookup is not self-contained in the
  installed executable by default. Task 1 is a hard gate; do not continue to
  feature completion if the packaged CID/CJK smoke cannot resolve the bundled
  resources reliably.
- **Extraction is not semantic perfection:** complex visual layouts, charts,
  equations, vector text, and broken encodings can still require OCR or manual
  cleanup. The product must report partial scope honestly rather than promise
  lossless conversion.
- **Resource use:** the crate loads PDFs in memory and uses native parallelism.
  Sequential outer batching plus the 100 MiB/500-page guards bound the first
  release, but real large-document profiling may justify tuning later.
- **Fixture licensing:** prefer generated fixtures. If upstream fixtures or
  CMaps are copied, preserve their applicable licenses and attribution.
- No remaining product decision blocks implementation. OCR, password entry,
  page ranges, Markdown preview/editing, and parser upgrades are explicit
  follow-up scope, not hidden V1 requirements.
