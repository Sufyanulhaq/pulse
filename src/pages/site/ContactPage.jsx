import { useState } from 'react'
import { Icon } from '../../components/Icon.jsx'
import { CopyButton, Field, usePageTitle } from '../../components/ui.jsx'
import { MAKER } from '../../data/maker.js'

const TOPICS = ['A project or contract', 'Pulse feedback or a bug', 'A question about the API', 'Something else']

export default function ContactPage() {
  usePageTitle('Contact')
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0], budget: '', message: '' })
  const [errors, setErrors] = useState({})
  const [ready, setReady] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.name.trim()) next.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (form.message.trim().length < 20) next.message = 'Tell me a little more: at least 20 characters.'
    setErrors(next)
    if (Object.keys(next).length) return
    const subject = `${form.topic}: ${form.name.trim()}`
    const body = [form.message.trim(), '', `From: ${form.name.trim()} <${form.email.trim()}>`, form.budget ? `Budget: ${form.budget}` : ''].filter((l) => l !== null).join('\n')
    const href = `mailto:${MAKER.links.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setReady({ subject, body, href })
    window.location.href = href
  }

  return (
    <>
      <section className="page-hero container">
        <span className="eyebrow">Contact</span>
        <h1>Get in touch</h1>
        <p className="hero-sub">For projects, feedback on Pulse or questions about the API. I reply within one working day.</p>
      </section>
      <section className="container contact">
        <form className="card form-grid" onSubmit={submit} noValidate>
          <div className="form-grid form-grid-2">
            <Field label="Your name" error={errors.name}>
              {(p) => <input {...p} className="input" autoComplete="name" value={form.name} onChange={set('name')} />}
            </Field>
            <Field label="Email" error={errors.email}>
              {(p) => <input {...p} className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
            </Field>
          </div>
          <div className="form-grid form-grid-2">
            <Field label="What is it about?">
              {(p) => (
                <select {...p} className="select" value={form.topic} onChange={set('topic')}>
                  {TOPICS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Budget" hint="Optional.">
              {(p) => (
                <select {...p} className="select" value={form.budget} onChange={set('budget')}>
                  <option value="">Prefer not to say</option>
                  <option>Under £1,000</option>
                  <option>£1,000 to £5,000</option>
                  <option>£5,000 to £15,000</option>
                  <option>Over £15,000</option>
                </select>
              )}
            </Field>
          </div>
          <Field label="Message" hint={`${form.message.length} of 2000 characters`} error={errors.message}>
            {(p) => <textarea {...p} className="textarea" rows={7} maxLength={2000} value={form.message} onChange={set('message')} placeholder="What are you building, and where are you stuck?" />}
          </Field>
          <button className="btn btn-primary" type="submit">
            <Icon.Send width={16} height={16} /> Write the email
          </button>
          {ready && (
            <div className="callout callout-good" role="status">
              <Icon.Check width={18} height={18} />
              <div>
                Your email app should have opened with the message ready to send. If it did not, copy it and send it to <strong>{MAKER.links.email}</strong>.
                <div className="row mt-sm">
                  <CopyButton text={`${ready.subject}\n\n${ready.body}`} label="Copy message" />
                  <CopyButton text={MAKER.links.email} label="Copy address" />
                </div>
              </div>
            </div>
          )}
        </form>
        <aside className="contact-side">
          <div className="card">
            <h2>Other ways</h2>
            <ul className="contact-list">
              <li>
                <Icon.Mail />
                <a href={`mailto:${MAKER.links.email}`}>{MAKER.links.email}</a>
              </li>
              <li>
                <Icon.Briefcase />
                <a href={MAKER.links.upwork} target="_blank" rel="noreferrer">
                  Upwork profile
                </a>
              </li>
              <li>
                <Icon.Users />
                <a href={MAKER.links.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              </li>
              <li>
                <Icon.Github />
                <a href="https://github.com/Sufyanulhaq/pulse/issues" target="_blank" rel="noreferrer">
                  Report a bug on GitHub
                </a>
              </li>
            </ul>
          </div>
          <div className="card">
            <h2>Based in</h2>
            <p className="muted">{MAKER.location}. Working with clients in the UK, Europe and North America.</p>
          </div>
        </aside>
      </section>
    </>
  )
}
