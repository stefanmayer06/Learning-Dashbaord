import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import { CiteProvider, ClaimNote, KIND_LABEL, STATUS_LABEL } from '../ui/Cite'
import { Segmented } from '../ui/LabFrame'
import { NotFound } from './NotFound'
import type { CourseBundle } from '../content/schema'

/** Where in the course each claim is used. */
function usage(bundle: CourseBundle) {
  const map: Record<string, { lessonId: string; lessonTitle: string; stepId: string }[]> = {}
  const json = (x: unknown) => JSON.stringify(x)
  for (const l of Object.values(bundle.lessons))
    for (const s of l.steps) {
      const text = json(s)
      for (const id of Object.keys(bundle.claims)) if (text.includes(`"${id}"`)) (map[id] ??= []).push({ lessonId: l.id, lessonTitle: l.title, stepId: s.id })
    }
  return map
}

export function LedgerPage() {
  const { courseId } = useParams()
  const bundle = findCourse(courseId)
  const [filter, setFilter] = useState<'all' | 'verified' | 'contested' | 'estimate' | 'derived'>('all')
  const [q, setQ] = useState('')
  const used = useMemo(() => (bundle ? usage(bundle) : {}), [bundle])
  if (!bundle) return <NotFound />
  const { course, claims, sources } = bundle
  const all = Object.values(claims)
  const counts = all.reduce<Record<string, number>>((m, c) => ((m[c.status] = (m[c.status] ?? 0) + 1), m), {})
  const shown = all.filter((c) => (filter === 'all' || c.status === filter) && (!q || (c.text + ' ' + (c.note ?? '')).toLowerCase().includes(q.toLowerCase())))
  const kinds = Object.values(sources).reduce<Record<string, number>>((m, s) => ((m[s.kind] = (m[s.kind] ?? 0) + 1), m), {})

  return (
    <CiteProvider bundle={bundle} order={[]}>
      <div className="ledger page" style={{ ['--accent' as string]: course.theme.accent }}>
        <p className="label">
          <Link to={`/c/${course.id}`}>{course.title}</Link> / Ledger
        </p>
        <h1 className="display display-l">The ledger</h1>
        <p className="lede">
          Every factual statement this course makes, the sources behind it, and when it was last checked. Last full verification: <span className="mono">{course.lastVerified}</span>.
        </p>
        <div className="ledger-stats">
          {(['verified', 'derived', 'estimate', 'contested'] as const).map((s) => (
            <div key={s}>
              <span className="display display-m">{counts[s] ?? 0}</span>
              <span className="label label-faint">{STATUS_LABEL[s]}</span>
            </div>
          ))}
          <div>
            <span className="display display-m">{Object.keys(sources).length}</span>
            <span className="label label-faint">
              Sources · {Object.entries(kinds)
                .map(([k, n]) => `${n} ${KIND_LABEL[k]}`)
                .join(', ')}
            </span>
          </div>
        </div>
        <dl className="ledger-key">
          <div>
            <dt className="chip chip-good">Verified</dt>
            <dd>Matches the primary source.</dd>
          </div>
          <div>
            <dt className="chip chip-accent">Derived</dt>
            <dd>Follows by mathematics; the source shows the derivation.</dd>
          </div>
          <div>
            <dt className="chip chip-warn">Estimate</dt>
            <dd>A projection or resource estimate — not a measurement.</dd>
          </div>
          <div>
            <dt className="chip chip-red">Contested</dt>
            <dd>The primary source says it; credible parties dispute it. The dispute is explained.</dd>
          </div>
        </dl>
        <div className="ledger-tools">
          <Segmented
            label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All ${all.length}` },
              { value: 'verified', label: 'Verified' },
              { value: 'derived', label: 'Derived' },
              { value: 'estimate', label: 'Estimates' },
              { value: 'contested', label: 'Contested' },
            ]}
          />
          <input className="input" placeholder="Search claims…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search claims" />
        </div>
        <ol className="ledger-list">
          {shown.map((c) => (
            <li key={c.id}>
              <ClaimNote claim={c} sources={sources} />
              {used[c.id] && (
                <p className="ledger-used label label-faint">
                  Used in:{' '}
                  {[...new Map(used[c.id].map((u) => [u.lessonId, u])).values()].map((u, i) => (
                    <span key={u.lessonId}>
                      {i ? ', ' : ''}
                      <Link to={`/c/${course.id}/l/${u.lessonId}/${u.stepId}`}>{u.lessonTitle}</Link>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ol>
        <h2 className="display display-m ledger-bib-h">Bibliography</h2>
        <ol className="bib">
          {Object.values(sources)
            .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
            .map((s) => (
              <li key={s.id}>
                <span className="mono bib-year">{s.year}</span>
                <span>
                  {s.authors && <span>{s.authors}. </span>}
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.title}
                  </a>
                  {s.publisher && <span className="soft">. {s.publisher}</span>}
                  {s.doi && <span className="mono small faint"> · doi:{s.doi}</span>}
                  {s.arxiv && <span className="mono small faint"> · arXiv:{s.arxiv}</span>}
                  <span className={`chip ${s.kind === 'preprint' ? 'chip-warn' : ''}`} style={{ marginLeft: 8 }}>
                    {KIND_LABEL[s.kind]}
                  </span>
                  {s.note && <span className="small soft"> — {s.note}</span>}
                </span>
              </li>
            ))}
        </ol>
      </div>
    </CiteProvider>
  )
}
