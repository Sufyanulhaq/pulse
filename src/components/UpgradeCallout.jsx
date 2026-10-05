import { Icon } from './Icon.jsx'

/** Shown when a server has paid plans switched on and this account's plan does not include a feature. */
export function UpgradeCallout({ children }) {
  return (
    <div className="callout upgrade-callout">
      <span className="row">
        <Icon.Lock width={18} height={18} />
        <span>{children}</span>
      </span>
    </div>
  )
}
