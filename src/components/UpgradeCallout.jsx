import { Link } from 'react-router'
import { Icon } from './Icon.jsx'

export function UpgradeCallout({ children, plan = 'Pro' }) {
  return (
    <div className="callout upgrade-callout">
      <span className="row">
        <Icon.Zap width={18} height={18} />
        <span>{children}</span>
      </span>
      <Link className="btn btn-primary btn-sm" to="/app/billing">
        See {plan}
      </Link>
    </div>
  )
}
