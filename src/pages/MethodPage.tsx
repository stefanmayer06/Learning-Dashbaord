import { Link } from 'react-router-dom'
import { loadCatalogue } from '../content/loader'
import { Glyph } from '../ui/Glyph'
import { Breadcrumbs } from '../ui/Shell'

const STEPS = [
  { t: 'Brief', d: 'You commission a subject: what you want to be able to do, your level, your time budget.' },
  { t: 'Research', d: 'Claude researches with primary sources first — peer-reviewed papers, official releases, regulators, standards bodies — and reads them, not summaries of them.' },
  { t: 'Ledger', d: 'Every factual statement becomes a claim with its sources and a check date. Projections are labelled estimates; disputes are labelled contested and explained.' },
  { t: 'Build', d: 'Lessons are written as videos and labs. Narration, quiz explanations and recap cards cite claims by id, so nothing factual floats free.' },
  { t: 'Validate', d: 'A validator refuses to build if a citation points nowhere, a claim rests only on news, a contested claim lacks an explanation, or a number appears without a source (strict mode).' },
  { t: 'Re-verify', d: 'Claims carry the date they were checked. Anything older than six months is flagged for re-checking — the “current landscape” moves.' },
]

const RULES = [
  'News coverage can corroborate, never be the only support for a claim.',
  'Preprints are marked as such in every note; claims resting only on preprints cannot be “verified”.',
  'Numbers are quoted from the published version of a paper — earlier drafts often differ.',
  'Interactive labs compute their results live from standard formulas (Black–Scholes, the Born rule, exact statevector simulation), and the simulator is tested against IBM’s Qiskit.',
  'Synthetic data is labelled synthetic wherever it appears.',
  'Third-party material (external tools, videos) is labelled with who made it.',
]

const LABELS = [
  { chip: 'chip-good', label: 'Verified', d: 'Matches the primary source.' },
  { chip: 'chip-accent', label: 'Derived', d: 'Follows by mathematics; the source shows the derivation.' },
  { chip: 'chip-warn', label: 'Estimate', d: 'A projection or resource estimate, not a measurement.' },
  { chip: 'chip-red', label: 'Contested', d: 'The primary source says it; credible parties dispute it. The dispute is explained.' },
]

export function MethodPage() {
  const { courses } = loadCatalogue()
  return (
    <div className="pg method">
      <article className="page method-article">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'How we fact-check' }]} />
        <header className="method-head">
          <h1 className="display-m">How a course gets made, and checked</h1>
          <p className="lede">Trust is the product. This is the pipeline every course goes through before it appears in the catalogue.</p>
        </header>

        <section className="method-section" aria-labelledby="method-pipeline">
          <h2 className="t-h2" id="method-pipeline">
            Six checks, in order
          </h2>
          <ol className="method-steps">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <span className="method-step-n" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className="t-h3">{s.t}</h3>
                  <p className="soft">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="method-section" aria-labelledby="method-labels">
          <h2 className="t-h2" id="method-labels">
            What the labels mean
          </h2>
          <p className="soft">Every claim in a course carries one of four labels, shown next to it wherever it is cited.</p>
          <dl className="card method-labels">
            {LABELS.map((l) => (
              <div key={l.label}>
                <dt>
                  <span className={`chip ${l.chip}`}>{l.label}</span>
                </dt>
                <dd>{l.d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="method-section" aria-labelledby="method-rules">
          <h2 className="t-h2" id="method-rules">
            House rules
          </h2>
          <ul className="method-rules">
            {RULES.map((r) => (
              <li key={r}>
                <Glyph name="checkCircle" size={20} className="method-rule-icon" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="callout callout-info method-cta" aria-labelledby="method-see">
          <span className="glyph-tile" aria-hidden>
            <Glyph name="ledger" size={22} />
          </span>
          <div>
            <h2 className="t-h3" id="method-see">
              See it for yourself
            </h2>
            <p className="small soft">Each course publishes its full ledger: every claim, its label, its sources and the date it was checked.</p>
            <div className="btn-row">
              {courses.map((c) => (
                <Link key={c.course.id} to={`/c/${c.course.id}/ledger`} className="btn btn-secondary btn-small">
                  {c.course.title} ledger <Glyph name="arrow" className="arrow" size={14} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </article>
    </div>
  )
}
