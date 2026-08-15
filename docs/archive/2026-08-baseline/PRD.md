# Desktop Utility Toolbox — PRD

## 1. Product Summary

A local-first desktop utility app for repetitive asset-preparation tasks that currently require opening browser-based tools, remembering technical specifications, or performing multiple manual steps.

The app should make common developer-oriented file workflows fast and straightforward:

1. Open the app.
2. Choose a utility.
3. Drag in file(s).
4. Adjust only the settings that matter.
5. Export.

V1 focuses on image conversion, image compression, and website logo asset generation while establishing a modular foundation for future utilities such as PDF processing.

---

## 2. Problem

Small asset-preparation tasks create unnecessary friction during development and general computer use.

Examples:

- Converting PNG/JPG images to WebP requires finding an online converter.
- Compressing image files often requires another browser tool.
- Creating favicon and web icon variants requires remembering required dimensions, formats, and filenames.
- Repeating these workflows wastes time and introduces unnecessary context switching.

These tasks are simple enough that they should be handled locally through a focused desktop utility.

---

## 3. Goals

- Reduce repetitive file-preparation workflows to a few interactions.
- Provide a clean, fast, intuitive desktop experience.
- Perform processing locally whenever practical.
- Support batch operations where they provide clear value.
- Never modify original files.
- Provide sensible defaults so users rarely need to understand format-specific details.
- Establish a modular architecture that can accommodate unrelated future utilities such as PDF tools.

---

## 4. Target User

Primary user:

- Developer or technical user who frequently prepares assets for websites or personal projects.
- Values speed, low friction, and predictable local workflows.
- Does not want to rely on browser-based converter websites for basic file operations.

V1 is primarily a personal productivity tool but should avoid architectural decisions that make broader distribution difficult later.

---

## 5. Platform Strategy

- **V1:** Windows-first.
- **Future:** macOS support should remain practical. Cross-platform compatibility should be considered when selecting libraries, filesystem behavior, paths, packaging, and native integrations.

V1 should not add macOS-specific implementation work unless required to preserve portability.

---

## 6. Product Structure

The application opens to a simple grid-style utility launcher.

Each tool is represented by an icon, name, and optional short description where useful.

Selecting a tool opens a focused workspace dedicated to that task.

The product should not introduce dashboards, projects, workspaces, or deep navigation in V1.

---

## 7. Shared Tool Capabilities

Tools should share common infrastructure and interaction patterns where appropriate.

Shared capabilities:

- Drag-and-drop file input with file picker fallback.
- Batch file support.
- Compact file list/grid with metadata (filename, format, dimensions, file size).
- Remove individual file / clear all.
- Processing progress with per-file error reporting.
- Export destination selection (single app-wide remembered destination).
- Completion summary with option to open output folder.
- Non-destructive processing.
- Automatic filename conflict resolution (always auto-rename).

### Folder Input

Users may drag or select a folder. V1 processes only supported files directly inside the selected folder. Subdirectories are not scanned recursively.

---

## 8. Tool 1: Image Converter

### Purpose

Convert one or many images between common web-friendly formats.

### Supported V1 Formats

Input and output: PNG, JPG/JPEG, WebP.

Deferred: AVIF, GIF, SVG, HEIC, and other specialty formats.

### Settings

Only settings relevant to the chosen output format should be shown:

- Output format.
- Quality (where applicable to the chosen format).
- Optional lightweight resize (width/height with aspect ratio lock, or percentage scale — no cropping).

### Output Naming

Default: original base filename with the new extension (e.g. `photo.png → photo.webp`). Conflicts auto-renamed incrementally (`photo-2.webp`, `photo-3.webp`).

---

## 9. Tool 2: Image Compressor

### Purpose

Reduce image file size while preserving the current format and making the size/quality tradeoff easy to understand.

### Supported V1 Formats

PNG, JPG/JPEG, WebP.

### Settings

- Quality slider as the primary control.
- Optional lightweight resize (same options as Image Converter).

### Important Boundary

V1 does **not** support entering a target file size and automatically searching for the required quality level.

V1 does **not** provide real-time pre-export size estimates. Actual before/after sizes are shown in the completion summary. Users can adjust quality and re-export quickly.

### Output Naming

Default: `photo.jpg → photo-compressed.jpg`. Conflicts auto-renamed incrementally.

---

## 10. Tool 3: Web Logo Pack

### Purpose

Generate standard website icon/favicon assets from a suitable source image without requiring the user to remember dimensions, formats, or filenames.

### V1 Input

A reasonably high-resolution square logo/icon source in a supported raster format.

V1 should not attempt to automatically convert arbitrary non-square logos into visually correct square icons. The UI should explain the source requirement clearly.

### Standard Web Pack

The application owns the recommended dimensions, formats, filenames, and generation rules. Expected outputs include assets such as:

```text
favicon.ico
favicon-16x16.png
favicon-32x32.png
apple-touch-icon.png
icon-192.png
icon-512.png
```

The exact standard set should be maintained centrally so requirements can be updated without redesigning the workflow.

### Asset Selection

Each generated variant can be enabled/disabled through a simple checkbox or toggle. The default selection should represent a sensible standard website pack.

### Output

V1 exports a ready-to-copy folder (no ZIP). After generation, a short copyable integration snippet is shown indicating how the generated assets are typically referenced. The app does not edit the user's website or project automatically.

---

## 11. Settings

V1 global settings should remain small.

### Appearance

- System / Light / Dark. Default: System.

### Export

- Last/default output directory (single app-wide value).

### Tool Preferences

Remember each tool's most recently used settings where practical:

- Last conversion format and quality.
- Last resize preference.
- Last Logo Pack asset selection.

Do not introduce accounts or a database solely for settings.

---

## 12. Local-First and Privacy

Processing happens locally. V1 does not upload user files to external services.

Benefits: faster workflows, works offline, no file privacy concerns, no hosting or processing costs, predictable behavior for potentially sensitive project assets.

If a future tool requires an external service, that dependency should be explicit and isolated to that tool.

---

## 13. V1 Scope

### Included

- Windows desktop app.
- Tool launcher.
- Image Converter (PNG/JPG/WebP).
- Image Compressor (PNG/JPG/WebP).
- Web Logo Pack.
- Batch operations with per-file failure isolation.
- Non-recursive folder input.
- Lightweight resizing (no cropping).
- Local processing only.
- Shared export workflow with auto-rename conflict resolution.
- Persistent lightweight settings/preferences.
- Light/dark/system theme.
- Windows installer/executable.

### Deferred

- macOS and Linux releases.
- Auto-updates.
- Accounts, cloud sync, persistent job history.
- AI features.
- Real-time compression size estimation.
- Target-size compression.
- Full image editor, cropping.
- Recursive folder scanning.
- AVIF/GIF/SVG/HEIC processing.
- Custom filename prefix/suffix.
- Website/project modification.
- Custom logo layout generation.
- General brand/social-media logo packs.
- ZIP output for Logo Pack.
- Formal third-party tool/plugin SDK.

---

## 14. Future Expansion

The architecture should make it straightforward to add tools such as PDF compression, merge/split, PDF-to-image, additional image formats, metadata stripping, and other lightweight local file utilities.

Future tools should be added based on recurring friction rather than attempting to make V1 a comprehensive toolbox.

---

## 15. V1 Success Criteria

V1 is successful if:

- A user can convert a batch of images without opening a browser.
- A user can compress images while clearly understanding the expected size/quality tradeoff.
- A user can create a standard set of website icon assets without remembering specifications.
- Normal workflows take only a few interactions.
- Originals are never unexpectedly modified.
- One bad file does not break a batch.
- The application feels responsive and lightweight.
- Adding a fundamentally different utility, such as PDF processing, does not require restructuring the existing image tools.

Implementation stack and architecture decisions are documented in `ARCHITECTURE.md`.
