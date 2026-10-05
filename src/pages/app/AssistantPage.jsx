import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../api.js'
import { useAuth } from '../../state/AuthContext.jsx'
import { useData } from '../../state/DataContext.jsx'
import { useToast } from '../../state/ToastContext.jsx'
import { SUGGESTED_QUESTIONS, answerOffline, buildFacts } from '../../lib/assistant.js'
import { Icon } from '../../components/Icon.jsx'
import { Badge, Spinner, usePageTitle } from '../../components/ui.jsx'

const MODE_LABEL = {
  claude: 'Written by Claude',
  offline: 'Offline answer',
  offline_fallback: 'Offline (fallback)',
  local: 'Answered in your browser',
}

/** Swap [fact_id] markers for numbered references that match the sources list. */
function renderAnswer(text, citations) {
  const order = citations.map((c) => c.id)
  const parts = text.split(/(\[[a-z_]+\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[([a-z_]+)\]$/)
    if (!m) return <span key={i}>{part}</span>
    const n = order.indexOf(m[1]) + 1
    if (!n) return null
    return (
      <sup key={i} className="cite" title={citations[n - 1].label}>
        {n}
      </sup>
    )
  })
}

function Message({ message }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.li className="chat-turn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="chat-q">{message.question}</div>
      <div className={`chat-a ${message.answerable ? '' : 'chat-a-muted'}`}>
        <div className="chat-a-head">
          <span className="chat-avatar" aria-hidden="true">
            <Icon.Sparkle width={14} height={14} />
          </span>
          <Badge tone={message.mode === 'claude' ? 'primary' : 'neutral'}>{MODE_LABEL[message.mode] || message.mode}</Badge>
          {!message.answerable && <Badge tone="warn">Not in your data</Badge>}
        </div>
        <p>{renderAnswer(message.answer, message.citations)}</p>
        {message.citations.length > 0 && (
          <div className="sources">
            <button className="link-btn small" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide' : 'Show'} the {message.citations.length} figure{message.citations.length === 1 ? '' : 's'} this used
            </button>
            {open && (
              <ol className="source-list">
                {message.citations.map((c) => (
                  <li key={c.id}>
                    <span>{c.label}</span>
                    <strong>{c.value}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </motion.li>
  )
}

export default function AssistantPage() {
  usePageTitle('Assistant')
  const { user } = useAuth()
  const { sessions, settings } = useData()
  const { toast } = useToast()
  const [messages, setMessages] = useState([])
  const [mode, setMode] = useState(user ? null : 'local')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (!user) {
      setMode('local')
      return
    }
    api
      .get('/assistant')
      .then((r) => {
        setMessages(r.messages)
        setMode(r.mode)
      })
      .catch(() => setMode('offline'))
  }, [user])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const facts = useMemo(() => buildFacts(sessions, settings), [sessions, settings])

  const ask = async (q) => {
    const text = q.trim()
    if (!text || busy) return
    setQuestion('')
    if (!user) {
      const r = answerOffline(text, facts)
      setMessages((list) => [...list, { id: `${Date.now()}`, question: text, ...r, mode: 'local' }])
      return
    }
    setBusy(true)
    try {
      const r = await api.post('/assistant', { question: text })
      setMessages((list) => [...list, r.message])
    } catch (err) {
      toast(err.message, { tone: 'error' })
      setQuestion(text)
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    if (user) await api.del('/assistant').catch(() => {})
    setMessages([])
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assistant</h1>
          <p>Ask about your own focus data in plain English. Every answer points at the exact figures it used, and if your data cannot answer, it says so.</p>
        </div>
        <div className="row">
          {mode && <Badge tone={mode === 'claude' ? 'primary' : 'neutral'}>{mode === 'claude' ? 'Claude mode' : mode === 'local' ? 'In browser' : 'Offline mode'}</Badge>}
          {messages.length > 0 && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={clear}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="card chat">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-icon" aria-hidden="true">
              <Icon.Message width={22} height={22} />
            </span>
            <h2>What would you like to know?</h2>
            <p className="muted">
              {sessions.length ? `Answers come from your ${sessions.length} recorded sessions.` : 'Record a few sessions first, or load sample data in Settings.'}
            </p>
          </div>
        ) : (
          <ul className="chat-list" aria-live="polite">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
            {busy && (
              <li className="chat-turn">
                <div className="chat-a chat-a-muted">
                  <Spinner label="Thinking" /> <span className="small muted">Working it out from your data…</span>
                </div>
              </li>
            )}
            <li ref={endRef} aria-hidden="true" />
          </ul>
        )}

        <div className="chips" aria-label="Suggested questions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} className="chip" type="button" onClick={() => ask(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>

        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault()
            ask(question)
          }}
        >
          <label className="sr-only" htmlFor="ask">
            Your question
          </label>
          <input
            id="ask"
            className="input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="For example: when am I least interrupted?"
            maxLength={500}
            autoComplete="off"
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !question.trim()}>
            <Icon.Send width={16} height={16} /> Ask
          </button>
        </form>
      </div>
    </>
  )
}
