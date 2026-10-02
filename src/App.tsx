import { lazy, Suspense, useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { SITE } from './site'
import { Glyph } from './ui/Glyph'
import { SyncChip } from './ui/SyncChip'
import { useLearner } from './store/LearnerProvider'
import { loadCatalogue } from './content/loader'
import { Home } from './pages/Home'
import { CoursePage } from './pages/CoursePage'
import { CommissionPage } from './pages/CommissionPage'
import { MethodPage } from './pages/MethodPage'

// Lesson-only code (reel engine, labs, KaTeX) loads on demand.
const LessonPage = lazy(() => import('./pages/LessonPage').then((m) => ({ default: m.LessonPage })))
const WorkPage = lazy(() => import('./pages/WorkPage').then((m) => ({ default: m.WorkPage })))
const CertificatePage = lazy(() => import('./pages/CertificatePage').then((m) => ({ default: m.CertificatePage })))
const LedgerPage = lazy(() => import('./pages/LedgerPage').then((m) => ({ default: m.LedgerPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
import { NotFound } from './pages/NotFound'

export function App() {
  const { pathname } = useLocation()
  const inLesson = /^\/c\/[^/]+\/l\//.test(pathname)
  useEffect(() => {
    if (!inLesson) window.scrollTo(0, 0)
  }, [pathname, inLesson])

  return (
    <>
      <div className="margin-rule" aria-hidden />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!inLesson && <Masthead />}
      <main id="main">
        <ContentProblems />
        <Suspense fallback={<div className="page route-loading label label-faint">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/c/:courseId" element={<CoursePage />} />
          <Route path="/c/:courseId/l/:lessonId" element={<LessonPage />} />
          <Route path="/c/:courseId/l/:lessonId/:stepId" element={<LessonPage />} />
          <Route path="/c/:courseId/work" element={<WorkPage />} />
          <Route path="/c/:courseId/certificate" element={<CertificatePage />} />
          <Route path="/c/:courseId/ledger" element={<LedgerPage />} />
          <Route path="/commission" element={<CommissionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/method" element={<MethodPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      {!inLesson && <Footer />}
    </>
  )
}

function Masthead() {
  const { state, setPrefs, sync } = useLearner()
  const dark =
    state.prefs.theme === 'dark' ||
    (state.prefs.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <header className="masthead page no-print">
      <Link to="/" className="wordmark" aria-label={`${SITE.name} — home`}>
        {SITE.name}
        <span className="wordmark-dot" aria-hidden />
      </Link>
      <nav className="mast-nav" aria-label="Main">
        <NavLink to="/" end>
          Shelf
        </NavLink>
        <NavLink to="/commission">Commission</NavLink>
        <NavLink to="/method">Method</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <div className="mast-tools">
        <SyncChip status={sync.status} />
        <button className="icon-btn" onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title="Lamp">
          <Glyph name="lamp" size={18} />
        </button>
      </div>
    </header>
  )
}

function Footer() {
  const { courses } = loadCatalogue()
  const claims = courses.reduce((n, c) => n + Object.keys(c.claims).length, 0)
  return (
    <footer className="site-foot page no-print">
      <div className="site-foot-row">
        <span className="label label-faint">
          {SITE.name} · {courses.length} course{courses.length === 1 ? '' : 's'} · {claims} claims in the ledger
        </span>
        <span className="label label-faint">
          <Link to="/method">How courses are checked</Link> · <Link to="/commission">Commission a course</Link>
        </span>
      </div>
    </footer>
  )
}

/** Shown in development when a content file fails validation. */
function ContentProblems() {
  const { problems } = loadCatalogue()
  if (!problems.length || !import.meta.env.DEV) return null
  return (
    <div className="content-problems page">
      <strong>Content problems</strong> — these courses are hidden until fixed (run <code>npm run validate</code>):
      {problems.map((p) => (
        <details key={p.folder}>
          <summary>
            {p.folder}: {p.issues.length} error(s)
          </summary>
          <ul>
            {p.issues.slice(0, 30).map((i, k) => (
              <li key={k}>
                <code>{i.where}</code> — {i.message}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
