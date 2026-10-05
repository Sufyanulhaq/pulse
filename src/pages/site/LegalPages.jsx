import { Link } from 'react-router'
import { usePageTitle } from '../../components/ui.jsx'

function Legal({ title, updated, children }) {
  return (
    <>
      <section className="page-hero container narrow">
        <span className="eyebrow">Legal</span>
        <h1>{title}</h1>
        <p className="muted">Last updated {updated}</p>
      </section>
      <section className="container narrow prose">{children}</section>
    </>
  )
}

export function PrivacyPage() {
  usePageTitle('Privacy')
  return (
    <Legal title="Privacy notice" updated="5 October 2026">
      <p>Pulse is built so you can use it without telling anyone anything. This notice explains exactly what is stored, where, and how to remove it.</p>
      <h2>Without an account</h2>
      <p>Your sessions, settings and timer state are kept in your browser’s local storage on your device. They are never sent to the server. Clearing your browser data removes them.</p>
      <h2>With an account</h2>
      <ul>
        <li>Your name, email address, and your password stored as a salted scrypt digest, never as text.</li>
        <li>Your sessions, settings, webhooks, API tokens (stored only as a digest), team memberships and assistant questions.</li>
        <li>For each login: when it started and your browser’s user agent, so you can see and end logins in Settings.</li>
      </ul>
      <p>Pulse sets one cookie, <code className="inline-code">pulse_session</code>, which keeps you logged in. It is HttpOnly and SameSite, and is not used for tracking. There are no analytics or advertising scripts.</p>
      <h2>Payments and email</h2>
      <p>Payments are handled by Stripe. Your card details go straight to Stripe and never reach Pulse; we keep your Stripe customer number and the state of your plan. Account emails (confirming your address, password resets, team invites) are sent through an email delivery provider, which receives the recipient address and the message.</p>
      <h2>The assistant</h2>
      <p>If the server is set up with an Anthropic API key, a question you ask the assistant is sent to Anthropic together with summary figures computed from your sessions (totals, averages, best hours and tags). Individual session labels are not sent. Without a key, answers are worked out on the server and nothing leaves it.</p>
      <h2>Teams</h2>
      <p>Other members of a team see your name and when you joined. They never see your individual figures. Team totals are only shown once at least three people have joined.</p>
      <h2>Webhooks</h2>
      <p>When you add a webhook, the events you choose are sent to the URL you give. You are responsible for what happens to the data there.</p>
      <h2>Fonts</h2>
      <p>The site loads its typefaces from Google Fonts, so your browser contacts Google’s font servers when a page loads.</p>
      <h2>Your rights</h2>
      <p>
        You can download everything stored about you, or delete your account and all of its data, from <Link to="/app/settings">Settings</Link> at any time. For anything else, <Link to="/contact">get in touch</Link>.
      </p>
    </Legal>
  )
}

export function TermsPage() {
  usePageTitle('Terms')
  return (
    <Legal title="Terms of use" updated="5 October 2026">
      <p>These terms cover your use of Pulse. They are short on purpose.</p>
      <h2>Plans and payment</h2>
      <p>The Personal plan is free. Pro and Team are paid subscriptions, billed in advance each month or year through Stripe, and renew automatically until you cancel. You can cancel from Billing in the app at any time; your plan then runs to the end of the period already paid for and is not renewed. Prices are shown before you pay. If prices change, you will be told by email at least 30 days before your next renewal.</p>
      <p>If a payment fails, Stripe tries again for a short time and your plan keeps working meanwhile. If it still fails, the account moves to the Personal plan. Your data is not deleted.</p>
      <p>While billing is switched off during the beta, every feature is free.</p>
      <h2>Your account</h2>
      <p>Keep your password and API tokens secret. You are responsible for what is done with them. Tell us straight away if you think one has leaked, and revoke it in the app.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not try to reach other people’s data, or to get round rate limits or security checks.</li>
        <li>Do not point webhooks at systems you do not have permission to send to.</li>
        <li>Do not use the service to send spam or anything unlawful.</li>
      </ul>
      <h2>Your data</h2>
      <p>Your sessions are yours. You can export or delete them at any time. We do not sell data and do not use it for advertising.</p>
      <h2>No warranty</h2>
      <p>Pulse is provided as it is. We work hard to keep it available and correct, but we cannot promise it will never be down or wrong, and we are not liable for losses from relying on it. Keep backups of anything important.</p>
      <h2>Open source</h2>
      <p>The code is released under the MIT licence. These terms cover the hosted service, not copies you run yourself.</p>
    </Legal>
  )
}
