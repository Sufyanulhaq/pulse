import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from './Icon.jsx'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Pulse` : 'Pulse · Deep focus, measured'
  }, [title])
}

export function Reveal({ children, delay = 0, className, as = 'div' }) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      {children}
    </Tag>
  )
}

export function SectionHead({ eyebrow, title, sub, align = 'center' }) {
  return (
    <div className={`section-head section-head-${align}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  )
}

export function Field({ label, hint, error, children, id: givenId, className = '' }) {
  const autoId = useId()
  const id = givenId || autoId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId()
  return (
    <div className="toggle-row">
      <div>
        <label className="toggle-label" htmlFor={id}>
          {label}
        </label>
        {description && <p className="toggle-desc">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className="switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  )
}

export function Segmented({ value, onChange, options, label, size = 'md' }) {
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge-pill badge-${tone}`}>{children}</span>
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="spinner" role="status">
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function EmptyState({ icon: IconComp = Icon.Sparkle, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        <IconComp width={22} height={22} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        const list = [...items].filter((el) => !el.disabled)
        if (!list.length) return
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    setTimeout(() => ref.current?.querySelector('input, textarea, select, button:not(.modal-close)')?.focus(), 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref}
            className={`modal modal-${size}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="modal-head">
              <h2 id={titleId}>{title}</h2>
              <button className="icon-btn modal-close" type="button" onClick={onClose} aria-label="Close">
                <Icon.X />
              </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger = false }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

export function CopyButton({ text, label = 'Copy', className = 'btn btn-ghost btn-sm' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          const area = document.createElement('textarea')
          area.value = text
          document.body.appendChild(area)
          area.select()
          document.execCommand('copy')
          area.remove()
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? <Icon.Check width={15} height={15} /> : <Icon.Copy width={15} height={15} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>
}

export function Stat({ label, value, sub, delta, icon: IconComp }) {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <span className="stat-card-label">{label}</span>
        {IconComp && (
          <span className="stat-card-icon" aria-hidden="true">
            <IconComp width={16} height={16} />
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-sub">
        {delta !== undefined && delta !== null ? (
          <span className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {Math.abs(Math.round(delta * 100))}%
          </span>
        ) : delta === null ? (
          <span className="delta">n/a</span>
        ) : null}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}
