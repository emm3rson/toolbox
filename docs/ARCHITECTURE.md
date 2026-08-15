# Desktop Utility Toolbox — Architecture

## 1. Purpose

This document defines the implementation architecture for the V1 desktop utility toolbox.

It is intended to:

- keep implementation modular and maintainable
- prevent image-specific decisions from becoming app-wide architecture
- establish clear frontend/native boundaries
- support Windows first without making future macOS support unnecessarily difficult
- make future utility categories, such as PDF processing, straightforward to add
- give coding agents enough structure to implement consistently without overengineering

This document is an implementation guide, not a requirement to abstract every repeated line of code.

---

## 2. Architecture Goals

1. **Local-first processing** — User files remain on-device. No backend or cloud service required.
2. **Fast utility workflows** — Processing should feel native and responsive. CPU-heavy work must not block the UI.
3. **Tool isolation** — Image conversion, compression, logo generation, and future tools should remain independently understandable.
4. **Shared infrastructure** — Tools reuse file input, export handling, progress, errors, settings, and common UI where genuinely shared.
5. **Practical extensibility** — Adding another utility should not require restructuring the app. No runtime plugin marketplace or generic plugin SDK in V1.
6. **Cross-platform discipline** — Windows is the V1 target. Avoid unnecessary Windows-only assumptions in domain logic so macOS remains practical later.

---

## 3. Recommended Stack

### Desktop Shell — Tauri 2

Responsibilities: application window and lifecycle, native OS integration, frontend-to-Rust command bridge, filesystem and dialog capabilities, opening output folders, packaging, optional future sidecar execution.

### Frontend — React + TypeScript + Vite

Responsibilities: app shell, tool launcher, tool workspaces, drag/drop interaction, user settings controls, processing state and progress display, result summaries, client-side form validation and presentation logic.

Next.js is intentionally unnecessary because the product has no server-rendering, routing, backend, or web deployment requirements.

### Native / Processing Layer — Rust

Responsibilities: file validation requiring filesystem access, image metadata inspection, image conversion, compression, resizing, favicon/logo asset generation, export naming and collision resolution, CPU-heavy processing, future native processing adapters.

Exact image-processing crates should be selected during implementation based on format support, quality, maintenance, and cross-platform behavior.

### Persistence

Lightweight local key-value persistence for settings. No application database for V1.

---

## 4. High-Level Architecture

```text
┌─────────────────────────────────────────────────────┐
│                 React + TypeScript                  │
│                                                     │
│  App Shell                                          │
│  ├── Tool Launcher                                  │
│  ├── Settings                                       │
│  └── Tool Workspaces                                │
│      ├── Image Converter                            │
│      ├── Image Compressor                           │
│      └── Web Logo Pack                              │
│                                                     │
│  Shared Frontend                                    │
│  ├── File Intake UI                                 │
│  ├── File List                                      │
│  ├── Export Controls                                │
│  ├── Progress / Results                             │
│  └── Tool State                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                  Tauri Commands
                 + Progress Events
                       │
┌──────────────────────▼──────────────────────────────┐
│                      Rust                           │
│                                                     │
│  Application Services                               │
│  ├── File Inspection                                │
│  ├── Export / Naming                                │
│  ├── Batch Execution                                │
│  └── Settings / OS Integration as needed            │
│                                                     │
│  Tool Processing                                    │
│  ├── Image                                          │
│  │   ├── Convert                                    │
│  │   ├── Compress                                   │
│  │   ├── Resize                                     │
│  │   └── Logo Pack                                  │
│  │                                                  │
│  └── Future                                         │
│      └── PDF / other processors                     │
└──────────────────────┬──────────────────────────────┘
                       │
           Native libraries / optional sidecars
```

---

## 5. Core Architectural Rule

**Tools share infrastructure, not domain logic.**

Shared infrastructure may include: file selection, drag/drop normalization, common file metadata, export destination handling, filename collision handling (always auto-rename), batch progress, error representation, settings persistence, standard workspace components.

Tool-specific logic stays inside its tool. Examples:

- Image Compressor owns compression quality behavior.
- Web Logo Pack owns favicon specifications and generated asset definitions.
- A future PDF Merge tool owns PDF page/document logic.
- Shared batch infrastructure should not know what an image quality setting means.

---

## 6. Repository Structure

Recommended starting structure:

```text
/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.ts
│   │   └── providers/
│   │
│   ├── components/
│   │   ├── files/
│   │   ├── processing/
│   │   ├── export/
│   │   └── ui/
│   │
│   ├── tools/
│   │   ├── image-converter/
│   │   │   ├── components/
│   │   │   ├── schema.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── image-compressor/
│   │   │   ├── components/
│   │   │   ├── schema.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   └── web-logo-pack/
│   │       ├── components/
│   │       ├── schema.ts
│   │       ├── presets.ts
│   │       ├── types.ts
│   │       └── index.ts
│   │
│   ├── services/
│   │   ├── tauri/
│   │   ├── files/
│   │   ├── settings/
│   │   └── export/
│   │
│   ├── stores/
│   ├── types/
│   └── utils/
│
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   ├── services/
│   │   │   ├── batch.rs
│   │   │   ├── files.rs
│   │   │   └── export.rs
│   │   │
│   │   ├── tools/
│   │   │   ├── image/
│   │   │   │   ├── convert.rs
│   │   │   │   ├── compress.rs
│   │   │   │   ├── resize.rs
│   │   │   │   └── logo_pack.rs
│   │   │   └── mod.rs
│   │   │
│   │   ├── models/
│   │   ├── errors.rs
│   │   ├── lib.rs
│   │   └── main.rs
│   │
│   ├── capabilities/
│   └── tauri.conf.json
│
└── ...
```

This is a directional structure. Do not create empty layers or files purely to match the tree. Add abstractions when they have a real responsibility.

---

## 7. Tool Module Model

V1 should use a **static tool registry**, not a runtime plugin system.

Each frontend tool module exposes enough metadata for the launcher and route resolution:

```ts
type ToolDefinition = {
  id: string
  name: string
  description?: string
  icon: React.ComponentType
  route: string
  component: React.ComponentType
}
```

Adding a future utility should generally require:

1. Create the frontend tool module.
2. Register it in the launcher.
3. Add native commands/processors if needed.
4. Define its validation/configuration/result types.

Avoid dynamic loading, manifests, installable plugins, or plugin discovery in V1.

---

## 8. Frontend Responsibilities

The frontend owns **interaction state**, not file-processing business logic.

Good frontend responsibilities: selected files displayed in the workspace, form/settings state, quality slider interaction, enabling/disabling primary actions, progress visualization, success and error presentation, launcher/navigation, theme selection.

Avoid implementing native file processing in React merely because a JavaScript package exists. For important processing rules, keep one authoritative implementation in the native processing layer.

---

## 9. Tauri Boundary

Use a thin typed wrapper around Tauri invocation rather than calling `invoke()` throughout UI components.

```text
React component → frontend tool service → typed Tauri adapter → Rust command → processor/service
```

Example frontend API:

```ts
inspectFiles(paths)
convertImages(request)
compressImages(request)
generateLogoPack(request)
```

Benefits: UI components stay testable, command names stay centralized, serialization details do not leak, future command changes are localized.

---

## 10. Command Design

Commands should represent meaningful operations rather than exposing low-level filesystem primitives.

Prefer: `convert_images(request)`, `compress_images(request)`, `generate_logo_pack(request)`, `inspect_files(paths)`.

Avoid: `read_file()`, `decode_png()`, `resize_buffer()`, `encode_webp()`, `write_file()`.

One user operation should usually map to one processing request.

---

## 11. Request / Result Contracts

Frontend-to-Rust requests should use explicit serializable DTOs.

Example conversion request:

```ts
type ConvertImagesRequest = {
  files: string[]
  outputDirectory: string
  outputFormat: "png" | "jpeg" | "webp"
  quality?: number
  resize?: ResizeOptions
}
```

Batch result:

```ts
type BatchResult = {
  total: number
  succeeded: number
  failed: number
  items: FileResult[]
}

type FileResult = {
  sourcePath: string
  outputPath?: string
  success: boolean
  originalSize: number
  outputSize?: number
  error?: ProcessingError
}
```

Keep contracts tool-specific when their result/configuration genuinely differs. Do not force every tool into one giant universal request object.

---

## 12. File Intake

Files can enter through drag and drop, native file picker, or folder picker.

Normalize all sources into the same internal file-entry representation before tool-specific validation:

```ts
type InputFile = {
  path: string
  name: string
  extension: string
  size?: number
  width?: number
  height?: number
  status: "validating" | "ready" | "invalid"
  error?: string
}
```

The frontend can hold presentation metadata, but authoritative format/dimension validation should come from actual file inspection rather than trusting file extensions.

---

## 13. Folder Input

Folder processing in V1 is deliberately shallow:

```text
selected folder → inspect direct children → filter supported files → do not recurse
```

The folder enumeration behavior should be implemented once as shared file infrastructure. Tools provide their supported file criteria.

---

## 14. Batch Processing

Batch execution belongs in the native layer.

Requirements: process files independently, one file failure must not terminate the batch, collect individual results, report aggregate progress, keep UI responsive, avoid unbounded parallelism.

```text
Frontend sends batch request → Native validates → Creates job → Files processed with bounded concurrency → Progress emitted → Individual failures captured → Batch result returned
```

Concurrency should be bounded based on CPU/memory behavior and tuned after profiling.

---

## 15. Progress Events

Long-running commands should report progress to the frontend:

```ts
type ProcessingProgress = {
  jobId: string
  completed: number
  total: number
  currentFile?: string
}
```

The final command result remains authoritative. Progress events are transient UI feedback and should not become persistent job records.

A job identifier avoids ambiguity if multiple operations are ever possible during one app session.

---

## 16. Processing Jobs

V1 does not need a persistent job queue.

Use an in-memory processing job concept only where useful for: progress correlation, preventing duplicate submission, future cancellation support, current operation state.

On app restart, processing history is discarded. Do not introduce Redis, SQLite, background workers, or durable queues.

---

## 17. Image Processing Architecture

Image functionality can share an internal image-processing foundation, but the user-facing tools remain separate:

```text
Image Processing
├── inspect
├── decode
├── resize
├── encode
├── convert
├── compress
└── favicon generation
```

### Image Converter

Coordinates: decode → optional resize → encode into selected format → export.

### Image Compressor

Coordinates: inspect/decode → optional resize → encode using requested quality → preserve output format → export.

### Web Logo Pack

Coordinates: validate square source → decode → resize into predefined targets → encode required formats → generate ICO → write selected assets to folder → return integration metadata.

Shared internal primitives are appropriate here because these three tools operate on the same image domain. Do not expose those primitives as app-wide tool abstractions.

Phase 2 selected the concrete crate set: `image` 0.25 (PNG/JPEG decode+encode, resize, ICO for the Logo Pack), `image-webp` 0.2 (pure-Rust WebP decode incl. lossy, lossless-only encode), and `libwebp-sys2` 0.2 (C FFI, vendored libwebp) used only for **lossy WebP encode** behind the isolated wrapper in `tools/image/webp.rs`. `image-webp` is required for WebP input because `image`'s built-in WebP decoder is lossless-only. `rayon` provides the bounded batch thread pool.

---

## 18. Web Logo Pack Presets

Logo asset specifications should live in one centralized native or shared configuration:

```ts
type LogoAssetDefinition = {
  id: string
  filename: string
  width: number
  height: number
  format: string
  defaultEnabled: boolean
}
```

The `Standard Web Pack` is the V1 preset. The UI reads the preset definitions and lets the user toggle assets.

Benefits: dimensions and filenames have one source of truth, future updates are easy, UI does not contain favicon-generation logic.

---

## 19. Export Service

Export behavior should be centralized.

Responsibilities: validate destination, construct output filenames, resolve conflicts (always auto-rename), create pack directories where needed, write final output, return actual output paths.

Collision rule: `photo.webp → photo-2.webp → photo-3.webp`.

Tools should request an output name, but they should not independently implement collision handling.

---

## 20. Non-Destructive Guarantee

V1 should never modify source files in place. Native processing should enforce this rule, not rely solely on frontend behavior.

```text
resolved output path == source path → reject or generate safe alternate output
```

This protects users even if a frontend bug sends an unsafe destination.

---

## 21. Settings Persistence

Use simple local key-value settings.

Expected V1 values:

```text
appearance
lastExportDirectory

tool.imageConverter.lastFormat
tool.imageConverter.quality
tool.imageConverter.resize

tool.imageCompressor.quality
tool.imageCompressor.resize

tool.webLogoPack.selectedAssets
```

Do not persist: processing history, source file lists, generated files, job records.

Settings access should go through one frontend settings service. A migration/version field is reasonable if settings shape changes later, but do not build a complex migration framework in V1.

---

## 22. Application State

Prefer local/component state for workspace-specific interactions.

Use small shared state only for values that genuinely span screens: application theme, current global settings, perhaps active processing metadata if needed globally.

Avoid adding a large state-management framework unless React's normal state/context patterns become insufficient.

Persisted settings and runtime UI state should remain separate concepts.

---

## 23. Error Model

Rust commands should return structured errors suitable for user-facing presentation.

Conceptual categories:

```text
UNSUPPORTED_FORMAT, INVALID_IMAGE, INVALID_DIMENSIONS,
FILE_NOT_FOUND, PERMISSION_DENIED, OUTPUT_UNAVAILABLE,
ENCODE_FAILED, DECODE_FAILED, WRITE_FAILED, PROCESSING_FAILED
```

Errors should contain: stable error code, concise message, optional technical detail for logs/debugging.

Do not expose raw Rust errors or stack traces in normal UI. For batches, errors belong to individual items whenever possible.

---

## 24. Logging

Use lightweight local development/runtime logging.

Log useful technical context: operation, tool, source path where appropriate, processor/command failure, sidecar exit code in future tools.

Do not build analytics or telemetry for V1. Avoid logging file contents.

---

## 25. Security and Filesystem Access

Use the minimum Tauri permissions/capabilities required by the app.

Principles:

- Do not grant broad shell execution unless a tool needs it.
- Do not expose arbitrary command execution to the frontend.
- Scope filesystem capabilities as narrowly as practical.
- Validate all paths received by native commands.
- Treat frontend input as untrusted at the native boundary.

If a future processor uses a sidecar, expose only specific predefined operations.

---

## 26. Future Processors and Sidecars

Future tools should choose the best processing strategy per domain.

Three acceptable patterns:

- **A. Pure Rust/native library** — preferred when a mature cross-platform library satisfies the requirement. `React → Tauri command → Rust processor`
- **B. Rust wrapper around native library** — use when bindings provide a mature, reliable capability. `React → Tauri command → Rust adapter → native library`
- **C. Bundled sidecar** — use when the strongest implementation is an external CLI/binary. `React → Tauri command → Rust tool adapter → bundled sidecar`

The frontend should not care which strategy a tool uses.

Do not introduce sidecars merely for architectural flexibility. Use them only when: a mature external binary clearly beats available Rust options, recreating the capability would add substantial complexity, licensing and distribution are acceptable, and Windows + future macOS packaging are manageable. Sidecars should be wrapped behind a Rust adapter so frontend code does not depend on process execution details.

---

## 27. Cross-Platform Rules

To keep future macOS support practical:

- Use Tauri path/dialog APIs instead of manually constructing OS-specific paths.
- Use `Path` / `PathBuf` in Rust.
- Avoid hard-coded path separators and Windows-only shell commands in domain logic.
- Isolate OS-specific behavior behind small adapters.
- Choose processing libraries with Windows and macOS support where practical.
- Keep output filenames portable and test case sensitivity assumptions where relevant.

Windows packaging remains the only V1 release requirement. Code should be portable where inexpensive, not at the cost of delaying V1.

---

## 28. Performance Principles

The product should feel lightweight.

- Never perform CPU-heavy processing on the frontend UI thread.
- Perform heavy image work in Rust/native processing.
- Use bounded concurrency for batches.
- Avoid repeatedly decoding the same source when an operation can reuse work.
- Avoid loading entire large batches into frontend memory.
- Return file paths and metadata rather than encoded image blobs unless preview requires them.
- Measure before adding caches.

Do not build a generalized caching system in V1.

---

## 29. Preview Strategy

Previews are UI aids, not authoritative processed outputs.

Where a visual preview is useful: generate a small preview/thumbnail, avoid sending full-resolution binary data through the frontend bridge unnecessarily, use temporary/local resources where supported, clean temporary artifacts appropriately.

The first implementation does not need sophisticated before/after visual comparison unless wireframing establishes a strong need.

---

## 30. Cancellation

Cancellation is useful but not a required V1 capability unless implementation makes it straightforward.

Architecture should avoid making cancellation impossible: processing jobs have IDs, loops can check a cancellation flag in the future, sidecars can be terminated through their adapter.

Do not delay V1 to implement a full cancellation framework.

---

## 31. Testing Strategy

Focus tests where bugs can cause incorrect or destructive output.

### Rust Unit Tests

Prioritize: filename collision resolution, source/output path safety, resize calculations, aspect-ratio behavior, logo preset definitions, validation, error mapping.

### Processor Tests

Use small fixture files to verify: supported format conversion, output dimensions, batch partial failures, generated Logo Pack contents, no source overwrite.

### Frontend Tests

Focus on interaction/business states: action disabled without valid input, unsupported file feedback, tool settings visibility, progress/result presentation, partial failure presentation.

Do not over-test presentational implementation details.

### Manual Cross-Platform Check

V1 release testing is Windows-focused. Before a future macOS release, run the same core processor fixture suite on macOS and address packaging/path differences then.

---

## 32. Recommended Implementation Order

### Phase 1 — Shell and Shared Foundation

- Initialize Tauri + React + TypeScript + Vite.
- App shell and launcher.
- Basic navigation.
- Settings persistence.
- Native file/folder dialogs.
- Drag/drop normalization.
- Shared file-list model.
- Export destination handling.

### Phase 2 — Image Processing Foundation

- Native image inspection.
- Image decode/encode.
- Resize.
- Safe output naming.
- Batch processing.
- Structured progress/errors.

### Phase 3 — Image Converter

- Conversion settings.
- Batch conversion.
- Optional resize.
- Result summary.

### Phase 4 — Image Compressor

- Quality processing.
- Optional resize.
- Actual savings result.

### Phase 5 — Web Logo Pack

- Square-source validation.
- Standard Web Pack preset.
- Icon generation.
- Folder output.
- Integration snippet.

### Phase 6 — Hardening

- Failure cases.
- Large batch behavior.
- Permission/path issues.
- Windows packaging.
- Frontend cleanup.
- Processor tests.

---

## 33. Key Architecture Decisions

| Decision | V1 Choice |
|---|---|
| Desktop framework | Tauri 2 |
| Frontend | React + TypeScript + Vite |
| Native processing | Rust |
| Backend server | None |
| Persistence | Lightweight local key-value settings |
| Database | None |
| Processing history | None |
| Tool model | Static internal modules |
| Runtime plugin system | None |
| File processing | Local |
| Batch execution | Native, bounded concurrency |
| Frontend/native bridge | Typed Tauri command wrappers |
| Progress | Transient job events |
| Source modification | Never |
| Filename conflicts | Always auto-rename |
| Export destination | Single app-wide remembered directory |
| Logo Pack output | Folder (no ZIP) |
| Windows | V1 supported platform |
| macOS | Future, architecture kept portable |
| External binaries | Allowed only behind isolated adapters when justified |

---

## 34. Explicit V1 Non-Architecture

Do **not** add these unless a concrete requirement emerges:

- Backend API, cloud storage, authentication.
- SQLite just for settings, persistent job database.
- Runtime plugin framework, dependency injection framework.
- Message broker, worker service, microservices.
- Generic workflow engine, generic file-transformation DSL.
- Electron/Node runtime alongside Tauri without a specific need.
- Blanket shell access.
- Premature repository packages/monorepo splitting.

Keep the application as one Tauri repository with clear internal module boundaries.

---

## 35. Definition of a Healthy Architecture

The architecture is working as intended if:

- Frontend components remain focused on interaction rather than file-processing algorithms.
- Native processors can be tested without rendering the UI.
- File/export/progress behavior is consistent across tools.
- Image Converter and Image Compressor can share image primitives without becoming one tangled feature.
- Web Logo Pack owns web icon specifications in one place.
- A future PDF tool can use a completely different processing engine while reusing shared app infrastructure.
- Adding a tool mostly adds new files rather than modifying unrelated existing tools.
- No database, backend, plugin framework, or generic workflow engine is needed to support V1.
