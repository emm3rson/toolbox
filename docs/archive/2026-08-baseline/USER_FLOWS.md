# Desktop Utility Toolbox — User Flows

## 1. Purpose

This document defines the V1 interaction flows, screen states, and UX guardrails for the desktop utility app.

It guides wireframes, UI mockups, interaction design, and frontend implementation. It focuses on user behavior and screen states, not visual styling (see `UI_GUIDELINES.md`) or implementation architecture (see `ARCHITECTURE.md`).

---

## 2. Core UX Principles

### Fast by Default

Most workflows should follow this pattern:

```text
Open app → Choose tool → Add file(s) → Adjust settings if needed → Export → Review result
```

The app should minimize unnecessary steps, dialogs, and configuration.

### Progressive Disclosure

Show common controls immediately. Advanced or less frequently used options should remain secondary or collapsed.

### Sensible Defaults

Users should not need to understand encoding internals, favicon specifications, or format details to get a good result.

### Clear Feedback

Always make these states obvious: file accepted/rejected, processing, success, partial failure, export location.

### Avoid UI Clutter

The application is a utility toolbox, not an asset manager. Keep navigation, panels, controls, labels, and persistent state minimal.

---

## 3. App-Level Flow

### 3.1 Launch

```text
Launch app → Utility launcher
```

The launcher is the default home screen. It shows a grid of available tools (Convert Images, Compress Images, Web Logo Pack), each with an icon, name, and optional short description.

Avoid dashboards, recent jobs, statistics, or project concepts.

### 3.2 Open a Tool

```text
Launcher → Select tool → Tool workspace
```

Each workspace should feel focused on one task. A clear way to return to the launcher should always be available.

---

## 4. Shared Tool Workspace Pattern

Where practical, file-based tools should follow the same layout and interaction model:

```text
Tool title

[ Drop files here ]
[ Browse files ]

Added files
-------------------------

Tool settings
-------------------------

Export location
-------------------------

[ Export ]
```

The exact layout can change during wireframing, but the hierarchy should remain simple.

---

## 5. Adding Files

### 5.1 Drag and Drop

```text
Drag supported file(s) → Drop zone becomes active → Drop → Validate
→ Valid files added / Unsupported files rejected with concise feedback
```

Batch file drops are supported.

### 5.2 Browse Files

```text
Click Browse → Native file picker → Select one or multiple files → Validate → Add valid files
```

### 5.3 Add Folder

```text
Select/drop folder → Scan files directly inside folder → Add supported files → Ignore unsupported files
```

V1 does not scan nested subfolders. If no supported files are found, show a concise empty/error message.

---

## 6. File List Behavior

After files are added, show a compact list or grid with relevant metadata (filename, format, dimensions, original file size).

Actions: remove individual file, clear all, add more files.

Do not introduce file management concepts beyond what is needed for the active operation.

---

## 7. Export Location

The app remembers a single app-wide last-used export folder.

```text
Tool opened → Previous export destination already selected
```

The user may change it at any time. If no previous folder exists, the first export prompts the user to choose a destination, which is then remembered.

The app must never silently overwrite original files.

---

## 8. Filename Conflicts

Output files that conflict with existing files are always auto-renamed incrementally:

```text
photo.webp → photo-2.webp → photo-3.webp
```

Do not interrupt batch processing with repeated overwrite dialogs.

---

## 9. Processing Flow

### Before Processing

The Export/Process action should only be enabled when valid input exists, required settings are valid, and a usable destination exists.

### During Processing

```text
Click Export → Processing starts → Show progress → Process files independently
```

The user should understand: processing is active, how many files are complete, whether any files failed.

```text
Processing 7 of 12
```

Avoid disruptive modal dialogs for normal progress.

### Partial Failure

A failed file must not stop the rest of the batch. The error should identify the affected file and give a concise reason.

---

## 10. Completion Flow

Successful processing transitions to a compact result state with relevant metrics:

```text
12 files exported
8.4 MB → 2.1 MB
75% saved

[ Open Folder ] [ Process More ]
```

Metrics should only appear when relevant to the tool.

- **Open Folder:** opens the export destination in the system file explorer.
- **Process More:** returns the tool to input-ready state with previous tool settings retained.

---

## 11. Image Converter Flow

### Main Flow

```text
Launcher → Convert Images → Add image(s) → Select output format → Adjust optional settings → Export → Completion
```

### Output Format Selection

```text
Output format: [ PNG | JPG | WebP ]
```

Only settings relevant to the selected format should be shown (e.g. quality control for WebP/JPG).

### Quality Setting

For lossy output formats, show a quality slider that is understandable without requiring encoding knowledge.

### Resize

Resize is optional and secondary. Default: keep original dimensions.

When enabled:

```text
○ Original  ○ Dimensions  ○ Percentage
```

Dimensions: Width / Height with aspect ratio lock. Percentage: scale factor. No cropping in V1.

---

## 12. Image Compressor Flow

### Main Flow

```text
Launcher → Compress Images → Add image(s) → Adjust quality → Optional resize → Export → Review actual result
```

Input format remains the output format.

### Quality Slider

Primary control:

```text
Quality: 82
```

No pre-export size estimation in V1. Actual before/after sizes are shown in the completion summary (see §10).

### Resize

Uses the same lightweight resize interaction as Image Converter. Resize remains optional.

---

## 13. Web Logo Pack Flow

The Logo Pack uses the shared workspace pattern (§4) with these specializations:

- **Single-file input.** Only one square source logo is accepted.
- **Source validation.** The workspace must clearly communicate: "Use a high-resolution square logo or icon." After input, validate supported format, readable image, square dimensions, and sufficient resolution. If invalid, explain the specific issue (e.g. "This image is 1200 × 400. Use a square source image."). No automatic cropping in V1.
- **Asset selection.** After a valid image is added, show the Standard Web Pack with checkboxes:

```text
Standard Web Pack

[x] favicon.ico
[x] favicon-16x16.png
[x] favicon-32x32.png
[x] apple-touch-icon.png
[x] icon-192.png
[x] icon-512.png
```

Users may toggle individual assets on/off. The user should not have to manually enter dimensions.

- **Generate and export.** Output is a ready-to-copy folder.
- **Completion.** Show asset count, Open Folder, Copy Snippet, and Process Another actions. A concise integration snippet (e.g. `<link>` tags) is shown below or behind a small expandable/copyable section. Keep this secondary to the generated files.

---

## 14. Empty States

Each tool should have a clear initial state:

```text
Drop images here
or
[ Browse Files ]
```

A short explanation may appear below when the tool has a special requirement (e.g. Logo Pack's square-source instruction).

Do not fill empty states with tutorials or excessive copy.

---

## 15. Validation States

Validation should happen as early as practical. Errors should be local to the relevant control/file wherever possible.

Examples:

- **Unsupported format:** `document.pdf is not supported by Image Converter.`
- **Invalid logo shape:** `Logo must be square. Current size: 1200 × 400`
- **Missing output:** `Choose an export folder before processing.`

---

## 16. App Settings Flow

Settings should remain lightweight.

```text
App → Settings
```

V1 settings:

- **Theme:** System / Light / Dark.
- **Export:** Remembered/default output folder.
- **Tool preferences:** Remembered automatically where practical (last conversion format, last quality value, resize setting, Web Logo Pack selections). No history management screen required.

---

## 17. Returning to a Tool

```text
Open tool → Empty input state → Previous tool preferences retained → Previous export destination retained
```

Previous files/jobs do not need to persist after the session or after using Process More.

---

## 18. Navigation Rules

Keep navigation shallow:

```text
Launcher
├── Convert Images
├── Compress Images
├── Web Logo Pack
└── Settings
```

Avoid nested navigation, project pages, dashboard sections, history pages, or multi-step wizards unless genuinely necessary. Each utility should behave primarily as a single focused workspace.

---

## 19. Wireframe States to Design

At minimum, wireframes/mockups should cover:

### App

- Utility launcher
- Settings

### Shared Tool States

- Empty/drop state
- Files added
- Invalid file feedback
- Processing
- Partial failure
- Success/completion

### Image Converter

- Files added + output settings
- Resize expanded
- Completion

### Image Compressor

- Quality slider
- Batch state
- Completion with actual savings

### Web Logo Pack

- Empty/source requirement
- Invalid non-square source
- Valid source + asset toggles
- Completion + integration snippet

---

## 20. UX Guardrails

During wireframing and implementation:

- Keep primary actions visually obvious.
- Avoid requiring configuration before files are added unless necessary.
- Prefer inline states over modal dialogs.
- Keep advanced/secondary controls collapsed or visually subordinate.
- Do not expose technical parameters simply because the underlying library supports them.
- Do not force users through a wizard for workflows that fit naturally on one screen.
- Preserve consistent drag/drop, file list, export, progress, and completion patterns across tools.
- Treat each utility as a focused task, not as a mini application.
