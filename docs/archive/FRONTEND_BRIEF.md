# Frontend Build — Handoff

## Context

A Figma Make prototype exists with every screen state for this app (launcher, 3 tools, settings, all shared states). Connect to it to extract the design tokens, layout, and component structure. The prototype uses Inter + JetBrains Mono, warm off-white/charcoal palette, hairline borders, no gradients, full light/dark token sets.

## Reference Docs (in `docs/`)

- **ARCHITECTURE.md** — stack, repo structure, frontend responsibilities, Tauri boundary, tool module model, state management guidance.
- **USER_FLOWS.md** — every interaction flow and screen state (§19 is the complete inventory).
- **UI_GUIDELINES.md** — visual direction and anti-patterns.
- **PRD.md** — product scope and tool specs.

## Task

### Phase 1: Scaffold

Initialize in this repo (`c:\Projects\utility-desktop`):

- Tauri 2 + React + TypeScript + Vite.
- Follow the repo structure in ARCHITECTURE.md §6.
- Basic Tauri config (window title, default size ~1200×800, min size).

### Phase 2: Frontend Build

Build all frontend UI against the Figma Make prototype. Pull design tokens, components, and layouts from the prototype code.

**What to build:**

- App shell with top bar / lightweight navigation (back to launcher).
- Tool launcher (3-card grid).
- Shared workspace components: drop zone, file list, export location selector, progress bar, completion summary.
- Image Converter workspace (format selector, quality slider, collapsible resize).
- Image Compressor workspace (quality slider, collapsible resize).
- Web Logo Pack workspace (single-file input, square validation feedback, asset checklist, integration snippet).
- Settings page (theme toggle, export folder).
- All shared states: empty, drag-over, invalid file, processing, partial failure, completion.
- Light/dark theme switching.

**What to stub:**

- All Tauri commands (`inspectFiles`, `convertImages`, `compressImages`, `generateLogoPack`). Create a typed service layer (ARCHITECTURE.md §9) with mock implementations that return realistic fake data after a short delay.
- File picker / folder picker dialogs — stub with hardcoded paths.
- Settings persistence — use React state or localStorage for now.

**What NOT to build:**

- Any Rust/native processing code.
- Real file I/O.
- Real drag-and-drop file reading (wire the drop zone UI, but the actual Tauri file-drop integration comes later).

### Key Architecture Rules

- Static tool registry (ARCHITECTURE.md §7) — each tool exports a `ToolDefinition`.
- Frontend owns interaction state, not processing logic (§8).
- Typed Tauri adapter layer between components and `invoke()` (§9) — even though commands are stubbed, the adapter interface should match the real contracts in §11.
- Prefer local/component state; shared state only for theme and global settings (§22).
- No heavy state management library unless React context proves insufficient.

## Done When

- Every screen in USER_FLOWS §19 is reachable and visually matches the Figma Make prototype.
- Light and dark modes work.
- Stubbed workflows complete end-to-end (add fake files → adjust settings → "export" → see completion summary).
- The typed Tauri adapter layer is in place with mock implementations, ready to swap in real commands.
