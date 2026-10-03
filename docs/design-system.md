# Margin design system (v2: "clear MOOC")

Margin used to look like a printed exercise book: paper, ink, a red margin rule, serif
display type and mono labels. It looked distinctive but read as unfamiliar. v2 moves to the conventions
learners already know from **Coursera**, **edX** and **Udemy**, so the next action is always obvious,
and keeps a small, recognisable Margin identity.

References studied (October 2026): Coursera home, search and course pages; edX home, catalog
and course pages (HarvardX CS50). Udemy blocked automated capture with a Cloudflare challenge;
we did not bypass it. Udemy and in-course player conventions therefore come from public knowledge
of those products, not screenshots.

## Principles

1. **One obvious next step.** Every screen has one filled primary button: Begin, Resume, Continue,
   Issue certificate. Everything else is secondary (outline) or a text link.
2. **Familiar anatomy.** Breadcrumbs → big bold title → stats row → primary CTA (Coursera/edX).
   "What you'll learn" checklist, a "Course content" accordion with module meta, and a sticky side
   card with progress. Inside a lesson, a left course outline plus the content (Coursera's player).
3. **Plain words.** Sentence-case labels in the UI face, not uppercase mono. Step types use MOOC
   names: Video, Lab, Quiz, Assignment, Recap, Tool.
4. **Calm surfaces.** White page, light-grey bands, 1px borders, 8–12px radii, soft shadow only on
   hover or sticky elements. One saturated colour (primary blue) for actions; status colours only
   for status.
5. **Numbers are mono, words are not.** Martian Mono is kept for figures in labs, timers, code and
   credential IDs only.
6. **Fact-checking stays visible.** A "Fact-checked" badge links to the ledger; sources for what's on
   screen sit in a tab right under the lesson content.
7. **Accessible by default.** AA contrast or better, a visible focus ring (3px primary halo),
   44px touch targets, keyboard operable, readable at 360px.

## Identity, kept in small doses

- Wordmark "Margin" in **Gloock** with a small red square dot (`.wordmark`).
- A 3px **brand-red rule** across the very top of the app (the old margin rule turned horizontal).
- Gloock also stays on the **certificate**. Nowhere else.
- Custom glyphs (`src/ui/Glyph.tsx`), with no icon library. Generative course covers (`src/ui/Cover.tsx`)
  serve as course thumbnails.

## Tokens (`src/styles/tokens.css`)

| Role | Light | Dark | Notes |
|---|---|---|---|
| `--bg` page | `#ffffff` | `#0e1116` | |
| `--bg-subtle` bands, sidebar | `#f5f6f8` | `#151920` | |
| `--bg-tint` hero band | `#eef2fd` | `#141b2e` | Coursera-style pale blue |
| `--surface` cards | `#ffffff` | `#171b22` | |
| `--surface-sunken` wells, tracks | `#f0f2f5` | `#12161c` | |
| `--border` | `#dfe3e9` | `#2a313b` | |
| `--border-strong` outline buttons, decorative edges | `#c3cad4` | `#3c4552` | |
| `--border-input` form-control edges | `#7d8695` | `#6b7586` | 3.7:1 / 3.7:1 (WCAG 1.4.11) |
| `--track` unfilled progress tracks | `#dfe3e9` | `#2f3742` | visible on bands and cards |
| `--text` | `#16191d` | `#e9ecf1` | 17.6:1 / 15.6:1 |
| `--text-muted` | `#4b5563` | `#b3bbc7` | 7.6:1 / 9.6:1 |
| `--text-subtle` meta | `#5f6775` | `#8f98a5` | 5.8:1 / 6.3:1 |
| `--primary` text, links, icons | `#2442d6` | `#8fa2ff` | 7.4:1 / 7.6:1 |
| `--primary-bg` filled buttons | `#2442d6` | `#3d57e6` | white text 7.4:1 / 5.7:1 |
| `--primary-hover` | `#1b35b3` | `#4f69f2` | |
| `--primary-soft` tints, selected | `#e9edfc` | `#1d2647` | |
| `--success` / `--success-soft` | `#1d7a4c` / `#e5f3eb` | `#5cc08a` / `#12291d` | |
| `--warning` / `--warning-soft` | `#92560a` / `#fdf1dc` | `#e3a64e` / `#2f2412` | |
| `--danger` / `--danger-soft` | `#c0352b` / `#fbe9e7` | `#f07c6c` / `#33171a` | |
| `--brand-red` | `#d63a26` | `#f0563c` | wordmark dot, top rule only |
| `--theatre*` video area | `#0b0d11`, `#161a21`, ink `#eef1f5`, faint `#8b93a1` | same | |
| `--focus-shadow` focus ring | 2px gap in `--bg`, then 2px `--primary` | same | ≥7:1; never a translucent halo |
| `--range-accent` slider accent | `--primary-bg` | `#8fa2ff` | a light accent makes Chromium draw a dark track |

Print always uses the light palette (`@media print` in `tokens.css`).

Claim statuses: **verified** uses success, **derived** uses primary, **estimate** uses warning,
**contested** uses danger.

`--accent` is still set per course (`course.theme.accent`) and drives covers and lab visuals.
Labs read it as text through `--accent-fg`, which is lifted in dark mode.

Legacy names (`--paper`, `--ink`, `--ink-soft`, `--ink-faint`, `--rule`, `--rule-soft`, `--sheet`,
`--paper-deep`, `--margin-red`, `--good`, `--warn`, `--bad`) are **aliases** of the new tokens, so
older lab, chart and reel code keeps working. New code uses the new names.

**Type.** `--font-ui` is Schibsted Grotesk Variable (everything). `--font-display` is Gloock
(wordmark and certificate only). `--font-mono` is Martian Mono (numbers and code only).

| Class | Size / line | Weight | Use |
|---|---|---|---|
| `.t-display`, `.display-xl` | clamp(36,5vw,56) / 1.08 | 800, -0.02em | home hero |
| `.display-l` | clamp(32,4.2vw,48) / 1.1 | 800 | course title |
| `.display-m`, `.t-h1` | clamp(26,2.8vw,34) / 1.18 | 750 | page and step titles |
| `.display-s`, `.t-h2` | clamp(20,2vw,24) / 1.25 | 700 | section titles |
| `.t-h3` | 18 / 1.35 | 650 | card titles, module rows |
| body | 16 / 1.6 | 400 | |
| `.lede` | 19 / 1.55 | 400, muted | subtitles |
| `.small` | 14 / 1.5 | | |
| `.label`, `.meta` | 13 / 1.4 | 600 / 400 | sentence case, muted |
| `.eyebrow` | 12 / 1.3 | 700, 0.06em, uppercase | sparing: section kickers only |

**Spacing** `--s1..--s9` = 4, 8, 12, 16, 24, 32, 48, 64, 96.

**Radius** `--r-sm` 6 (chips, inputs) · `--r` 8 (buttons) · `--r-lg` 12 (cards) · `--r-xl` 16
(video, hero cards) · `--r-pill` 999.

**Shadow** `--shadow-sm` `0 1px 2px rgb(16 24 40 / .06)` · `--shadow-md` `0 6px 20px rgb(16 24 40 / .08)`
· `--shadow-lg` `0 16px 40px rgb(16 24 40 / .14)`. Dark mode uses black at 40–60%.

**Layout** `--container` 1200px · `--container-wide` 1320px · `--gutter` 24px (16px under 640px) ·
header 64px · player bar 56px · outline 300px. Breakpoints: 640 / 960 / 1200.

**Motion** 150ms (hover), 250ms (accordion, drawer), `--ease-out`. `prefers-reduced-motion`
disables motion.

## Components (`src/styles/base.css` unless noted)

- **Buttons.** All buttons are `.btn` (filled primary, 44px tall, `--r`, 15px/650, optional trailing
  arrow that nudges right on hover).
  - Variants: `.btn-ghost` / `.btn-secondary` (outline: border-strong, primary text), `.btn-quiet`
    (text-only), `.btn-accent` (alias of primary).
  - Sizes: `.btn-small` (36px), `.btn-large` (52px), `.btn-block`.
  - Disabled: sunken background with subtle text. `.icon-btn` is 40px square with `--r` and a
    hover tint. `.link-btn` is an inline text button.
- **Chips and badges.** `.chip` is a pill with a sunken background and muted 12.5px/600 text.
  `.chip-good`, `.chip-warn`, `.chip-red` and `.chip-accent` get the soft background plus the strong
  text colour. `.badge` is a rectangular (`--r-sm`) tinted label, like Coursera's "Top Instructor".
- **Progress.** `.progress > span` is an 8px pill track. The fill is primary, or success with
  `.progress.complete`. `ProgressRing` (`src/ui/Progress.tsx`) is an SVG ring with the percentage
  in the centre.
- **Cards.** `.card` (surface, 1px border, `--r-lg`); `.card-link:hover` raises it with
  `--shadow-md` and a stronger border.
- **Breadcrumbs.** `Breadcrumbs` in `src/ui/Shell.tsx` renders `nav.crumbs > ol > li` with chevron
  separators. Crumbs are 14px muted links; the current page is plain text.
- **Tabs.** `.tabs` is a row with a bottom border. Each `.tab` has `role=tab` and is 15px/600 muted;
  `[aria-selected=true]` gets the text colour and a 3px primary underline.
- **Accordion.** `.acc` is a card. Each `.acc-item` is a `<details>`. `summary.acc-head` holds the
  title, a meta line and a rotating chevron.
- **Callouts.** `.callout` (subtle background, `--r-lg`), plus `.callout-good`, `.callout-warn`
  and `.callout-info`.
- **Forms.** `.input`, `.select` and `.textarea` are 44px tall, `--r-sm`, with a border-strong
  border. Focus gives a primary border plus a 3px primary-soft halo. Range inputs use
  `accent-color: var(--primary)`.
- **Header** (`shell.css`). Sticky, white, 64px, with the 3px brand-red rule above it.
  - Contents: wordmark · nav (Courses, Commission a course, How we fact-check) · a pill search
    "What do you want to learn?" with a round primary button · on the right, the sync chip,
    theme toggle and settings.
  - Under 960px the nav and search fold into a "Menu" disclosure panel.
- **Search.** The search submits to `/?q=…`; Home filters the catalogue. When nothing matches it
  offers "Commission a course on '…'", which links to `/commission?topic=…` and pre-fills the topic.
- **Footer** (`shell.css`). Subtle band with three columns (Margin blurb with live counts · Learn ·
  Your data) and a bottom legal line.

## Pages

### Home (`catalog.css`, `Home.tsx`)
```
[ tint band ]  Welcome back / Learn anything — every fact checked
               lede · [Resume ▸] or [Browse courses]  [Commission a course]
               (returning) continue card: cover | course · next lesson | progress bar | Resume
[ My learning ]  cards of in-progress courses (only if any)
[ All courses ]  filter pills: All · In progress · Completed · Not started   (search results heading when ?q=)
               grid 4/3/2/1 columns of course cards; last tile = "Commission a course" (dashed)
[ subtle band ] How Margin works: Watch · Practise · Check · Make (glyph, title, one line each)
```
Course card: cover thumbnail 16:9 (`--r-lg` top), "Margin Originals" partner line with a small
mark, bold title, "Skills you'll gain: …" (two lines max), a meta line (level · lessons · hours),
badges (Fact-checked · Certificate), and a progress bar when started. The whole card is a link.
The primary action text on the hero and on a not-started course is **"Begin …"** (an e2e hook).

### Course landing (`course.css`, `CoursePage.tsx`)
```
crumbs: Home › Courses › Quantum Trading 101
[ tint band ]  Margin Originals · Fact-checked
               Quantum Trading 101 (display-l)                       ┌ sticky side card ─┐
               subtitle (lede)                                       │ cover thumbnail    │
               [Begin the course ▸]  Your work · Sources            │ ProgressRing 35%   │
               Last verified 2 Oct 2026 · 66 sourced claims ✓        │ Next up: 2.1 …     │
                                                                     │ [Resume ▸]         │
[ facts card ] 8 modules | Intro level | ≈ 6 hours | 66 claims | Certificate   │ includes list │
tabs (sticky, in-page anchors): About · Outcomes · Modules · Work outputs · Sources   └────────┘
About: summary, prerequisites
What you'll learn: bordered box, 2-column checklist (outcomes) + Skills pills
Course content: "8 modules • 14 lessons • ≈ 6 h total"  [Expand all]
  acc: Module 1 · Orientation — What "quantum trading" means   meta "1 lesson · 18 min · Done ✓"
       lesson rows: status icon · 1.1 title · type chips (Video · Lab · Quiz) · 18 min · Locked/Done/Start
  final row: certificate (glyph tile + "Earn a certificate" + description)
Work outputs: cards (capstone badge), status
Sources: status counts (Verified n · Derived n · Estimate n · Contested n) + [Browse the ledger]
```
Hooks: `#unit-<id>` on each module, with `.lesson` rows carrying the `done` / `locked` classes. The
module that holds the next lesson, and any completed module, render `open`. The rest are closed.

### Lesson player (`player.css`, `LessonPage.tsx`, `src/steps/*`)
```
player-bar 56px: [☰ outline] Margin▪ │ Quantum Trading 101 › 2.1 Superposition…   ProgressRing · Your work · ◐ · ✕
┌ outline 300px (sticky) ┐┌ main (max 1040) ──────────────────────────────────────────┐
│ Course content          ││ Step 1 of 3 · Video                                        │
│ ▾ 2 Superposition …     ││ From bits to qubits (.step-title)                          │
│   ● 2.1 Superposition   ││ [ video stage / lab / quiz / assignment ]                  │
│      ✓ Video  From bits ││ step-foot: hint ............. [‹ Previous]  [Continue ▸]  │
│      ○ Lab    Steer…    ││ tabs: Sources (4) · About this lesson                      │
│      🔒 Quiz  Check…    ││   live notes: "On screen now" first, then the rest         │
│   🔒 2.2 …              ││                                                            │
│ ▸ 3 …                   ││                                                            │
└─────────────────────────┘└────────────────────────────────────────────────────────────┘
```
**Why this layout:** Coursera-style left navigation shows where you are in the whole course and
inside the lesson in one place, and leaves the full remaining width for labs, which need about 900px
and more. Sources sit directly under the content in a tab, the way Udemy places Overview and Notes
under the video. They stay one glance away without stealing width from the video stage.

- Under 960px the outline becomes a drawer opened from the ☰ button.
- The lesson-complete screen is a centred card with a success check badge (`.stamp`, containing
  "… complete"), the lesson title, a next-lesson card and a primary "Next lesson" button.
- Hooks: `.step-title`, `data-testid="continue"` and `data-testid="dev-complete"`; the locked page
  shows the exact text "Locked".

### Labs (`labs.css`, `src/ui/LabFrame.tsx`, widgets)
- A lab is a `.card` with a header (goal callout `.lab-goal`, success style when `.met`), a controls
  column and a visual column.
- Readouts are stat tiles with mono figures. Segmented controls are pill toggles. Buttons use `.btn`.
- Charts use tokens: grid uses border, axes use border-strong, series use primary, text and danger.

### Video (reel) chrome (`src/engine/reel/reel.css`)
- The stage is dark (theatre), with `--r-xl` corners clipped.
- The poster has a large round white play button with a primary glyph, the reel title in the UI
  face at 800, a chapter list and a duration.
- The controls bar keeps its existing controls with 40px hit areas. Captions are white on 80% black.
- Shot titles inside the reel use the UI face (800) instead of Gloock.

### Other pages (`pages.css`)
- **Your work:** page header (crumbs, title, progress), action buttons (Print / Save as PDF,
  Markdown, JSON), and each output as a card (`#<output-id>` anchors kept).
- **Certificate:** a two-column layout with the certificate artwork (Gloock, keeps the formal
  look) on the left and an action card on the right (Issue, Print, Credential ID in mono, Verify).
- **Ledger:** a header with status count tiles, filter pills, claim cards (status chip, statement,
  checked date, sources list) and a Sources tab.
- **Commission:** a 3-step explainer row, a form card (topic input placeholder "e.g. Options market
  making"), and the generated brief in a code card with a Copy button (`.commission-prompt`).
- **Settings:** stacked cards (Profile · Appearance · Narration · Your data · Sync).
- **Method:** an article layout (max 760px) with numbered checks.
- **404 and Locked:** a centred empty state with a glyph tile, heading, one line and a primary button.

## Current → new mapping

| Was | Now |
|---|---|
| `.margin-rule` (fixed vertical red line) | 3px brand-red top rule (`.margin-rule` restyled) |
| `.masthead`, `.mast-nav`, `.wordmark` | `.site-header` with the same wordmark (shell.css) |
| `.hang > .marginalia` hanging labels | plain eyebrow above the block |
| `.display*` serif | Schibsted 750–800 (same class names) |
| `.label` uppercase mono | sentence-case UI 13px/600 |
| black `.btn`, red hover | primary blue `.btn`, darker blue hover |
| `.course-row` (shelf) | `.course-card` grid |
| `.route` stations | removed; module progress lives in the accordion meta and side card |
| `.lesson-rail` step list | `.outline` course outline (current lesson expanded) |
| `.lesson-notes` right column | `.lesson-tabs` → Sources tab under the content |
| `.lesson-ticks` | `ProgressRing` in the player bar |
| ruled textarea | plain bordered textarea |

## Rules learned in QA

A three-lens review (visual, accessibility, behaviour) of the first build led to these rules:

- **One filled button per view.** Buttons that run something inside a lab (Simulate, Measure,
  Oracle, Run) are `.btn-secondary`. The step's Continue is the filled one; "Save to notebook"
  is filled only until it has been used.
- **Focus.** Use `box-shadow: var(--focus-shadow)` or the global outline. Tab rows draw the ring
  inside (`outline-offset: -3px`), because they scroll horizontally.
- **Keyboard flow in lessons.**
  - Moving to a step focuses its `h1.step-title`, and the lesson-complete screen focuses its
    heading.
  - Quizzes move focus to the explanation after "Check answer", to the next prompt, and then to
    the result.
  - While the outline drawer is open, the page behind it is `inert`.
  - The skip link targets `#lesson-content` inside lessons.
- **Composite widgets.** Anything with `role=tablist` gets arrow keys and a roving tabIndex
  (`src/ui/tabs.ts`). Single-choice button rows use `aria-pressed` toggle buttons, not
  `role=radio`.
- **Selected state is structural.** A selected segmented option gets a white surface, a primary
  edge and bold text, not just a hue change.
- **Links inside running text are underlined**, not distinguished by colour alone.
- **Each page sets its own title** via `useDocumentTitle`, e.g. "Step · 2.1 Lesson · Margin".
- **Motion.** JS animations and smooth scrolling check `prefersReducedMotion()`
  (`src/ui/motion.ts`).
- **Shared pieces.**
  - `StatusTiles` and the `STATUS_*` maps in `src/ui/Cite.tsx` give one status wording for the
    course page, ledger and method page.
  - `.partner-mark` is the single "Margin Originals" mark.
  - `.empty-state` is used for both the 404 and the locked lesson.
- **Words.** The UI and the course text say "Module", following MOOC conventions; the data model
  still calls them `units`.

## CSS ownership (wave 2 works on disjoint files)

| Package | May edit |
|---|---|
| Foundation (done first) | `tokens.css`, `base.css`, `shell.css`, `App.tsx`, `src/ui/{Glyph,Shell,Progress,SyncChip}.tsx`, `main.tsx` |
| Home | `Home.tsx`, `catalog.css` |
| Course landing | `CoursePage.tsx`, `course.css`, `content/courses/*/course.json` `skills` (with the schema field) |
| Player | `LessonPage.tsx`, `player.css`, `src/steps/*`, `src/engine/reel/{ReelPlayer.tsx,reel.css,shots.tsx}` |
| Labs | `labs.css`, `src/ui/{LabFrame,charts}.tsx`, `src/widgets/*`, `src/plugins/quantum/{widgets/*,BlochSphere.tsx,shots.tsx}` (styling only) |
| Pages | `pages.css`, `WorkPage`, `CertificatePage`, `LedgerPage`, `CommissionPage` (incl. `?topic=` prefill), `SettingsPage`, `MethodPage`, `NotFound`, `src/ui/Cite.tsx` |

`app.css` was removed once every rule had a new home. Shared rules that more than one page uses
(status tiles, partner mark, empty states, citation defaults) live in `base.css`, or in
`pages.css` for the citation notes.
