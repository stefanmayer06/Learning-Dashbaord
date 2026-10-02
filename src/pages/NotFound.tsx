import { Link } from 'react-router-dom'
import { Glyph } from '../ui/Glyph'

export function NotFound() {
  return (
    <div className="page not-found">
      <div className="empty-state">
        <span className="glyph-tile notfound-tile" aria-hidden>
          <Glyph name="search" size={26} />
        </span>
        <p className="eyebrow">Error 404</p>
        <h1 className="display-m">We can't find that page</h1>
        <p className="lede">The link may be out of date, or the course may have been renamed.</p>
        <div className="btn-row notfound-actions">
          <Link to="/" className="btn btn-large">
            Back to courses <Glyph name="arrow" className="arrow" size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
