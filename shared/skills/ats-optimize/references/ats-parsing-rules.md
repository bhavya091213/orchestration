# ATS Parsing Rules Reference

Loaded by SKILL.md Step 3. Based on how the major ATS platforms and job-search tools actually process an uploaded resume as of mid-2026.

## The core mental model

An ATS is a database with a parsing layer, not a "reader." Two independent things happen on submission:

1. **Parse** — the raw file is run through a text/field extractor to populate structured fields (name, dates, titles, skills) so recruiters can search and filter.
2. **Score/match** — the extracted text (not the visual PDF) is compared against the job requisition for keyword match.

Autofill tools (Simplify Copilot, JobWizard, Huntr, Careerflow) only fill the **web form fields** (name, email, EEO, work history entries) — they do not touch or improve the resume document itself. The uploaded resume is parsed and scored independently by the ATS, verbatim. Optimizing the file is a separate problem from optimizing the autofill experience.

## Per-platform notes

| Platform | Parser strictness | Format preference | Known failure modes |
|---|---|---|---|
| **Workday** | Strictest of the major five; powers ~50% of Fortune 500 careers pages | DOCX parses more consistently than complex PDF; simple single-column PDF is fine | Fails on tables ~100% of the time; struggles with two-column layouts; multi-screen autofill makes failures visible (40+ fields to re-type by hand) |
| **Greenhouse** | More forgiving; common at mid-market/scale-up tech | Handles both PDF and DOCX reliably | Its "Greenhouse AI" summary/match-score reads the parsed text, not the original PDF — so a parsing failure breaks AI scoring too |
| **Lever** | Generally forgiving, common at startups | PDF or DOCX both fine if simple | Same column/table risks as others, just more tolerant |
| **iCIMS** | Historically DOCX-preferring | 2024+ versions parse simple PDFs well | Weaker with complex/design-heavy PDFs |
| **Taleo (Oracle Recruiting)** | Historically the weakest PDF parser of the group | DOCX is the safe default here | PDF text extraction has been unreliable; treat Taleo as the "most conservative formatting" baseline |
| **HackerRank (assessments)** | Resume upload is usually informational, not autofilled into the assessment; separate account/profile fields are used for the coding test itself | PDF fine | Low risk here since HackerRank isn't primarily parsing the resume for screening — the assessment score matters more; still keep the resume clean since some HackerRank-integrated pipelines (via the employer's ATS) do forward it downstream |

**Rule of thumb:** optimize for Workday/Taleo-level strictness by default — a resume that survives those also survives Greenhouse/Lever/iCIMS. Don't optimize for one platform in a way that would break on another (e.g. don't build a Greenhouse-specific two-column "designer" layout).

## Formatting rules that generalize across all platforms

- **Single column only.** No tables, sidebars, or multi-column layouts for content. ATS text extraction reads left-to-right across the page; a two-column resume gets read as scrambled interleaved lines. (Field-level test data: single-column `.docx` has extracted ~97% of seeded fields vs. ~71% for two-column PDF of the same content, per recent parser tests.)
- **Standard section headers:** "Experience" / "Work Experience", "Education", "Skills", "Projects". Not "My Journey," "Toolkit," or similar creative variants — parsers pattern-match on these header strings to segment the document.
- **No graphics, icons, headshots, or text boxes.** Icon-based contact rows (phone/email/LinkedIn glyphs from fontawesome) can extract as empty. Contact info should be plain text in the document body, not header/footer.
- **Dates:** consistent `Mon YYYY – Mon YYYY` format (e.g., `Jun 2024 – Aug 2024`). Avoid bare years, and don't mix "Present"/"Current"/"Ongoing" — pick one word and use it everywhere for ongoing roles.
- **Fonts:** standard sans-serif or serif (Arial, Calibri, Helvetica, Times New Roman, or in LaTeX: Computer Modern / Latin Modern / a well-embedded standard font). Avoid custom/downloaded display fonts.
- **No hidden/invisible text.** Zero-opacity or white-on-white keyword stuffing is actively detected by Workday, Greenhouse, and Lever as of 2026 and can attach a fraud flag to the candidate record. This is a hard no — **never implement this even on request.**
- **File format:** PDF is fine for Workday/Greenhouse/Lever/iCIMS in 2026 as long as it's a clean, text-selectable, single-column PDF. Only default to DOCX if the posting explicitly asks for Word, or if the target company is known to run Taleo.
- **Skills section matters disproportionately.** A dedicated, plain comma-separated or bulleted skills list is weighted as a concentrated, self-declared competency zone — often scored higher than a skill mentioned only once inside a narrative bullet. Keep both: a clean skills list *and* skills in context within bullets.

## LaTeX-specific rules

- Use **pdflatex** unless there's a specific reason to use XeLaTeX/LuaLaTeX (e.g. non-Latin scripts). pdflatex produces standard, reliably text-extractable PDF output. XeLaTeX/LuaLaTeX are fine if fonts are properly embedded via `fontspec`, but they're a more common source of extraction problems when misconfigured.
- Required preamble packages for encoding: `\usepackage[T1]{fontenc}` and `\usepackage[utf8]{inputenc}` (redundant under XeLaTeX/LuaLaTeX's native UTF-8, but required under pdflatex).
- Avoid `multicol`, side-by-side `minipage`s, or `tabular`/`tabularx` used for whole-section layout (e.g. skills-in-a-grid, or a sidebar for contact info). Small in-line tables for something like a single-row date range are lower risk but still avoid if possible.
- Avoid `fontawesome`/`fontawesome5` glyphs as the *sole* representation of contact info (phone/email/LinkedIn/GitHub icons with no adjacent text). If icons are kept for visual design, always pair them with actual text of the same information.
- **Common risky templates:** two-column `moderncv` themes, Awesome-CV's default two-column layout, any template with a colored sidebar. These are visually strong for humans but are the templates most likely to scramble in Workday/Taleo. A single-column variant is usually available.
- **Verification is mandatory, not optional:** compile with `pdflatex`, run `pdftotext -layout` on the result, and read the extracted text top to bottom. If the order is wrong or content is missing/garbled there, it will be wrong or missing in the ATS too — this is the same failure mode.

## Content/keyword rules

- Prefer **exact-term matches** to the job description over paraphrases — most ATS keyword matching is literal string matching, not semantic. If the JD says "CI/CD" and the resume says "continuous integration pipelines," use both forms where natural.
- Include both the acronym and the spelled-out form at least once each for ambiguous terms (e.g., "ML (Machine Learning)" on first use) since some parsers search for one form only.
- Quantify impact where the user has real numbers; **never invent metrics.**
- Formatting failures account for a meaningful minority of ATS rejections, but the larger share is content/keyword mismatch — fixing structure alone is necessary but not sufficient; the Step 4 keyword audit matters as much as Step 3's structural audit when a JD is available.
