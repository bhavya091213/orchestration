---
name: continuous-learning
description: Automatically extract reusable patterns from Codex sessions and save them as learned skills for future use.
origin: ECC
---

# Continuous Learning Skill

Automatically evaluates Codex sessions on end to extract reusable patterns that can be saved as learned skills.

## When to Activate

- Setting up explicit pattern extraction from Codex session transcripts
- Configuring a git hook, workflow script, or manual session-end check
- Reviewing or curating learned skills in `~/.codex/skills/learned/`
- Adjusting extraction thresholds or pattern categories
- Comparing v1 (this) vs v2 (instinct-based) approaches

## How It Works

This skill can run as an explicit session-end check:

1. **Session Evaluation**: Checks if session has enough messages (default: 10+)
2. **Pattern Detection**: Identifies extractable patterns from the session
3. **Skill Extraction**: Saves useful patterns to `~/.codex/skills/learned/`

## Configuration

Edit `config.json` to customize:

```json
{
  "min_session_length": 10,
  "extraction_threshold": "medium",
  "auto_approve": false,
  "learned_skills_path": "~/.codex/skills/learned/",
  "patterns_to_detect": [
    "error_resolution",
    "user_corrections",
    "workarounds",
    "debugging_techniques",
    "project_specific"
  ],
  "ignore_patterns": [
    "simple_typos",
    "one_time_fixes",
    "external_api_issues"
  ]
}
```

## Pattern Types

| Pattern | Description |
|---------|-------------|
| `error_resolution` | How specific errors were resolved |
| `user_corrections` | Patterns from user corrections |
| `workarounds` | Solutions to framework/library quirks |
| `debugging_techniques` | Effective debugging approaches |
| `project_specific` | Project-specific conventions |

## Codex Setup

Codex does not assume Claude-style lifecycle hooks. Run the evaluator manually or wire it into a local workflow script/git hook that passes a JSON payload with `transcript_path`:

```bash
printf '{"transcript_path":"%s"}\n' "$CODEX_TRANSCRIPT_PATH" \
  | ~/.codex/skills/continuous-learning/evaluate-session.sh
```

If no transcript path is available, write a concise session summary to `~/.codex/memory/` instead and manually promote repeated patterns into a learned skill.

## Why Session-End Evaluation?

- **Lightweight**: Runs once after work is done
- **Non-blocking**: Doesn't add latency to every message
- **Complete context**: Can use a transcript or a written session summary

## Related

- [The Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - Section on continuous learning
- `/learn` command - Manual pattern extraction mid-session

---

## Comparison Notes (Research: Jan 2025)

### vs Homunculus

Homunculus v2 takes a more sophisticated approach:

| Feature | Our Approach | Homunculus v2 |
|---------|--------------|---------------|
| Observation | explicit session-end check | event adapters or git/workflow hooks |
| Analysis | Main context | Background agent (low-effort Codex profile) |
| Granularity | Full skills | Atomic "instincts" |
| Confidence | None | 0.3-0.9 weighted |
| Evolution | Direct to skill | Instincts → cluster → skill/command/agent |
| Sharing | None | Export/import instincts |

**Key insight from homunculus:**
> v1 relied on skills to observe. In Codex, prefer explicit scripts or workflow adapters for observation and use instincts as the atomic unit of learned behavior.

### Potential v2 Enhancements

1. **Instinct-based learning** - Smaller, atomic behaviors with confidence scoring
2. **Background observer** - low-effort Codex profile agent analyzing in parallel
3. **Confidence decay** - Instincts lose confidence if contradicted
4. **Domain tagging** - code-style, testing, git, debugging, etc.
5. **Evolution path** - Cluster related instincts into skills/commands

See: `docs/continuous-learning-v2-spec.md` for full spec.
