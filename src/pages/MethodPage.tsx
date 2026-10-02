import { Link } from 'react-router-dom'
import { loadCatalogue } from '../content/loader'

const STEPS = [
  { n: '01', t: 'Brief', d: 'You commission a subject: what you want to be able to do, your level, your time budget.' },
  { n: '02', t: 'Research', d: 'Claude researches with primary sources first — peer-reviewed papers, official releases, regulators, standards bodies — and reads them, not summaries of them.' },
  { n: '03', t: 'Ledger', d: 'Every factual statement becomes a claim with its sources and a check date. Projections are labelled estimates; disputes are labelled contested and explained.' },
  { n: '04', t: 'Build', d: 'Lessons are written as reels and labs. Narration, quiz explanations and recap cards cite claims by id, so nothing factual floats free.' },
  { n: '05', t: 'Validate', d: 'A validator refuses to build if a citation points nowhere, a claim rests only on news, a contested claim lacks an explanation, or a number appears without a source (strict mode).' },
  { n: '06', t: 'Re-verify', d: 'Claims carry the date they were checked. Anything older than six months is flagged for re-checking — the “current landscape” moves.' },
]

const RULES = [
  'News coverage can corroborate, never be the only support for a claim.',
  'Preprints are marked as such in every note; claims resting only on preprints cannot be “verified”.',
  'Numbers are quoted from the published version of a paper — earlier drafts often differ.',
  'Interactive labs compute their results live from standard formulas (Black–Scholes, the Born rule, exact statevector simulation), and the simulator is tested against IBM’s Qiskit.',
  'Synthetic data is labelled synthetic wherever it appears.',
  'Third-party material (external tools, videos) is labelled with who made it.',
]

export function MethodPage() {
  const { courses } = loadCatalogue()
  return (
    <div className="method page">
      <p className="label">Method</p>
      <h1 className="display display-l">How a course gets made — and checked.</h1>
      <p className="lede">Trust is the product. This is the pipeline every course goes through before it reaches the shelf.</p>
      <ol className="pipeline">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className="pipeline-n mono">{s.n}</span>
            <span className="display display-s">{s.t}</span>
            <p className="soft">{s.d}</p>
          </li>
        ))}
      </ol>
      <div className="hang method-rules">
        <span className="marginalia label">House rules</span>
        <ul>
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <p className="soft">
        See it for yourself:{' '}
        {courses.map((c, i) => (
          <span key={c.course.id}>
            {i ? ', ' : ''}
            <Link to={`/c/${c.course.id}/ledger`}>{c.course.title} ledger</Link>
          </span>
        ))}
        .
      </p>
    </div>
  )
}
