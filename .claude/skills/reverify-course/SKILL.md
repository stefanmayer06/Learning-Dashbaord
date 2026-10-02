---
name: reverify-course
description: Re-check a Margin course's claims ledger against current sources and update stale or superseded facts (especially "current landscape" units). Use when the user asks to refresh, update, re-verify or fact-check an existing course, or when validation reports stale claims.
---

# Re-verify a course

Landscape facts go stale: roadmaps slip, preprints get published (or rebutted), records fall.

1. `npm run validate:strict -- <course-id>` lists claims older than 180 days.
2. `npm run check-sources -- <course-id>` finds dead links and title drift.
3. For each claim (start with `estimate` and `contested`, then landscape `verified` ones):
   - Re-open the primary source. Has it been corrected, published, retracted or superseded?
   - Search for newer primary results on the same question (e.g. new resource estimates,
     classical rebuttals of advantage claims, final versions of draft standards).
   - Update `text`, `status`, `sources`, `note` and `checkedOn`. If a preprint was published,
     add the journal version and consider upgrading `contested` → `verified`.
4. Update lessons that cite changed claims — narration, quiz explanations, recap cards, labs.
   Search with `grep -rn '"<claim-id>"' content/courses/<course-id>/lessons`.
5. Bump `course.version` (minor for new facts, patch for corrections) and `lastVerified`.
6. Run `npm run validate:strict && npm test && npm run test:e2e`, then summarise what changed
   and why, citing the new sources.
