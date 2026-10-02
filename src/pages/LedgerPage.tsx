import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import type { CourseBundle } from '../content/schema'
import { fmtDate } from '../content/stats'
import { CiteProvider, ClaimNote, KIND_LABEL, STATUS_LABEL } from '../ui/Cite'
import { Glyph } from '../ui/Glyph'
import { Breadcrumbs } from '../ui/Shell'
import { NotFound } from './NotFound'

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

type Status = 'verified' | 'derived' | 'estimate' | 'contested'
type Filter = 'all' | Status

const STATUSES: { key: Status; tone: string; line: string }[] = [
  { key: 'verified', tone: 'good', line: 'Matches the primary source.' },
  { key: 'derived', tone: 'accent', line: 'Follows by mathematics; the source shows the derivation.' },
  { key: 'estimate', tone: 'warn', line: 'A projection or resource estimate, not a measurement.' },
  { key: 'contested', tone: 'red', line: 'Credible parties dispute it. The note explains the dispute.' },
]

export function LedgerPage() {
  const { courseId } = useParams()
  const { hash } = useLocation()
  const bundle = findCourse(courseId)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'claims' | 'sources'>(hash === '#sources' ? 'sources' : 'claims')
  const used = useMemo(() => (bundle ? usage(bundle) : {}), [bundle])
  const numbering = useMemo(() => {
    const m: Record<string, string> = {}
    bundle?.course.units.forEach((u, ui) => u.lessons.forEach((lid, li) => (m[lid] = `${ui + 1}.${li + 1}`)))
    return m
  }, [bundle])
  if (!bundle) return <NotFound />
  const { course, claims, sources } = bundle
  const all = Object.values(claims)
  const counts = all.reduce<Record<string, number>>((m, c) => ((m[c.status] = (m[c.status] ?? 0) + 1), m), {})
  const needle = q.trim().toLowerCase()
  const shown = all.filter((c) => (filter === 'all' || c.status === filter) && (!needle || (c.text + ' ' + (c.note ?? '')).toLowerCase().includes(needle)))
  const kinds = Object.entries(
    Object.values(sources).reduce<Record<string, number>>((m, s) => ((m[s.kind] = (m[s.kind] ?? 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1])
  const citedBy = all.reduce<Record<string, number>>((m, c) => (c.sources.forEach((s) => (m[s] = (m[s] ?? 0) + 1)), m), {})
  const sourceList = Object.values(sources).sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: all.length },
    ...STATUSES.map((s) => ({ value: s.key, label: STATUS_LABEL[s.key], count: counts[s.key] ?? 0 })),
  ]

  return (
    <CiteProvider bundle={bundle} order={[]}>
      <div className="pg ledger" style={{ ['--accent' as string]: course.theme.accent }}>
        <header className="pg-head">
          <div className="page">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: 'Courses', to: '/#catalog' },
                { label: course.title, to: `/c/${course.id}` },
                { label: 'Sources & claims' },
              ]}
            />
            <div className="pg-head-row">
              <div className="pg-head-text">
                <h1 className="display-m pg-title">Sources &amp; claims</h1>
                <p className="pg-desc">Every factual statement in {course.title}, the sources behind it, and when it was last checked.</p>
                <p className="pg-meta">
                  <span className="pg-meta-item">
                    <Glyph name="checkCircle" size={16} className="pg-meta-good" /> Last verified {fmtDate(course.lastVerified)}
                  </span>
                  <span className="pg-meta-item">
                    {all.length} claims · {Object.keys(sources).length} sources
                  </span>
                </p>
              </div>
              <div className="btn-row pg-actions">
                <Link to="/method" className="btn btn-secondary">
                  How we fact-check
                </Link>
              </div>
            </div>
            <ul className="ledger-tiles" aria-label="Claims by status">
              {STATUSES.map((s) => (
                <li key={s.key} className={`ledger-tile tone-${s.tone}`}>
                  <span className="ledger-tile-label">
                    <span className="ledger-dot" aria-hidden />
                    {STATUS_LABEL[s.key]}
                  </span>
                  <span className="ledger-tile-n">{counts[s.key] ?? 0}</span>
                  <span className="ledger-tile-line">{s.line}</span>
                </li>
              ))}
            </ul>
          </div>
        </header>

        <div className="page pg-body">
          <div className="tabs ledger-tabs" role="tablist" aria-label="Ledger">
            <button role="tab" id="ledger-tab-claims" aria-controls="ledger-panel-claims" aria-selected={tab === 'claims'} className="tab" onClick={() => setTab('claims')}>
              Claims <span className="tab-count">{all.length}</span>
            </button>
            <button role="tab" id="ledger-tab-sources" aria-controls="ledger-panel-sources" aria-selected={tab === 'sources'} className="tab" onClick={() => setTab('sources')}>
              Sources <span className="tab-count">{sourceList.length}</span>
            </button>
          </div>

          <div className="ledger-layout">
            <div className="ledger-main">
              <div role="tabpanel" id="ledger-panel-claims" aria-labelledby="ledger-tab-claims" hidden={tab !== 'claims'}>
                <div className="ledger-tools">
                  <div className="pill-filters" role="group" aria-label="Filter by status">
                    {filters.map((f) => (
                      <button key={f.value} type="button" className="pill-filter" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                        {f.label}
                        <span className="pill-filter-count">{f.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="search-field">
                    <Glyph name="search" size={17} className="search-field-icon" />
                    <input className="input" type="search" placeholder="Search claims" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search claims" />
                  </div>
                </div>
                <p className="ledger-count meta" aria-live="polite">
                  {shown.length === all.length ? `Showing all ${all.length} claims` : `Showing ${shown.length} of ${all.length} claims`}
                </p>
                {shown.length ? (
                  <ol className="ledger-list">
                    {shown.map((c) => {
                      const uses = used[c.id] ? [...new Map(used[c.id].map((u) => [u.lessonId, u])).values()] : []
                      return (
                        <li key={c.id} className="ledger-item">
                          <ClaimNote claim={c} sources={sources} />
                          {uses.length > 0 && (
                            <div className="ledger-used">
                              <span className="ledger-used-label">Used in</span>
                              {uses.map((u) => (
                                <Link key={u.lessonId} className="ledger-used-link" to={`/c/${course.id}/l/${u.lessonId}/${u.stepId}`}>
                                  {numbering[u.lessonId] ? `${numbering[u.lessonId]} ` : ''}
                                  {u.lessonTitle}
                                </Link>
                              ))}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <div className="ledger-empty">
                    <span className="glyph-tile glyph-tile-muted" aria-hidden>
                      <Glyph name="search" size={22} />
                    </span>
                    <p className="t-h3">No claims match</p>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        setFilter('all')
                        setQ('')
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>

              <div role="tabpanel" id="ledger-panel-sources" aria-labelledby="ledger-tab-sources" hidden={tab !== 'sources'}>
                <p className="ledger-count meta">Oldest first. Preprints are marked; claims that rest only on preprints are never marked verified.</p>
                <ol className="card ledger-sources">
                  {sourceList.map((s) => (
                    <li key={s.id} className="ledger-source">
                      <span className="ledger-source-year">{s.year}</span>
                      <div className="ledger-source-main">
                        <a href={s.url} target="_blank" rel="noreferrer noopener" className="ledger-source-title">
                          {s.title}
                          <Glyph name="external" size={13} className="note-ext" />
                        </a>
                        <p className="ledger-source-by">
                          {[s.authors, s.publisher].filter(Boolean).join(' · ')}
                          {s.doi && <span className="mono ledger-source-id">doi:{s.doi}</span>}
                          {s.arxiv && <span className="mono ledger-source-id">arXiv:{s.arxiv}</span>}
                        </p>
                        {s.note && <p className="ledger-source-note">{s.note}</p>}
                      </div>
                      <div className="ledger-source-side">
                        <span className={`chip ${s.kind === 'preprint' ? 'chip-warn' : s.kind === 'news' ? 'chip-outline' : ''}`}>{KIND_LABEL[s.kind]}</span>
                        {citedBy[s.id] ? <span className="meta">Cited by {citedBy[s.id]}</span> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <aside className="ledger-aside">
              <div className="card card-pad">
                <h2 className="ledger-aside-head">Sources by kind</h2>
                <ul className="ledger-kinds">
                  {kinds.map(([k, n]) => (
                    <li key={k}>
                      <span className="ledger-kind-name">{KIND_LABEL[k]}</span>
                      <span className="ledger-kind-bar" aria-hidden>
                        <span style={{ width: `${(n / kinds[0][1]) * 100}%` }} />
                      </span>
                      <span className="ledger-kind-n">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card card-pad">
                <h2 className="ledger-aside-head">The rules</h2>
                <ul className="ledger-rules small">
                  <li>News can support a claim, never carry it alone.</li>
                  <li>Contested claims explain the dispute.</li>
                  <li>Claims older than six months are flagged for re-checking.</li>
                </ul>
                <Link to="/method" className="ledger-aside-link small">
                  Read the full method <Glyph name="arrow" size={14} />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </CiteProvider>
  )
}
