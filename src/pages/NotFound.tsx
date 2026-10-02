import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="page notfound">
      <p className="label">404</p>
      <h1 className="display display-l">Nothing in the margin here.</h1>
      <p className="lede">That page doesn't exist — or the course was renamed.</p>
      <Link to="/" className="btn">
        Back to the shelf
      </Link>
    </div>
  )
}
