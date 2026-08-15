# Utility Desktop Agent Rules

## Read only what the task needs

- Product scope: `docs/PRD.md`.
- Architecture or implementation: relevant sections of `docs/ARCHITECTURE.md`.
- UI work: `docs/UI_GUIDELINES.md` and the relevant flow in `docs/USER_FLOWS.md`.
- Follow a task brief when the user names one; do not treat completed briefs as current-state docs.
- Source code, configuration, and tests own exact implementation details.

## Implementation boundaries

- Keep the app local-first. Do not upload user files or add network processing without explicit approval.
- Never modify source files in place; outputs must remain non-destructive.
- Frontend components own interaction state. Processing goes through the typed Tauri service boundary.
- Each utility exports a `ToolDefinition` and is registered statically.
- Prefer local React state and the existing settings context; add dependencies only when they materially simplify the requested work.
- Preserve the Figma-derived visual system, intentional behavior, and unrelated user changes.

## Verification

- Run checks proportional to the change; frontend implementation should at least pass `npm run build`.
- Leave the final visual smoke test to the owner unless they explicitly ask the agent to perform it.
- Provide a short owner checklist for UI changes and never claim unperformed visual acceptance.
- Report native Tauri checks separately from browser/frontend checks.

## Documentation

- Update active docs only when current product behavior or a durable decision changes.
- After successfully completing and validating a task, add one concise task-grouped entry to `CHANGELOG.md`.
- Use `## Task Name — YYYY-MM-DD` with up to three bullets: `Changed`, optional `Decision`, and `Verified`.
- Keep commands, file inventories, implementation steps, and detailed test logs out of the changelog.
