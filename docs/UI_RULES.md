# Toolbox — UI Rules

## 1. Direction

Polished developer utility: clean, minimal, calm, precise, understated. Never
decorative at the expense of speed or clarity.

## 2. Layout

- Launcher: tool-card grid (icon + name + short description). No
  dashboards/stats/illustrations.
- Workspace, top to bottom: files → settings → export location → primary action
  (wide layouts may use two columns). One focused workspace per tool, not a
  wizard.
- Settings: calm rows grouped by spacing/separators, not a card per setting.

## 3. Style

- Neutral palette (soft off-white surfaces, charcoal text, muted grays,
  restrained borders); semantic color only for success/error/active. No
  gradients, neon accents, large colored regions; dark mode keeps the same calm
  contrast.
- Clean sans-serif; hierarchy via size/weight/spacing; muted secondary metadata;
  no oversized headings.
- Medium radii for surfaces, small-to-medium for buttons/inputs; pills only for
  genuine tags/toggles. Flat/lightly layered, subtle borders, minimal shadows.
- Motion short and functional (hover, expand, drag-over, progress); one
  consistent icon family, secondary to labels.

## 4. States

- Empty/drop: "Drop images here" + browse; muted hint for special requirements
  (Logo Pack square ≥ 512).
- Files added: compact list — filename, extension, dimensions (when known),
  size; per-row remove, add-more, clear-all.
- Invalid: row-level inline error + alert icon; invalid files excluded from
  export with a skipped-count note. No generic modals.
- Processing: inline "Processing N of M" + percentage; no full-screen loaders or
  blocking modals.
- Completion: strong result typography; per-tool metrics (compressor
  before/after); failure list; actions Open folder / Process more (Logo Pack:
  Copy snippet).
- Partial failure: one bad file never blocks the batch; failures listed with
  reasons.

## 5. Interaction

- Export/Generate enabled only with valid input + usable destination; first
  export prompts once, then remembers app-wide (shown in "Export to" with
  Change).
- Conflicts always auto-rename; never overwrite sources.
- Resize optional and collapsed (Original/Dimensions/Percentage; aspect lock is
  a frontend affordance); no cropping.
- Compressor: quality slider is the primary control, with a one-line
  PNG-lossless note; no size estimates.
- Logo Pack: single square ≥ 512 source; specific messages (unsupported /
  non-square with dims / too-small); badge only for valid sources; fresh
  numbered output folder; snippet behind an expandable section.
- One clear primary button; secondary outline/ghost; destructive restrained.

## 6. Accessibility

Keyboard-operable controls with visible focus rings; toggle buttons expose
`aria-checked`; labels on icon-only controls; color never the sole signal.

## 7. Owner visual checklist

`npm run tauri dev`: launcher grid, empty/drop, file list, dark/light parity,
processing + completion + partial failure, inline errors, Logo Pack validation +
generated folder.
