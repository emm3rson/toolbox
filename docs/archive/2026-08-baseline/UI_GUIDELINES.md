# Desktop Utility Toolbox — UI Guidelines

## 1. Purpose

This document guides wireframing, mockups, and frontend visual implementation for the desktop utility toolbox.

It should be used together with `PRD.md`, `USER_FLOWS.md`, and `ARCHITECTURE.md`.

The goal is a UI that feels **clean, minimal, fresh, polished, and comfortable to use for long periods**, while remaining efficient for repetitive desktop utility tasks.

The provided visual references are directional only. Do not copy any single composition or visual treatment literally.

---

## 2. Visual Direction

Aim for a **polished developer utility** rather than a generic dashboard or consumer app.

Keywords: clean, minimal, fresh, calm, focused, precise, modern, understated, professional, lightly technical.

The app should feel intentionally designed, but never decorative at the expense of speed or clarity.

---

## 3. Core Principles

### Function First

The interface exists to complete small utility tasks quickly. Do not add visual sections that do not support the core flow (files → settings → export → result).

### Medium Density

Use enough spacing to feel calm and polished, but keep information compact enough for batch workflows. Avoid both cramped desktop-tool density and oversized SaaS-style layouts.

### Strong but Quiet Hierarchy

Use typography, spacing, alignment, and surface contrast before using color. Important actions should be obvious without requiring bright accent colors.

---

## 4. Color Direction

Use a mostly neutral palette.

### Base

- Soft off-white backgrounds instead of pure `#FFFFFF`.
- Dark charcoal text instead of pure `#000000`.
- Subtle warm or neutral grays for secondary surfaces.
- Restrained borders with low contrast.

Exact tokens should be finalized during implementation.

### Avoid

- Pure black on pure white as the dominant pairing.
- Gradients, neon accents, large colorful background regions, decorative pastel cards.

### Semantic Colors

Use color when meaningfully communicating success, warning, error, or active processing. Keep semantic colors restrained and accessible.

The V1 UI does not require a prominent brand accent color.

---

## 5. Dark Mode

Dark mode should preserve the same calm contrast philosophy.

Use near-black or charcoal backgrounds, slightly lighter elevated surfaces, off-white primary text, muted gray secondary text.

Avoid absolute black backgrounds, glaring white text, or excessive glowing borders/accents.

Light and dark themes should feel like the same product.

---

## 6. Typography

Use a clean modern sans-serif suitable for desktop UI. Prefer system or high-quality neutral sans-serif typography over decorative fonts.

Hierarchy should primarily use size, weight, and spacing. Avoid excessive font styles.

```text
Page/tool title       prominent but not oversized
Section title         medium emphasis
Primary body          normal
Secondary metadata    smaller and muted
Labels                concise and readable
```

Do not use giant marketing-style headings inside utility workspaces.

---

## 7. Shape Language

Use rounded corners consistently but restrained for a productivity utility.

- App-level surfaces: medium radius.
- Cards/panels: medium radius.
- Buttons/inputs: small-to-medium radius.
- Pills only when the content genuinely behaves like a pill/tag/toggle.

Avoid making every element pill-shaped or exaggerated bubble-like interfaces.

---

## 8. Borders and Elevation

Prefer flat or lightly layered surfaces.

Use subtle borders, small surface-value differences, and minimal shadows only where depth genuinely helps.

Avoid heavy drop shadows, floating-card overload, glassmorphism, strong blur effects, or multiple competing elevation levels.

Most structure should come from spacing and surface grouping.

---

## 9. App Shell

Keep the shell minimal. For V1, a compact top-level navigation treatment or lightweight sidebar is sufficient. The active tool should have a clear way back to the tool launcher.

Do not design a complex dashboard sidebar unless wireframing proves it meaningfully improves navigation.

---

## 10. Tool Launcher

The launcher should feel like a desktop utility shelf, not a SaaS dashboard.

Use a clean grid of tool cards. Each card contains only a simple icon and tool name. A very short description may be used only if the tool name is not self-explanatory.

Cards should have clear hover, focus, and subtle pressed states. Avoid illustrations, screenshots, decorative backgrounds, gradients, badges, or excessive descriptions.

The grid should scale naturally when future utilities are added.

---

## 11. Tool Workspace

Each utility should primarily behave as **one focused workspace**, not a multi-step wizard.

Workspace hierarchy follows `USER_FLOWS.md` §4. On wider desktop layouts, settings and files may sit beside each other if it improves efficiency. Do not force a two-column layout if the content is clearer stacked.

---

## 12. Drop Zone

The drop zone should be immediately recognizable, generous enough to drag files into easily, visually quiet when inactive, and clearly highlighted during drag-over.

Default content should remain concise (`Drop images here` / `Browse Files`). Special requirements can appear beneath it in muted text.

Avoid illustrations or oversized upload icons.

---

## 13. File List

Batch workflows should use a compact list or restrained grid.

Prioritize: filename, file type, dimensions (when relevant), size, status, remove action.

Use truncation for long filenames rather than allowing layout breakage. Processing, success, and failure status should be visible without dominating the row.

Do not turn the file list into an asset-management interface.

---

## 14. Settings Panels

Settings should be calm and easy to scan. Group related controls with spacing, short labels, and subtle separators when needed.

Avoid enclosing every setting in its own card.

Common settings remain visible. Secondary options (resizing) may be collapsed or visually subordinate. Do not expose advanced encoder parameters simply because the processing library supports them.

---

## 15. Controls

Use familiar desktop interaction patterns.

### Buttons

- Primary action: clear dark/filled neutral treatment in light mode, strong but not oversized.
- Secondary actions: outline or subtle neutral surface.
- Destructive actions: restrained semantic treatment.
- Avoid having several equally prominent buttons.

### Sliders

The compression quality slider should clearly associate the quality value, slider control, and any result feedback. Result feedback should be visually secondary to the control itself.

### Toggles / Checkboxes

Use checkboxes for lists of independent inclusions (e.g. Logo Pack assets). Use switches only for genuine on/off settings. Do not substitute pills for every selection control.

---

## 16. Processing State

Processing should remain within the workspace rather than taking over the entire application.

Show current progress and completed/total count. Use subtle motion only where it improves state awareness. Avoid full-screen loading screens for normal operations.

---

## 17. Completion State

Completion should feel satisfying but restrained.

Use strong typography for the useful result, not celebratory graphics. No confetti, oversized success illustrations, or excessive animations.

---

## 18. Error States

Errors should be local and actionable. Prefer inline messages on the affected row/control over generic modal errors.

Use semantic color sparingly around the error icon, affected row/control, and concise message. Do not tint entire screens red.

---

## 19. Motion

Motion should be subtle and functional.

Appropriate uses: hover/press feedback, expanding secondary settings, drag-over transition, progress updates, lightweight state transitions.

Keep animations short and unobtrusive. Avoid decorative looping animation, bouncing elements, elaborate page transitions, or spring-heavy motion for basic controls.

---

## 20. Icons

Use one consistent icon family. Icons should be simple, recognizable, similar stroke weight, and visually secondary to labels.

Tool cards should use icon + name rather than custom illustrations. Do not mix multiple icon styles.

---

## 21. Spacing and Layout

Use a consistent spacing system rather than arbitrary values.

Prioritize clear section separation, compact grouping within a section, aligned controls, and predictable margins.

The app should remain comfortable at common desktop window sizes. Avoid designing only for maximized/full-screen usage.

---

## 22. Anti-Patterns

Do not generate a stereotypical AI-designed interface.

Avoid: gradients, glassmorphism, glowing borders, random purple/blue accents, excessive pill-shaped elements, giant hero typography, decorative blobs, arbitrary card grids, a card around every piece of content, too many badges, excessive rounded nesting, oversized icons, generic abstract illustrations, unnecessary charts/statistics, fake dashboard metrics, verbose helper copy, multiple competing CTAs, excessive dividers, needless animation, decorative elements with no functional role.

If an element does not improve comprehension, hierarchy, feedback, or task completion, remove it.

---

## 23. Design Success Test

The UI direction is successful if:

- The purpose of every screen is immediately obvious.
- The next primary action is easy to identify.
- A normal task requires little reading.
- Batch file information remains easy to scan.
- The interface feels calm after extended use.
- Light and dark modes avoid harsh contrast.
- Adding more utilities does not make the launcher visually chaotic.
- The product feels polished without feeling overdesigned.
- Visual styling never slows down the underlying utility workflow.
