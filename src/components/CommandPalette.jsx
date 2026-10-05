import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './Icon.jsx'
import { useTheme } from '../state/ThemeContext.jsx'
import { useTimer } from '../state/TimerContext.jsx'
import { useAuth } from '../state/AuthContext.jsx'
import { Kbd } from './ui.jsx'

/** Ctrl K or Cmd K opens a searchable list of pages and actions. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const timer = useTimer()
  const { user, logout } = useAuth()
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pulse:command', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pulse:command', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const commands = useMemo(() => {
    const go = (to) => () => navigate(to)
    const list = [
      { group: 'Actions', label: timer.timer.status === 'running' ? 'Pause timer' : 'Start timer', icon: Icon.Play, run: () => { navigate('/app'); timer.toggle() } },
      { group: 'Actions', label: 'Log an interruption', icon: Icon.Bell, run: timer.interrupt, hidden: timer.timer.phase !== 'focus' || timer.timer.status === 'idle' },
      { group: 'Actions', label: 'Ask the assistant', icon: Icon.Message, run: go('/app/assistant') },
      { group: 'Actions', label: 'Use light theme', icon: Icon.Sun, run: () => setTheme('light') },
      { group: 'Actions', label: 'Use dark theme', icon: Icon.Moon, run: () => setTheme('dark') },
      { group: 'Actions', label: 'Match system theme', icon: Icon.Monitor, run: () => setTheme('system') },
      { group: 'App', label: 'Timer', icon: Icon.Clock, run: go('/app') },
      { group: 'App', label: 'Insights', icon: Icon.Chart, run: go('/app/insights') },
      { group: 'App', label: 'History', icon: Icon.List, run: go('/app/history') },
      { group: 'App', label: 'Teams', icon: Icon.Users, run: go('/app/teams') },
      { group: 'App', label: 'Webhooks and API tokens', icon: Icon.Plug, run: go('/app/developer') },
      { group: 'App', label: 'Settings', icon: Icon.Settings, run: go('/app/settings') },
      { group: 'Site', label: 'Home', icon: Icon.Target, run: go('/') },
      { group: 'Site', label: 'Features', icon: Icon.Layers, run: go('/features') },
      { group: 'Site', label: 'Pricing', icon: Icon.Briefcase, run: go('/pricing') },
      { group: 'Site', label: 'Developers and API reference', icon: Icon.Code, run: go('/developers') },
      { group: 'Site', label: 'Integrations', icon: Icon.Plug, run: go('/integrations') },
      { group: 'Site', label: 'Changelog', icon: Icon.List, run: go('/changelog') },
      { group: 'Site', label: 'About the maker', icon: Icon.Users, run: go('/about') },
      { group: 'Site', label: 'Contact', icon: Icon.Mail, run: go('/contact') },
      user
        ? { group: 'Account', label: 'Log out', icon: Icon.Logout, run: () => logout().then(() => navigate('/')) }
        : { group: 'Account', label: 'Log in', icon: Icon.Lock, run: go('/login') },
    ]
    return list.filter((c) => !c.hidden)
  }, [navigate, setTheme, timer, user, logout])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
  }, [commands, query])

  const run = useCallback(
    (cmd) => {
      setOpen(false)
      cmd.run()
    },
    [],
  )

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(filtered.length - 1, i + 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    }
    if (e.key === 'Enter' && filtered[index]) run(filtered[index])
  }

  let lastGroup = ''
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <motion.div className="palette" role="dialog" aria-modal="true" aria-label="Command menu" initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            <div className="palette-search">
              <Icon.Search />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setIndex(0)
                }}
                onKeyDown={onKeyDown}
                placeholder="Search pages and actions"
                aria-label="Search pages and actions"
                aria-controls="palette-list"
                aria-activedescendant={filtered[index] ? `cmd-${index}` : undefined}
                role="combobox"
                aria-expanded="true"
              />
              <Kbd>Esc</Kbd>
            </div>
            <ul className="palette-list" id="palette-list" role="listbox">
              {filtered.length === 0 && <li className="palette-empty">No matches for “{query}”.</li>}
              {filtered.map((cmd, i) => {
                const showGroup = cmd.group !== lastGroup
                lastGroup = cmd.group
                const CmdIcon = cmd.icon
                return (
                  <li key={cmd.group + cmd.label} role="presentation">
                    {showGroup && <div className="palette-group">{cmd.group}</div>}
                    <div
                      id={`cmd-${i}`}
                      role="option"
                      aria-selected={i === index}
                      className={`palette-item ${i === index ? 'active' : ''}`}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => run(cmd)}
                    >
                      <CmdIcon width={16} height={16} />
                      {cmd.label}
                    </div>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
