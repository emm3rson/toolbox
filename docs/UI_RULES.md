# Toolbox — UI Rules

## 1. Direction

Polished developer utility: clean, minimal, calm, precise, understated. Never
decorative at the expense of speed or clarity. Every control and layout must feel
intentional, unified, and free of visual noise.

## 2. Layout

- **Launcher**: Compact 3-column tool grid (icon box `h-10 w-10` + tool name +
  short description) that stays 3 columns across screen sizes. Subheader: "Local
  utilities for daily workflows. Nothing leaves your machine."
- **Workspace**: Top-to-bottom flow (files → settings → export location → primary
  action). Wide layouts use two columns: left queue (`minmax(0, 1fr)`), right
  sidebar (`340px` or `240px` for single source tools). One focused workspace per
  tool, not a wizard.
- **Settings sidebar**: Tool controls (format, quality, resize) must be grouped
  inside cohesive bordered cards (`rounded-[var(--radius-lg)] border border-border-strong bg-card p-4`),
  not floating loose controls on the background.

## 3. Style & Palette

- **Surfaces**: Soft off-white studio background (`#f4f3f0`), softened warm card
  surfaces (`#f8f7f4`), and gentle elevated highlights (`#fdfcfb`). Never use stark
  pure white cards that create harsh contrast against the background. Dark mode
  maintains identical calm layered contrast (`#17161a` → `#1e1d21` → `#26252a`).
- **Typography & Punctuation**: Clean sans-serif; hierarchy via size/weight/spacing;
  font-mono for numbers, dimensions, and paths. **Never use em-dashes (`—`) in UI copy**;
  use colons (`:`), middle dots (`·`), or parentheses (`(...)`).
- **Transparency**: Transparent images (PNG/WebP) render over a subtle CSS
  transparency checkerboard (`.bg-transparency-grid`) so white/dark graphics remain
  visible in both light and dark modes.

## 4. Components & States

- **Drop Zone**: Dashed border with subtle hover/drag-over scale feedback; concise
  hint without redundant disclaimers.
- **File Rows**: Compact list item with real `36x36 px` image thumbnail (`object-cover`
  over transparency grid + extension pill) and fallback to icon on decode error;
  filename, dimensions, size; row remove on hover.
- **Image Previews**: Web Logo Pack renders a real square preview canvas
  (`object-contain` over transparency grid) with integrated "Replace image" button;
  no noisy placeholder glyphs or redundant badges.
- **Quality Control**: Large `22px` mono number on top right, with `"max compression"`
  and `"near-lossless"` footer captions. One-line lossless note: "PNG is lossless.
  Quality slider applies to JPG and WebP only." (no size estimates).
- **Secondary Actions**: Destructive actions like "Clear all" must remain muted
  (`text-muted-foreground`) and highlight danger red only on hover, preserving focus
  on the primary CTA.
- **Completion / Post-Process**: Elevated summary card with metrics, failures,
  and action buttons aligned with the text column. Action buttons consistently pair
  contextual icons (`FolderIcon`, `RotateCcwIcon`, `CopyIcon`).
- **Partial failure**: One bad file never blocks the batch; failures listed with
  filename and error reason separated by a colon.

## 5. Interaction

- Export/Generate enabled only with valid input + usable destination; remembers
  app-wide default export path.
- Conflicts always auto-rename; never overwrite source files.
- Resize optional and collapsed (Original / Dimensions / Percentage with aspect lock).
- One clear primary button; secondary buttons use outline/ghost with icons.

## 6. Accessibility

Keyboard-operable controls with visible focus rings; toggle buttons expose
`aria-checked`; labels on icon-only controls; color never the sole signal.

## 7. Owner visual checklist

`npm run tauri dev`: launcher 3-column grid, empty/drop, real thumbnails, dark/light
parity, settings cards, completion text alignment + icons, and Logo Pack square preview.
