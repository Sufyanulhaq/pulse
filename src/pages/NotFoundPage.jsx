import { Link } from 'react-router'
import { Icon } from '../components/Icon.jsx'
import { usePageTitle } from '../components/ui.jsx'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <section className="container not-found">
      <span className="not-found-code">404</span>
      <h1>This page lost focus</h1>
      <p className="muted">The address may be mistyped, or the page may have moved.</p>
      <div className="row center-row">
        <Link className="btn btn-primary" to="/">
          <Icon.ArrowLeft width={16} height={16} /> Home
        </Link>
        <Link className="btn btn-ghost" to="/app">
          Open the app
        </Link>
      </div>
    </section>
  )
}
