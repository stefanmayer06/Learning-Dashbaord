import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { loadCatalogue } from './content/loader'
import { SiteFooter, SiteHeader } from './ui/Shell'
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
    if (!inLesson && !window.location.hash) window.scrollTo(0, 0)
  }, [pathname, inLesson])

  return (
    <>
      <div className="margin-rule" aria-hidden />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!inLesson && <SiteHeader />}
      <main id="main">
        <ContentProblems />
        <Suspense fallback={<div className="page route-loading">Loading…</div>}>
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
      {!inLesson && <SiteFooter />}
    </>
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
