Pulse
=====

A focus timer that learns how your attention moves through the day, then tells you what to change. Pulse is a complete product: a React front end, a Node and SQLite API, accounts, teams, signed webhooks, a personal API and an assistant that answers from your own data.

Everything works without an account. Sessions stay in the browser until you choose to sync them.


What is in it
-------------

**Timer.** Focus blocks, short and long breaks, rounds, interruption logging, ambient noise made with the Web Audio API, chimes and desktop notifications. Time is read from timestamps, so sleeping laptops and background tabs never make it drift, and a reload carries on where it was.

**Insights.** Focused time per day against your goal, an hour by weekday heatmap, time by tag, streaks, and a focus score whose formula is printed under it. Every period is compared with the one before, and a missing comparison says n/a rather than inventing a percentage.

**History.** Search, filter, sort, page, edit and delete sessions. Export CSV (formulas neutralised) or a JSON backup, and import it again.

**Assistant.** Ask "when do I focus best?" and every figure in the answer is numbered and linked to the fact it came from. With an `ANTHROPIC_API_KEY` on the server, Claude writes the answer using structured output and server side fallbacks; without one, a rule based answerer does. Citations that point at nothing are removed, an answer that cites nothing is not trusted, the question is escaped and passed as data, and any failure falls back to the offline answerer.

**Accounts.** Salted scrypt passwords, five failed logins lock an email for 15 minutes, HttpOnly SameSite cookies with only a digest of the token stored, a header check against cross site forgery, per device login list, password change that logs out other devices, full data export and account deletion.

**Sync.** Logged in, the server is the source of truth. A session that fails to save waits in an outbox and is retried when the connection returns. Sessions recorded before logging in can be moved to the account in one click.

**Teams.** Invite codes and links, owner controls (rename, new code, remove, hand over, delete). Team figures appear only once three people have joined, and only as totals, so nobody can work out a colleague's numbers.

**Webhooks.** `session.completed`, `session.deleted` and `goal.reached`, signed with HMAC SHA 256 over the timestamp and raw body. Retries on network errors, 408, 429 and 5xx with doubling delays and Retry After; stops at once on other 4xx; never follows redirects. Private network addresses are refused when saved and again before each delivery. Every delivery is logged and failed ones can be replayed.

**API.** Personal tokens, read only or read and write, stored only as digests. Documented on the Developers page, with an in browser signature checker.

**Billing.** Personal, Pro and Team plans through Stripe Checkout, monthly or yearly, with per seat pricing for teams and the Stripe customer portal for cards, invoices and cancelling. Plans follow signed Stripe webhooks (duplicates ignored, failures retried by Stripe). A plan that lapses pauses webhooks and API tokens without deleting anything. With no Stripe key the server runs in beta mode and every feature is free.

**Email.** Address confirmation, forgotten password reset (one hour, single use, ends every login), a notice when a password changes, and team invites by email. Sent through Resend, or printed to the log in development.

**Backups.** Scheduled online copies of the SQLite database to `BACKUP_DIR`, keeping the newest `BACKUP_KEEP`, plus `npm run backup` and a Back up now button for admins.

**Site.** Home with a live product tour built from the real components, features, pricing with a seat calculator, developer docs, integrations, changelog, about the maker with a skills to projects filter, contact, privacy and terms. Light and dark themes, a Ctrl K command menu, keyboard shortcuts, reduced motion support, and no sideways scrolling from 375px up.


Run it
------

Needs Node 22.13 or newer (the server uses the built in `node:sqlite`).

```bash
npm install
npm run dev
```

This starts the API on port 3001 and the site on port 5173, with `/api` proxied. Open http://localhost:5173.


Test it
-------

```bash
npm test
npm run build
npm run test:e2e
npm run lint
```

GitHub Actions runs all four on every push and pull request (`.github/workflows/ci.yml`).

`npm test` runs the unit and API tests with Vitest. `npm run test:e2e` drives the built app in Chromium: the timer, sync, webhooks, tokens, teams, themes and every page at phone width.

The API tests start the real server against an in memory database and a local webhook receiver. They cover sign up and lockout, the forgery check, privacy between accounts, validation, import, CSV escaping, stats, token scopes, webhook signing, retries, refusals, redirects and replay, the private network guard, team privacy thresholds, and the assistant with a stand in Claude client (success, refusal, failure, uncited answers, no data).


Configuration
-------------

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3001 | Port the server listens on |
| `DATABASE_PATH` | `data/pulse.db` | SQLite file. Put it on a persistent disk in production |
| `ADMIN_EMAILS` | none | Comma separated emails that can open the admin overview |
| `ANTHROPIC_API_KEY` | none | Turns on Claude written assistant answers |
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Model for the assistant |
| `SESSION_DAYS` | 30 | How long a login lasts |
| `WEBHOOK_MAX_ATTEMPTS` | 5 | Tries before a delivery is marked failed |
| `WEBHOOK_BASE_DELAY_MS` | 10000 | First retry delay, doubling each time |
| `WEBHOOK_ALLOW_HTTP` | off in production | Allow plain http webhook URLs |
| `WEBHOOK_ALLOW_PRIVATE` | off | Allow private network webhook URLs (testing only) |
| `TRUST_PROXY` | on in production | Read the client address from the proxy |
| `APP_URL` | `http://localhost:5173` | Public address, used in email links and Stripe redirects |
| `STRIPE_SECRET_KEY` | none | Turns on paid plans. Without it every feature is free (beta mode) |
| `STRIPE_WEBHOOK_SECRET` | none | Signing secret of the Stripe webhook endpoint |
| `STRIPE_CURRENCY` | `gbp` | Currency for prices |
| `RESEND_API_KEY` | none | Sends email through Resend. Without it emails are printed to the log |
| `EMAIL_FROM` | `Pulse <hello@pulse.local>` | Sender address, on a domain verified with Resend |
| `BACKUP_DIR` | none | Folder for scheduled database backups. Off when unset |
| `BACKUP_INTERVAL_HOURS` | 24 | How often to back up |
| `BACKUP_KEEP` | 7 | How many backups to keep |
| `AUTH_RATE_LIMIT` | 20 | Sign up, log in and reset attempts per minute per address |

In production (`NODE_ENV=production`) the same server serves the built front end, sets Secure cookies and HSTS, and expects to sit behind https.


Setting up payments
-------------------

1. In the Stripe dashboard (test mode first), copy the secret key into `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint pointing at `https://YOUR_HOST/api/stripe/webhook` with the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Turn on the customer portal in Stripe's billing settings.
4. Prices are set in `server/plans.js`, so there is nothing to create in Stripe by hand.

To try it locally, run `stripe listen --forward-to localhost:3001/api/stripe/webhook` and use the secret it prints. Card `4242 4242 4242 4242` pays successfully in test mode.


Setting up email
----------------

Create a Resend account, verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`. Every email sent or failed is recorded in the `email_log` table and failures are counted on the admin page.


Deploy
------

Pulse keeps its data in SQLite and runs a webhook worker, so it needs one long running server with a persistent disk. A `Dockerfile` is included, plus ready configs for two hosts:

* **Fly.io:** `fly launch --copy-config --no-deploy`, `fly volumes create pulse_data --size 1`, `fly secrets set ADMIN_EMAILS=you@example.com APP_URL=https://your-app.fly.dev`, add the Stripe and Resend secrets the same way, then `fly deploy`. Set `BACKUP_DIR=/data/backups` and copy that folder off the machine regularly (for example with `fly ssh sftp`) so backups survive losing the volume.
* **Render:** create a Blueprint from this repository; `render.yaml` sets up the service, health check and disk.

Serverless hosts that throw the disk away between requests are not a good fit for this server.


Project layout
--------------

```
server/            Express API, auth, webhooks worker, assistant
server/routes/     one file per area of the API
src/lib/           timer, stats, assistant, CSV and signing logic shared by browser and server
src/state/         React providers: theme, toasts, auth, data sync, timer
src/components/    layout, charts, command menu, form and dialog parts
src/pages/site/    marketing and documentation pages
src/pages/app/     the app: timer, insights, history, assistant, teams, developer, settings, admin
tests/             Vitest unit and API tests, and the Playwright end to end run
```


Licence
-------

MIT
