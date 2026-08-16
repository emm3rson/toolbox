# Toolbox — UI Rules

## 1. Direction & Style

- **Philosophy**: Clean, minimal, calm developer utility. Every layout must feel unified and free of visual noise.
- **Palette**: Neutral studio surfaces (soft `#f4f3f0` background, softened `#f8f7f4` cards, `#fdfcfb` elevated highlights). Never use stark pure white cards that glare against the background. Dark mode uses identical calm layered contrast.
- **Typography & Copy**: Clean sans-serif; font-mono for numbers, paths, and dimensions. **Never use em-dashes (`—`) in UI copy**; use colons (`:`), middle dots (`·`), or parentheses (`(...)`).
- **Transparency**: Transparent images render over `.bg-transparency-grid` so white/dark graphics remain visible in all themes.

## 2. Layout & Structure

- **Launcher**: Compact 3-column tool card grid across all window sizes.
- **Workspace**: Top-to-bottom flow (files → settings → export location → primary CTA). Two columns on desktop: queue on left (`minmax(0, 1fr)`), settings sidebar on right (`340px` or `240px`).
- **Settings Cards**: Group tool settings inside cohesive bordered cards (`bg-card border border-border-strong rounded-[var(--radius-lg)] p-4`), not floating loose controls.

## 3. Components & Interaction

- **Thumbnails & Previews**: Queue items show real 36x36 px thumbnails (`object-cover`) for images with extension badge and icon fallback on error. PDF queue items show a clean document icon with `.pdf` badge. Logo pack shows uncropped square preview (`object-contain`).
- **Control Hierarchy**: Quality sliders show prominent mono score with `"max compression"` / `"near-lossless"` bounds. One clear primary button; secondary destructive actions ("Clear all") stay muted (`text-muted-foreground`) until hovered.
- **Completion Screen**: Elevated summary card with metrics, optional partial-conversion notices using the shared warning tokens, failures, and action buttons (`FolderIcon`, `RotateCcwIcon`, `CopyIcon`) aligned to the message text column. All-failed results must not show output-only actions or content.
- **Non-Destructive**: Auto-rename on collision; never overwrite source files.
