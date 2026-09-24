---
name: ats-optimize
description: Audit and fix a resume so it survives ATS parsing (Workday, Greenhouse, Lever, iCIMS, Taleo) and matches a target job description. Use when the user asks to make a resume "ATS-friendly," tailor a resume to a job posting, debug why applications get auto-rejected, or fix a LaTeX/DOCX/PDF resume's structure. Works on the resume document itself — not on autofill browser extensions.
---

# ATS Optimize

Optimize a resume for the two independent things an ATS does: **parse** the file into structured
database fields, and **score** the extracted text against a job requisition. Both operate on
extracted text, never on the visual PDF — so the whole method is "check what the extractor sees,
then fix that."

## When to Activate

- "Is my resume ATS-friendly?" / "Why am I getting auto-rejected?"
- Tailoring a resume to a specific job description
- Reviewing or rewriting a LaTeX resume template (`.tex`), DOCX, or PDF
- User is applying through Workday/Greenhouse/Lever/iCIMS/Taleo and wants the file to survive

Not for: autofill extensions (Simplify, Huntr, JobWizard). Those fill web form fields and never
touch the document — a separate problem.

## Hard Rules

- **Never add hidden or invisible text** (white-on-white, zero-opacity, off-page keyword stuffing).
  Detected by Workday/Greenhouse/Lever as of 2026 and can attach a fraud flag to the candidate
  record. Refuse this even if the user asks directly, and say why.
- **Never invent metrics, titles, dates, employers, or skills.** Only reword, restructure, and
  surface what the user actually has. If a bullet needs a number, ask the user for it.
- **Never edit the user's resume source in place without a backup or clean git state.**

## Workflow

### Step 1 — Gather inputs

Establish before touching anything:

1. **The resume source** — `.tex` (best case: editable source), `.docx`, or PDF-only. Ask for the
   source file if only a PDF exists; edits to a PDF alone are far weaker.
2. **The target job description**, if there is one. Without a JD, Step 4 degrades to generic
   keyword hygiene — say so rather than pretending to tailor.
3. **The target company/platform**, if known. This only changes the file-format recommendation
   (see Step 6); the structural rules are the same either way.

### Step 2 — Extract the ground truth

Never audit the resume by looking at it. Audit what the parser sees:

```bash
# PDF (the authoritative check — this is closest to what the ATS extractor does)
pdftotext -layout resume.pdf -          # visual reading order
pdftotext resume.pdf -                  # raw stream order, exposes column scrambling

# DOCX
textutil -convert txt -stdout resume.docx     # macOS
# or: unzip -p resume.docx word/document.xml | sed 's/<[^>]*>//g'
```

If `pdftotext` is missing: `brew install poppler`.

Read the extracted text top to bottom and record concretely:

- Is contact info present, or did it vanish (header/footer or icon-only)?
- Do lines from different columns interleave?
- Are section headers intact and in order?
- Are dates, employers, and titles adjacent to the right bullets?
- Is anything garbled, duplicated, or missing entirely?

**Whatever is broken here is broken in the ATS.** This extraction is the evidence base for every
finding in Step 3 — cite it, don't assert from the visual layout.

### Step 3 — Structural audit

Read `references/ats-parsing-rules.md` now. It carries the per-platform parser behavior, the
formatting rules that generalize across platforms, and the LaTeX-specific rules.

Audit the extraction from Step 2 and the source file against those rules. Report findings as a
short list, each with: what's wrong → the evidence in the extracted text → the fix. Order by
severity (things that lose data first, cosmetic last).

Default to **Workday/Taleo-level strictness** — a resume that survives those survives everything
else. Don't tune for one platform in a way that breaks another.

### Step 4 — Keyword audit (when a JD is available)

Matching is mostly **literal string matching**, not semantic. So:

1. Pull the hard requirements out of the JD verbatim — tools, languages, frameworks, certifications,
   methodologies, and the exact phrasings used for them.
2. Diff against the extracted resume text (Step 2, not the source — a keyword that doesn't extract
   doesn't count).
3. For each miss, decide honestly:
   - **Have it, worded differently** → adopt the JD's exact term, keeping the user's phrasing too
     where both read naturally ("CI/CD pipelines" alongside "continuous integration").
   - **Have it, but buried in one narrative bullet** → also surface it in the skills list. A
     dedicated skills section is weighted as a concentrated competency zone.
   - **Don't have it** → say so plainly and leave it out. Do not pad.
4. Check acronym/spelled-out coverage for ambiguous terms (`ML (Machine Learning)` once each).

Content mismatch causes more rejections than formatting does. Structure alone is necessary but not
sufficient — this step carries at least as much weight as Step 3.

### Step 5 — Apply fixes and re-verify

Back up the source first (`cp resume.tex resume.tex.bak`, or confirm a clean git state).

Apply the Step 3 and Step 4 fixes to the **source file**. Preserve the user's voice and existing
formatting conventions; this is a targeted repair, not a rewrite, unless the user asked for a
rewrite.

Then verify — this is mandatory, not optional:

```bash
pdflatex -interaction=nonstopmode resume.tex   # LaTeX only
pdftotext -layout resume.pdf -                 # re-extract
```

Re-read the new extraction end to end and confirm every Step 3 finding is actually resolved.
`diff` the before/after extractions to catch anything the fix broke in passing. If a fix didn't
land in the extracted text, it didn't land at all — iterate, don't report success.

### Step 6 — Report

Give the user:

- What was broken and what the parser was doing with it (quote the extraction)
- What changed
- **Format recommendation:** PDF is fine for Workday/Greenhouse/Lever/iCIMS in 2026 when it's a
  clean, text-selectable, single-column PDF. Use DOCX if the posting explicitly asks for Word, or
  if the employer runs Taleo.
- Any remaining gaps the user must decide on — real skill gaps against the JD, missing metrics they
  need to supply, claims only they can confirm.

## Reference Files

- `references/ats-parsing-rules.md` — per-platform parser behavior (Workday, Greenhouse, Lever,
  iCIMS, Taleo, HackerRank), cross-platform formatting rules, LaTeX-specific rules, and
  content/keyword rules. Load at Step 3.
