---
description: Codex backend workflow for APIs, services, data models, algorithms, jobs, and server-side verification.
---

# Backend Workflow

Use this recipe through:

```bash
~/.codex/scripts/codex-prompt multi-backend "<backend task>"
```

## Workflow

1. Inspect the backend.
   - Locate routes/controllers/services/models/schemas/jobs/tests with `rg --files` and `rg`.
   - Read dependency injection, config, validation, auth, database, and error-handling patterns.

2. Plan the change.
   - Define the contract: inputs, outputs, errors, auth, persistence, and side effects.
   - Identify migrations, data backfills, and compatibility concerns.
   - Choose tests before implementation.

3. Implement.
   - Use `apply_patch`.
   - Keep changes local to the relevant module.
   - Preserve existing public API behavior unless the task explicitly changes it.

4. Verify.
   - Run unit tests for touched logic.
   - Run integration/API tests when routes, persistence, auth, queues, or external services are involved.
   - Run build/typecheck/lint as appropriate.

5. Review.
   - Run `~/.codex/scripts/codex-review --wait --scope working-tree`.
   - For high-risk backend work, run `~/.codex/scripts/codex-adversarial-review --wait --scope working-tree "backend correctness, security, performance, failure modes"`.

## Output

Report changed files, API/data behavior, verification results, and unresolved risks.
