import { DEMO, REPO_URL } from '../env.js'
import { Icon } from './Icon.jsx'

/** A short note on pages that describe parts the static demo does not run. */
export function DemoNote({ children }) {
  if (!DEMO) return null
  return (
    <div className="callout demo-note">
      <Icon.Info width={18} height={18} />
      <div>
        {children}{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          See the source on GitHub
        </a>
        .
      </div>
    </div>
  )
}
