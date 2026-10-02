/** Site chrome: header with search, footer, breadcrumbs. */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { SITE } from '../site'
import { loadCatalogue } from '../content/loader'
import { useLearner } from '../store/LearnerProvider'
import { Glyph } from './Glyph'
import { SyncChip } from './SyncChip'

export function Wordmark({ small }: { small?: boolean }) {
  return (
    <Link to="/" className={`wordmark${small ? ' wordmark-small' : ''}`} aria-label={`${SITE.name} — home`}>
      {SITE.name}
      <span className="wordmark-dot" aria-hidden />
    </Link>
  )
}

export function useDarkTheme() {
  const { state, setPrefs } = useLearner()
  const dark =
    state.prefs.theme === 'dark' ||
    (state.prefs.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
  return { dark, toggle: () => setPrefs({ theme: dark ? 'light' : 'dark' }) }
}

export function ThemeToggle() {
  const { dark, toggle } = useDarkTheme()
  return (
    <button className="icon-btn" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
      <Glyph name="lamp" size={19} />
    </button>
  )
}

function SearchBox({ id }: { id: string }) {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const current = pathname === '/' ? (params.get('q') ?? '') : ''
  const [q, setQ] = useState(current)
  useEffect(() => setQ(current), [current])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    nav(term ? `/?q=${encodeURIComponent(term)}#catalog` : '/#catalog')
  }
  return (
    <form className="search" role="search" onSubmit={submit}>
      <label htmlFor={id} className="visually-hidden">
        Search courses
      </label>
      <input id={id} className="search-input" type="search" placeholder="What do you want to learn?" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      <button className="search-btn" type="submit" aria-label="Search">
        <Glyph name="search" size={17} />
      </button>
    </form>
  )
}

const NAV = [
  { to: '/', label: 'Courses', end: true },
  { to: '/commission', label: 'Commission a course' },
  { to: '/method', label: 'How we fact-check' },
]

export function SiteHeader() {
  const { sync } = useLearner()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  return (
    <header className="site-header no-print">
      <div className="site-header-row container-wide">
        <Wordmark />
        <nav className="site-nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="site-search">
          <SearchBox id="site-search" />
        </div>
        <div className="site-tools">
          <SyncChip status={sync.status} />
          <ThemeToggle />
          <Link to="/settings" className="icon-btn" aria-label="Settings" title="Settings">
            <Glyph name="settings" size={19} />
          </Link>
          <button className="icon-btn site-menu-btn" aria-expanded={open} aria-controls="site-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
            <Glyph name={open ? 'cross' : 'menu'} size={20} />
          </button>
        </div>
      </div>
      {open && (
        <div className="site-menu container-wide" id="site-menu">
          <SearchBox id="site-search-mobile" />
          <nav aria-label="Main (mobile)">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </div>
      )}
    </header>
  )
}

export function SiteFooter() {
  const { courses } = loadCatalogue()
  const claims = courses.reduce((n, c) => n + Object.keys(c.claims).length, 0)
  const sources = courses.reduce((n, c) => n + Object.keys(c.sources).length, 0)
  return (
    <footer className="site-footer no-print">
      <div className="container-wide site-footer-grid">
        <div className="site-footer-brand">
          <Wordmark small />
          <p className="small soft">
            {SITE.tagline} {courses.length} course{courses.length === 1 ? '' : 's'}, {claims} sourced claims, {sources} sources.
          </p>
        </div>
        <div>
          <h2 className="site-footer-head">Learn</h2>
          <ul>
            <li>
              <Link to="/">All courses</Link>
            </li>
            <li>
              <Link to="/commission">Commission a course</Link>
            </li>
            <li>
              <Link to="/method">How we fact-check</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer-head">Your data</h2>
          <ul>
            <li>
              <Link to="/settings">Settings &amp; sync</Link>
            </li>
            <li>
              <Link to="/settings#data">Export or import progress</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container-wide site-footer-base">
        <span>Runs offline in your browser. Optional Supabase sync stores learner data only.</span>
        <span>Learning material, not investment advice.</span>
      </div>
    </footer>
  )
}

export interface Crumb {
  label: ReactNode
  to?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => (
          <li key={i}>
            {i > 0 && <Glyph name="chevronRight" size={14} className="crumb-sep" />}
            {c.to && i < items.length - 1 ? (
              <Link to={c.to}>
                {i === 0 && <Glyph name="home" size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />}
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
