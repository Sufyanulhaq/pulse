import { Link } from 'react-router'
import { Icon } from './Icon.jsx'

export function Brand({ to = '/' }) {
  return (
    <Link className="brand" to={to} aria-label="Pulse home">
      <span className="brand-mark" aria-hidden="true">
        <Icon.Target width={16} height={16} />
      </span>
      Pulse
    </Link>
  )
}
