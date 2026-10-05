import { newId } from './crypto.js'

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function layout(title, paragraphs, button) {
  const text = [title, '', ...paragraphs, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', 'Pulse'].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:rgb(248,250,252);font-family:system-ui,sans-serif;color:rgb(15,23,42)">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="font-weight:800;font-size:18px;margin-bottom:24px">Pulse</div>
<div style="background:rgb(255,255,255);border:1px solid rgb(226,232,240);border-radius:14px;padding:28px">
<h1 style="font-size:20px;margin:0 0 12px">${escape(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;color:rgb(71,85,105);margin:0 0 12px">${escape(p)}</p>`).join('')}
${button ? `<p style="margin:20px 0 8px"><a href="${escape(button.url)}" style="display:inline-block;background:rgb(37,99,235);color:rgb(255,255,255);padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">${escape(button.label)}</a></p><p style="font-size:12px;color:rgb(100,116,139);word-break:break-all">Or paste this link into your browser: ${escape(button.url)}</p>` : ''}
</div>
<p style="font-size:12px;color:rgb(100,116,139);margin-top:20px">You are getting this because of activity on your Pulse account.</p>
</div></body></html>`
  return { text, html }
}

/** Every email Pulse sends, written in one place. */
export const TEMPLATES = {
  verify: ({ name, url }) => ({
    subject: 'Confirm your email for Pulse',
    ...layout(`Hi ${name}, please confirm your email`, ['Confirm this address so we can reach you about your account, billing and password resets. The link works for 24 hours.'], { label: 'Confirm email', url }),
  }),
  reset: ({ name, url }) => ({
    subject: 'Reset your Pulse password',
    ...layout(`Hi ${name}, reset your password`, ['Someone asked to reset the password for this account. If it was you, use the link below. It works for one hour and only once.', 'If it was not you, ignore this email. Your password has not changed.'], { label: 'Choose a new password', url }),
  }),
  passwordChanged: ({ name }) => ({
    subject: 'Your Pulse password was changed',
    ...layout(`Hi ${name}, your password was changed`, ['Every other device has been logged out. If you did not do this, reset your password straight away and get in touch.']),
  }),
  invite: ({ inviter, team, url }) => ({
    subject: `${inviter} invited you to ${team} on Pulse`,
    ...layout(`Join ${team} on Pulse`, [`${inviter} invited you to their team on Pulse, a focus timer. Teams only ever see totals, never one person's numbers.`, 'Joining is free. The link works for 7 days.'], { label: `Join ${team}`, url }),
  }),
}

/**
 * Sends through Resend when configured. Otherwise logs each email and keeps
 * it in `outbox`, which development and the tests read.
 */
export function createMailer({ config, db, logger, fetchImpl = fetch }) {
  const outbox = []
  const log = db.prepare('INSERT INTO email_log (id, to_address, template, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?)')

  async function send(to, template, data) {
    const message = TEMPLATES[template](data)
    let status = 'sent'
    let error = null
    try {
      if (config.email.provider === 'resend') {
        const res = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.email.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: config.email.from, to: [to], subject: message.subject, html: message.html, text: message.text }),
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
      } else {
        outbox.push({ to, template, ...message, data })
        logger.info({ to, subject: message.subject, text: message.text }, 'email (log provider, not sent)')
      }
    } catch (err) {
      status = 'failed'
      error = err.message
      logger.error({ err, to, template }, 'email failed')
    }
    log.run(newId('em_'), to, template, status, error, Date.now())
    return status === 'sent'
  }

  return { send, outbox, provider: config.email.provider }
}
