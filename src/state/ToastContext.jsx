import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../components/Icon.jsx'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (message, { tone = 'info', action, duration = 4500 } = {}) => {
      counter.current += 1
      const id = counter.current
      setToasts((list) => [...list.slice(-3), { id, message, tone, action }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.tone}`}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            >
              <span className="toast-icon" aria-hidden="true">
                {t.tone === 'error' ? <Icon.Alert /> : t.tone === 'success' ? <Icon.Check /> : <Icon.Info />}
              </span>
              <span className="toast-message">{t.message}</span>
              {t.action && (
                <button
                  className="toast-action"
                  type="button"
                  onClick={() => {
                    t.action.onClick()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="toast-close" type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <Icon.X width={14} height={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
