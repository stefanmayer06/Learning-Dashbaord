---
name: add-subject
description: Create a new, fully fact-checked course (subject) for the Margin learning platform in content/courses. Use whenever the user asks to add, commission or build a course, module or subject — including when they paste a brief from the site's Commission page.
---

# Add a subject to Margin

A course is a folder of JSON in `content/courses/<course-id>/`. No app code is needed unless the
subject wants a new kind of interactive. The bar is: **every factual statement is sourced, dated
and machine-checked**, and the course is **watched and played more than read**.

Work in this order. Don't write lessons before the ledger exists.

## 0. Understand the brief

From the user's brief, pin down: the job the knowledge should do, their level, the time budget,
and the work output they want to finish with. If something essential is missing and you cannot
infer a sensible default, ask once; otherwise state your assumptions in the final summary.

## 1. Scaffold

```bash
npm run new:subject -- <course-id> "Course Title"
```

Ids are lowercase-kebab-case. Step ids must be unique across the whole course — prefix them
(e.g. `vt3-reel`).

## 2. Research first, then build the ledger

Use web search and fetch. For each fact you intend to teach:

1. Find the **primary** source and read it (not a summary of it):
   peer-reviewed paper (`paper`), official company/lab announcement (`official`), regulator
   (`regulator`), standards body (`standard`), documentation (`docs`), textbook (`book`).
   Preprints are `preprint`. News is `news` and may corroborate but **never stand alone**.
2. Quote numbers from the **published** version of a paper; preprint drafts often differ
   (example: the derivative-pricing threshold paper went from 7.5k to 8k logical qubits).
3. Add the source to `sources.json` (with `doi` / `arxiv` when they exist — the checker
   cross-references them) and the claim to `claims.json`, worded to match the source.
4. Pick the status honestly:
   - `verified` — matches a non-preprint primary source.
   - `derived` — follows by mathematics/standard theory; cite the textbook or derivation.
   - `estimate` — a projection, roadmap or resource estimate. Say so in the text.
   - `contested` — the primary source says it but credible parties dispute it, or it rests
     only on preprints. **Must** have a `note` explaining the dispute.
5. Date everything (`accessed`, `checkedOn`) and set `course.lastVerified` to the newest check.

Then run the online check — it tests every URL and compares arXiv/Crossref titles:

```bash
npm run check-sources -- <course-id>
```

Fix mismatches. If a site blocks bots (HTTP 403) and has no DOI, open it with your fetch tool,
confirm the content, and prefer an equivalent URL that answers (e.g. the company newsroom
instead of a filing portal).

For anything quantitative you show in a lab or chart, **compute it** (or run the code) rather
than typing numbers from memory. Code shown in reels must be code you actually ran, with the
real output in the comment.

## 3. Shape the course

- Units go **orientation → theory → practice → current landscape → capstone** (the `strand`
  field labels them; strands named Theory, Practice, Landscape, Capstone, Orientation get colours).
- 1–3 lessons per unit, 10–35 minutes each. `hours` should roughly match the sum.
- Each lesson: open with a **reel**, then a **lab or sort**, then a **check** (quiz). Add a
  **deliverable** step whenever the learner should produce something.
- Define `outputs` in `course.json`: at least one per practice unit is ideal, and exactly one
  `capstone: true` output that pulls together saved lab results (`capture` fields) and writing.
- Landscape units must carry dates ("checked …") and separate demonstrated results from
  estimates and contested claims. Include a "read the headline critically" exercise.

## 4. Write reels (the "videos")

A reel is a list of shots; each has `narration` (spoken + captioned) and optional `cite`.
Durations are estimated from narration, so keep each narration to 1–3 sentences (≈ 15–40 words).
8–11 shots ≈ 2 minutes. Shot kinds (see `src/content/schema.ts`):

| kind | use for |
|---|---|
| `title` | opening card (`kicker`, `title` with `\n`, `subtitle`) |
| `statement` | one idea, words light up as spoken; `**emphasis**`, `$tex$` |
| `equation` | KaTeX lines + lettered notes |
| `bars` | values morphing between frames (`signed` for amplitudes) |
| `chart` | line series drawing in (`logX`/`logY`, annotations) |
| `list`, `compare` | enumerations, before/after |
| `timeline` | dated events; the camera pans |
| `stat` | one big number counting up |
| `code` | code typing out, then `focus` line groups |
| `diagram` | nodes (x/y in %) and arrows |
| `quote` | verified quotations only — check the exact wording in the source |
| `plugin` | subject-specific shots registered in `src/plugins/registry.tsx` |

Rules: any shot narration containing a number, year or percentage must `cite` a claim (strict
validation enforces this). Start each reel with a `chapter`. Don't put walls of text on screen.

## 5. Labs and checks

Generic widgets any subject can use (props documented in `src/plugins/manifest.ts`):
`card-sort`, `sequence`, `estimator`. Subject plugins (e.g. the quantum labs) live in
`src/plugins/<subject>/`. To add one:

1. Build the component against `WidgetApi` (`src/plugins/types.ts`); call `complete()` when the
   learner meets the goal; call `capture(summary, payload)` if the result feeds a deliverable.
2. Register it in `src/plugins/registry.tsx` **and** describe it in `src/plugins/manifest.ts`.
3. Put the maths in a pure module and unit-test it against known values (see
   `tests/unit/quantum.test.ts`, which also cross-checks the simulator against Qiskit).

Quizzes: `single`, `multi`, `numeric` (with `tolerance`), `order`. Every `explain` teaches, and
cites a claim when it states a fact. Mark synthetic data as synthetic wherever it appears.

## 6. Validate and look at it

```bash
npm run validate:strict      # schema, cross-references, citations, uncited numbers, staleness
npm test                     # includes strict validation of every course + caption sizing
npm run test:e2e             # renders every step of every lesson in Chromium
npm run dev                  # then open the course
node scripts/screenshot.mjs http://localhost:5173/c/<course-id> /tmp/shot.png
```

Read the screenshots. Fix overlaps, overflow and anything that reads like filler.

## 7. Report

Summarise for the user: units and lessons, outputs, number of claims by status, anything you
could not verify (and how you handled it — removed, softened, or marked estimate/contested).
Never claim something is verified that you did not check.
