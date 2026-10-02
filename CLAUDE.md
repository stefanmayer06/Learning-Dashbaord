# Margin — notes for Claude

A private learning platform. Courses are JSON content in `content/courses/<id>/`, rendered as
narrated motion-graphics "reels", interactive labs, checks and work outputs. Every factual
claim lives in a per-course ledger with sources and dates, and the build refuses to pass if a
citation is broken.

## Commands

```bash
npm run dev               # http://localhost:5173 (local mode: progress in localStorage)
npm run build             # validate content, then production build to dist/
npm run validate          # content schema + citations + cross-references
npm run validate:strict   # also fails on uncited numbers/dates and stale claims (>180 days)
npm run check-sources     # online: every source URL answers; arXiv/Crossref titles match
npm test                  # unit tests (maths, validator, model, every course in strict mode)
npm run test:e2e          # Playwright: every page and every lesson step renders; learner flow
npm run test:db           # applies supabase/migrations to a throwaway Postgres and tests RLS
npm run typecheck
npm run new:subject -- <id> "Title"   # scaffold a course from content/courses/_template
npm run schema            # regenerate content/schema/*.json from the zod model
node scripts/screenshot.mjs <url> <out.png> [w] [h] [full]   # visual QA (MARGIN_SEED=state.json to seed progress)
```

## Adding or updating courses

- New subject: follow `.claude/skills/add-subject/SKILL.md` exactly (research → ledger →
  lessons → validate → screenshot QA → report).
- Refreshing facts: `.claude/skills/reverify-course/SKILL.md`.
- Content model: `src/content/schema.ts` (zod). Validation rules: `src/content/validate.ts`.
- Fact-checking policy (enforced): news never solely supports a claim; contested claims explain
  the dispute; preprint-only claims cannot be `verified`; numbers in narration/explanations need
  a citation (strict); `course.lastVerified` ≥ every claim's `checkedOn`.
- Never invent a source, a URL, a DOI or a quotation. If you can't verify something, cut it,
  soften it, or mark it `estimate`/`contested` with a note — and tell the user.

## Architecture

```
content/courses/<id>/        course.json · sources.json · claims.json · lessons/*.json
content/courses/_template/   scaffold for new subjects (ignored by the app)
src/content/                 schema (zod), validator (shared by app + scripts), loader (import.meta.glob)
src/engine/reel/             the video engine: timeline, narrator (Web Speech API), shots, player
src/plugins/                 manifest (names, no React) · registry (components) · types
src/plugins/quantum/         subject plugin: statevector sim, finance maths, portfolio QUBO/QAOA, labs, shots
src/widgets/                 generic interactives (card-sort, sequence, estimator)
src/steps/                   quiz, deliverable, recap, embed renderers
src/store/                   learner model (pure rules + merge), LearnerProvider, optional Supabase sync
src/pages/                   routes; lesson-only code is lazy-loaded
src/styles/                  tokens.css (light/dark) · base · shell · catalog · course · player · labs · pages
supabase/                    migrations (RLS), config.toml, tests (plain Postgres + auth stub)
```

## Conventions

- Design language: clear MOOC style (Coursera/edX/Udemy conventions) — spec in
  `docs/design-system.md`. White pages, light-grey bands, one primary blue for actions, 8–12px
  radii, shadows only on hover/sticky. Schibsted Grotesk for all UI text; Martian Mono only for
  figures/code; Gloock only for the wordmark and certificate. Custom glyphs in `src/ui/Glyph.tsx`
  (no icon libraries). Colours only via tokens in `src/styles/tokens.css`; CSS is split by area
  (base, shell, catalog, course, player, labs, pages, reel).
- Reel shots are pure functions of progress `p` (0..1) on a 1280×720 stage; keep content above
  y≈560 so captions never cover it.
- Maths lives in pure modules with unit tests against known values (Black–Scholes 10.4506,
  Grover closed form, Qiskit cross-check for the simulator).
- The app works fully offline/local; Supabase is optional and only stores learner data.
