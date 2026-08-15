# Desktop Utility Toolbox

Planning documents for the desktop utility app.

## Documents

| Document | Owns |
|---|---|
| `PRD.md` | Product scope, goals, V1 features, boundaries |
| `USER_FLOWS.md` | User journeys, screen states, UX principles |
| `UI_GUIDELINES.md` | Visual direction, interaction styling |
| `ARCHITECTURE.md` | Implementation structure, technical boundaries |

Each document owns its concern and cross-references the others. Product decisions live in PRD; interaction sequences live in USER_FLOWS; visual direction lives in UI_GUIDELINES; implementation details live in ARCHITECTURE. Avoid duplicating facts across documents.

## How to Use These Docs

Treat these documents as the current shared baseline for design and implementation, not as immutable specifications.

Preserve the product intent, V1 scope, and important constraints, but reasonable deviations are encouraged when implementation reveals a clearly simpler, safer, more maintainable, or otherwise materially better approach.

When deviating:

- Keep the change consistent with the product goals.
- Avoid unnecessary scope expansion or complexity.
- Update the affected documentation when the decision materially changes the agreed design.
- Prefer practical improvements over blindly following an outdated detail.

If documents conflict, resolve the conflict based on product intent and the most relevant source, then update the docs so they remain consistent.
