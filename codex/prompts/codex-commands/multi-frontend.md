---
description: Codex frontend workflow for UI, React/Next.js components, styles, accessibility, and E2E checks.
---

# Frontend Workflow

Use this recipe through:

```bash
~/.codex/scripts/codex-prompt multi-frontend "<UI task>"
```

## Workflow

1. Inspect the existing frontend system.
   - Find routes/components/styles with `rg --files`, `rg`, and targeted reads.
   - Identify the design system, component library, icon library, test setup, and existing layout patterns.

2. Plan the UI change.
   - Prefer existing components and conventions.
   - Define responsive behavior, loading/empty/error states, accessibility, and keyboard interaction.
   - Avoid marketing-style layouts for operational tools unless the app is actually a landing page.

3. Implement.
   - Use `apply_patch`.
   - Keep visual changes consistent with surrounding UI.
   - Use stable layout constraints so text and controls do not overlap.

4. Verify.
   - Run relevant typecheck/lint/test commands.
   - For browser-facing changes, run or add Playwright checks when available.
   - If a dev server is needed, start it and inspect the result.

5. Review.
   - For normal frontend review: `~/.codex/scripts/codex-review --wait --scope working-tree`.
   - For UX/design challenge: `~/.codex/scripts/codex-adversarial-review --wait --scope working-tree "frontend UX, accessibility, responsive layout"`.

## Output

Report changed files, visual behavior, verification results, and any remaining UI risks.
