import { Link } from 'react-router'
import { usePageTitle } from '../../components/ui.jsx'
import { DEMO } from '../../env.js'

export function PrivacyPage() {
  usePageTitle('Privacy')
  return (
    <>
      <section className="page-hero container narrow">
        <span className="eyebrow">Privacy</span>
        <h1>Privacy notice</h1>
        <p className="muted">Last updated 5 October 2026</p>
      </section>
      <section className="container narrow prose">
        {DEMO ? (
          <>
            <p>This live version of Pulse is a portfolio demo. It has no server, no accounts and no analytics.</p>
            <h2>What is stored</h2>
            <p>Your sessions, settings, theme and timer are kept in your browser’s local storage on your device. They are never sent anywhere. Clear your browser data, or press Delete all sessions in Settings, to remove them.</p>
            <h2>Fonts</h2>
            <p>The site loads its typefaces from Google Fonts, so your browser contacts Google’s font servers when a page loads.</p>
            <h2>Questions</h2>
            <p>
              <Link to="/contact">Get in touch</Link> any time.
            </p>
          </>
        ) : (
          <>
            <p>Pulse is built so you can use it without telling anyone anything. This notice explains what is stored, where, and how to remove it.</p>
            <h2>Without an account</h2>
            <p>Your sessions, settings and timer state are kept in your browser’s local storage on your device. They are never sent to the server.</p>
            <h2>With an account</h2>
            <ul>
              <li>Your name, email address, and your password stored as a salted scrypt digest, never as text.</li>
              <li>Your sessions, settings, webhooks, API tokens (stored only as a digest), team memberships and assistant questions.</li>
              <li>For each login: when it started and your browser’s user agent, so you can see and end logins in Settings.</li>
            </ul>
            <p>Pulse sets one cookie, <code className="inline-code">pulse_session</code>, which keeps you logged in. There are no analytics or advertising scripts.</p>
            <h2>Email and the assistant</h2>
            <p>Account emails go through an email delivery provider. If the server has an Anthropic API key, an assistant question is sent to Anthropic with summary figures from your sessions; session labels are not sent.</p>
            <h2>Teams</h2>
            <p>Other members of a team see your name and when you joined, never your individual figures. Team totals only appear once at least three people have joined.</p>
            <h2>Your rights</h2>
            <p>
              Download everything stored about you, or delete your account and all of its data, from <Link to="/app/settings">Settings</Link>.
            </p>
          </>
        )}
      </section>
    </>
  )
}
