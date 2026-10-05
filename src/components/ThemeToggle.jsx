import { useTheme } from '../state/ThemeContext.jsx'
import { Icon } from './Icon.jsx'

const LABELS = { light: 'Light theme', dark: 'Dark theme', system: 'System theme' }

export function ThemeToggle() {
  const { choice, cycle } = useTheme()
  const IconComp = choice === 'light' ? Icon.Sun : choice === 'dark' ? Icon.Moon : Icon.Monitor
  return (
    <button className="icon-btn" type="button" onClick={cycle} aria-label={`${LABELS[choice]}. Click to change.`} title={LABELS[choice]}>
      <IconComp />
    </button>
  )
}
