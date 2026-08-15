# Figma Make — Design Brief

## What to Design

End-to-end wireframes/mockups for a **Windows desktop utility app** (Tauri 2 shell). The app is a local-first toolbox for image conversion, compression, and favicon/logo generation.

## Uploaded References

- **PRD.md** — product scope, tools, and boundaries.
- **USER_FLOWS.md** — every screen state and interaction flow. **§19 is the definitive screen list.**
- **UI_GUIDELINES.md** — visual direction, color, typography, anti-patterns.
- **ARCHITECTURE.md** — tech context only; not needed for visual design.

## Screens to Produce

Design these screens/states in order. All screens need **light and dark mode** variants.

### App Shell

1. **Utility Launcher** — grid of 3 tool cards (Convert Images, Compress Images, Web Logo Pack). Clean, minimal, no dashboard chrome.

### Image Converter

2. **Empty state** — drop zone + browse button.
3. **Files added** — file list with metadata + output format selector (PNG / JPG / WebP) + quality slider (visible for lossy formats) + collapsed resize option + export location + Export button.
4. **Resize expanded** — dimensions (width/height with aspect ratio lock) or percentage scale.
5. **Processing** — inline progress bar, "Processing 7 of 12".
6. **Completion** — summary with file count + Open Folder / Process More buttons.

### Image Compressor

7. **Files added** — file list + quality slider as the hero control + collapsed resize + Export button. No pre-export size estimate.
8. **Completion** — summary with before/after sizes and % saved.

### Web Logo Pack

9. **Empty state** — drop zone with "Use a high-resolution square logo" guidance.
10. **Invalid source** — error state showing non-square dimensions.
11. **Valid source + asset toggles** — source preview + Standard Web Pack checklist (favicon.ico, favicon-16x16.png, etc.) with checkboxes.
12. **Completion** — asset count + Open Folder / Copy Snippet / Process Another + collapsible HTML snippet.

### Shared States

13. **Partial batch failure** — completion with failed file callout and concise error reason.
14. **Drag-over state** — drop zone highlighted during file drag.

### Settings

15. **Settings page** — Theme (System/Light/Dark), export folder.

## Visual Direction (Summary)

- **Vibe:** Polished developer utility. Clean, calm, precise, modern. Not a SaaS dashboard.
- **Color:** Mostly neutral. Soft off-whites, charcoal text, restrained borders. No gradients, no neon, no brand accent required. Semantic color only for success/warning/error.
- **Dark mode:** Charcoal backgrounds, slightly lighter elevated surfaces, off-white text. Same product feel as light mode.
- **Typography:** Clean sans-serif (system or Inter/similar). Size and weight for hierarchy, not color.
- **Shape:** Medium rounded corners on surfaces, small-to-medium on buttons/inputs. No pill-everything.
- **Density:** Medium — calm spacing but compact enough for batch file lists.
- **Elevation:** Flat or lightly layered. Subtle borders over shadows. No glassmorphism.
- **Motion:** Subtle hover/press feedback, drag-over transition. No decorative animation.

## Critical Anti-Patterns to Avoid

- Gradients, glassmorphism, glowing borders.
- Random purple/blue accents.
- Giant hero headings, decorative blobs/illustrations.
- A card wrapping every element.
- Oversized icons, badges, or charts.
- Confetti or celebratory completion graphics.
- Multiple equally prominent CTAs.
- Verbose helper text or tutorials in empty states.

## Layout Notes

- Desktop window, not mobile. Design for ~1200-1400px width, not maximized/fullscreen.
- Single-column workspace is the default. Two-column (files | settings) is acceptable on wide layouts if it improves efficiency.
- Navigation: compact top bar or lightweight sidebar with back-to-launcher. No complex sidebar.
- The Export button is the primary action — it should be the most visually prominent control.

## Deliverable

A complete set of frames covering all 15 screens above, in both light and dark mode. Organize frames by tool, with shared states grouped separately.
