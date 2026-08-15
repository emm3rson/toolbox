# Development Phases

## Prerequisite

The frontend has been built per `FRONTEND_BRIEF.md` — all screens are implemented with stubbed Tauri commands and mock data. The typed adapter layer is in place.

---

## Phase 1 — Tauri Shell Integration

**Goal:** Replace all OS-level frontend stubs with real Tauri integrations. After this phase, the app feels like a real desktop app even though processing is still mocked.

**Scope:**

- Native file picker and folder picker dialogs (Tauri dialog API).
- Real drag-and-drop file reading (Tauri file-drop events → actual file paths).
- Settings persistence to disk (Tauri store or lightweight key-value file).
- System theme detection + live theme switching.
- "Open Folder" action (Tauri shell API → system file explorer).
- Window configuration (title bar, min/default size, icon).

**Done when:** A user can open a real file picker, drag real files onto the drop zone, see actual filenames/paths in the file list, persist settings across app restarts, and open a folder in Explorer. Processing still returns mock results.

---

## Phase 2 — Image Processing Core + Image Converter

**Goal:** Build the Rust image processing foundation and deliver the first fully working tool end-to-end.

**Scope:**

- Rust image inspection (read format, dimensions, file size from real files).
- Image decode / encode (PNG, JPG, WebP).
- Resize engine (width/height with aspect ratio, percentage scale).
- Batch execution with bounded concurrency and per-file failure isolation.
- Progress events (Tauri event emitter → frontend).
- Export service: output naming, auto-rename collision handling, non-destructive guarantee.
- **Image Converter command** — wire up `convertImages` with real processing, swap out the mock adapter.
- Structured error responses.

**Done when:** A user can drop real images, select an output format, optionally resize, export, and receive real converted files in the chosen destination. Batch processing works with progress and per-file failure reporting.

---

## Phase 3 — Image Compressor + Web Logo Pack

**Goal:** Deliver the remaining two tools, building on the image processing core from Phase 2.

**Scope:**

- **Image Compressor command** — quality-controlled re-encoding that preserves the source format. Wire up `compressImages`, swap out the mock. Completion summary shows actual before/after sizes and savings.
- **Web Logo Pack command** — square-source validation, multi-target resize into predefined dimensions, ICO generation, encode required formats, write selected assets to a folder, return integration metadata. Wire up `generateLogoPack`, swap out the mock. Preset definitions owned centrally in Rust.

**Done when:** All three tools work end-to-end with real file processing. No mock adapters remain.

---

## Phase 4 — Hardening + Release

**Goal:** Production-ready Windows release.

**Scope:**

- Edge cases: large batches, permission errors, missing/moved destinations, corrupt files, zero-byte files, extremely large images.
- Rust unit tests (collision resolution, path safety, resize math, aspect ratio, logo presets, validation, error mapping).
- Processor integration tests with small fixture files (format conversion, output dimensions, batch failures, Logo Pack contents, no source overwrite).
- Frontend tests on key interaction states (action disabled without input, invalid file feedback, progress/result display, partial failure).
- Performance check: batch concurrency tuning, memory behavior on large batches.
- Windows packaging (Tauri bundler → MSI or NSIS installer).
- App icon, metadata, installer branding.
- Final cross-doc consistency check.

**Done when:** Installer produces a working Windows app. All critical paths are tested. The app handles real-world edge cases gracefully.

---

## Phase Sequence

```text
FRONTEND_BRIEF (done)
    │
    ▼
Phase 1: Tauri Shell Integration
    │
    ▼
Phase 2: Image Core + Converter
    │
    ▼
Phase 3: Compressor + Logo Pack
    │
    ▼
Phase 4: Hardening + Release
```

Each phase produces a usable increment. An implementation agent should create a detailed plan for one phase at a time, verify it, then move to the next.
