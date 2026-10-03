import { Link } from 'react-router-dom'
import { Glyph } from '../ui/Glyph'
import { useDocumentTitle } from '../ui/useDocumentTitle'

export function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <div className="page not-found">
      <div className="empty-state">
        <span className="glyph-tile empty-tile" aria-hidden>
          <Glyph name="search" size={26} />
        </span>
        <span className="badge badge-neutral">Error 404</span>
        <h1 className="display-m">We can't find that page</h1>
        <p className="lede">The link may be out of date, or the course may have been renamed.</p>
        <div className="btn-row empty-actions">
          <Link to="/" className="btn btn-large">
            Back to courses <Glyph name="arrow" className="arrow" size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
