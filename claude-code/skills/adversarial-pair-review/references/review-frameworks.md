# Review Frameworks

## Steelman

Ask:

- What problem does this solve well?
- What constraints does it respect?
- Under what conditions is this the right choice?
- What would make this succeed?

## Skeptic

Ask:

- This shipped and failed in three months. What happened?
- What assumption has to be true?
- What happens under load, concurrency, missing data, or partial failure?
- What is the cheapest validation that could disprove this?
- What did the agent accept from the prompt without questioning?

## Judge

Classify:

- `ship`: critique found no material issue.
- `ship-with-changes`: approach is sound, fixes are required.
- `rethink`: core assumption or architecture is wrong.

Prioritize user impact, data safety, security, reversibility, and cost.
