/**
 * End to end check of the built app in a real browser.
 * Starts the production server on a spare port with a throwaway database,
 * then walks through the main journeys. Run after `npm run build`.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const SHOTS = process.env.E2E_SHOTS || join(tmpdir(), 'pulse-e2e-shots')
mkdirSync(SHOTS, { recursive: true })
const dir = mkdtempSync(join(tmpdir(), 'pulse-e2e-'))
const port = 4100 + Math.floor(Math.random() * 500)
const base = `http://127.0.0.1:${port}`

let failures = 0
const results = []
async function step(name, fn) {
  let timer
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Step took longer than 60 seconds')), 60_000)
  })
  try {
    await Promise.race([fn(), limit])
    results.push(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    results.push(`  FAIL ${name}\n       ${String(err.message).split('\n')[0]}`)
  } finally {
    clearTimeout(timer)
  }
  console.log(results[results.length - 1])
}
function assert(cond, message) {
  if (!cond) throw new Error(message)
}

// A webhook receiver on localhost.
const hookCalls = []
const hook = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    hookCalls.push({ headers: req.headers, body })
    res.writeHead(200)
    res.end('ok')
  })
})
await new Promise((r) => hook.listen(0, '127.0.0.1', r))
const hookUrl = `http://127.0.0.1:${hook.address().port}/hook`

const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    DATABASE_PATH: join(dir, 'pulse.db'),
    ADMIN_EMAILS: 'admin@example.com',
    WEBHOOK_ALLOW_PRIVATE: '1',
    WEBHOOK_ALLOW_HTTP: '1',
    TRUST_PROXY: '0',
    ANTHROPIC_API_KEY: '',
    APP_URL: base,
    EMAIL_PROVIDER: 'log',
    STRIPE_SECRET_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stderr.on('data', (d) => process.stderr.write(d))
// With the log email provider the server prints each email; the tests read links from it.
let serverOut = ''
server.stdout.on('data', (d) => (serverOut += d))
function lastLink(kind) {
  const matches = [...serverOut.matchAll(new RegExp(`${base.replace(/[.:/]/g, (c) => `\\${c}`)}/${kind}\\?token=[A-Za-z0-9_-]+`, 'g'))]
  return matches.length ? matches[matches.length - 1][0] : null
}
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`${base}/api/health`)).ok) break
  } catch {
    await new Promise((r) => setTimeout(r, 100))
  }
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(msg.text()) && !/Failed to load resource/.test(msg.text())) consoleErrors.push(`${page.url()}: ${msg.text()}`)
})
page.on('pageerror', (err) => consoleErrors.push(`${page.url()}: ${err.message}`))

const SITE_PAGES = ['/', '/features', '/pricing', '/developers', '/developers?tab=webhooks', '/developers?tab=endpoints', '/integrations', '/changelog', '/about', '/contact', '/privacy', '/terms', '/nope']

await step('every site page renders a heading without errors', async () => {
  for (const path of SITE_PAGES) {
    await page.goto(base + path)
    await page.locator('h1').first().waitFor({ timeout: 5000 })
  }
  await page.goto(base + '/')
  await page.screenshot({ path: join(SHOTS, 'home-desktop.png'), fullPage: false })
})

await step('no horizontal scroll at phone width on any page', async () => {
  const phone = await browser.newPage({ viewport: { width: 375, height: 800 } })
  for (const path of [...SITE_PAGES, '/app', '/app/insights', '/app/history', '/app/assistant', '/app/settings', '/login', '/signup']) {
    await phone.goto(base + path)
    await phone.locator('h1, .dial').first().waitFor({ timeout: 5000 })
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 0, `${path} scrolls sideways by ${overflow}px`)
  }
  await phone.goto(base + '/')
  await phone.screenshot({ path: join(SHOTS, 'home-phone.png'), fullPage: true })
  await phone.close()
})

await step('signature checker validates a signed body', async () => {
  await page.goto(base + '/developers?tab=checker')
  await page.getByRole('button', { name: 'Sign it for me' }).click()
  await page.getByRole('button', { name: 'Verify' }).click()
  await page.getByText('Signature is valid and the timestamp is fresh.').waitFor()
})

await step('the timer finishes a block and records it', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const p = await ctx.newPage()
  await p.clock.install()
  await p.goto(base + '/app/settings')
  const focus = p.getByLabel('Focus block')
  await focus.fill('1')
  await focus.press('Enter')
  await p.goto(base + '/app')
  await p.getByLabel('What are you focusing on?').fill('Write the e2e test')
  await p.getByRole('button', { name: 'Start focus' }).click()
  await p.keyboard.press('i')
  await p.clock.runFor(61_000)
  await p.getByText(/Focus block done/).waitFor({ timeout: 5000 })
  await p.getByText('Write the e2e test').first().waitFor()
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('pulse.sessions')))
  assert(stored.length === 1 && stored[0].completed && stored[0].interruptions === 1, 'session not saved correctly')
  await ctx.close()
})

await step('sample data fills insights, history and the in browser assistant', async () => {
  await page.goto(base + '/app/settings')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await page.getByText(/Loaded \d+ sample sessions/).waitFor()
  await page.goto(base + '/app/insights')
  await page.getByText('Focused time per day').waitFor()
  await page.locator('.chart-svg').first().waitFor()
  await page.screenshot({ path: join(SHOTS, 'insights.png'), fullPage: true })
  await page.goto(base + '/app/history')
  await page.getByText(/\d+ sessions · /).waitFor()
  await page.getByLabel('Filter by tag').selectOption('Writing')
  const rows = await page.locator('tbody tr').count()
  assert(rows > 0, 'filter returned no rows')
  await page.goto(base + '/app/assistant')
  await page.getByRole('button', { name: 'When do I focus best?' }).click()
  await page.locator('.chat-a').first().waitFor()
  await page.getByRole('button', { name: /Show the \d+ figure/ }).first().click()
  await page.screenshot({ path: join(SHOTS, 'assistant.png') })
})

await step('the command menu opens with Ctrl K and navigates', async () => {
  await page.goto(base + '/')
  await page.locator('h1').first().waitFor()
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder('Search pages and actions').fill('pricing')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/pricing$/)
})

await step('sign up, move local sessions to the account', async () => {
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('pulse.sessions') || '[]')
    const start = Date.now() - 2 * 3_600_000
    list.push({ id: 'e2e-local-1', start, end: start + 25 * 60_000, minutes: 25, planned: 25, label: 'Recorded before sign up', tag: 'Writing', interruptions: 0, completed: true })
    localStorage.setItem('pulse.sessions', JSON.stringify(list))
  })
  await page.goto(base + '/signup')
  await page.getByLabel('Name').fill('Admin Person')
  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password', { exact: true }).fill('a strong test password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL(/\/app$/)
  await page.getByText(/saved in this browser from before you logged in/).waitFor()
  await page.getByRole('button', { name: 'Add them to my account' }).click()
  await page.getByText(/Added 1 session to your account/).waitFor()
  const res = await page.evaluate(() => fetch('/api/sessions').then((r) => r.json()))
  assert(res.sessions.some((x) => x.id === 'e2e-local-1'), 'the local session did not reach the server')
  await page.goto(base + '/app/settings')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await page.getByText(/Loaded \d+ sample sessions/).waitFor()
})

await step('confirm email from the link in the welcome email', async () => {
  const link = lastLink('verify')
  assert(link, 'no verify link was printed')
  await page.goto(link)
  await page.getByRole('heading', { name: 'Email confirmed' }).waitFor()
  const me = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()))
  assert(me.user.emailVerified, 'email not marked as confirmed')
})

await step('billing page explains the free beta', async () => {
  await page.goto(base + '/app/billing')
  await page.getByText('Pulse is in public beta, so every feature is free.').waitFor()
})

await step('webhook: add, send test, delivered and signed', async () => {
  await page.goto(base + '/app/developer')
  await page.getByRole('button', { name: 'Add webhook' }).first().click()
  await page.getByLabel('Endpoint URL').fill(hookUrl)
  await page.getByLabel('Description').fill('Local receiver')
  await page.getByRole('dialog').getByRole('button', { name: 'Add webhook' }).click()
  await page.getByText('Your signing secret').waitFor()
  const secret = (await page.locator('.secret-box').innerText()).trim()
  await page.getByRole('button', { name: 'I have saved it' }).click()
  await page.getByRole('button', { name: 'Send test' }).click()
  await page.getByText(/Test delivered/).waitFor()
  assert(hookCalls.length === 1 && hookCalls[0].headers['x-pulse-event'] === 'ping', 'receiver did not get the ping')
  assert(secret.startsWith('whsec_'), 'secret not shown')
  await page.screenshot({ path: join(SHOTS, 'developer.png'), fullPage: true })
})

await step('API token works with curl style requests', async () => {
  await page.getByLabel('Token name').fill('E2E')
  await page.getByRole('button', { name: 'Create token' }).click()
  const token = (await page.locator('.secret-box').innerText()).trim()
  await page.getByRole('button', { name: 'I have saved it' }).click()
  const res = await fetch(`${base}/api/stats?days=7`, { headers: { Authorization: `Bearer ${token}` } })
  assert(res.status === 200, `token request returned ${res.status}`)
})

await step('teams: create and see the privacy threshold', async () => {
  await page.goto(base + '/app/teams')
  await page.getByLabel('Team name').fill('Platform')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByText(/Team numbers unlock at 3 members/).waitFor()
  await page.locator('.invite-code').waitFor()
})

await step('admin overview and the assistant on the server', async () => {
  await page.goto(base + '/app/admin')
  await page.getByText('Sign ups, last 30 days').waitFor()
  await page.goto(base + '/app/assistant')
  await page.getByLabel('Your question').fill('How does this week compare with last week?')
  await page.getByRole('button', { name: 'Ask' }).click()
  await page.getByText('Offline answer').first().waitFor()
})

await step('dark theme and log out, log back in', async () => {
  await page.goto(base + '/app/settings')
  await page.getByRole('radio', { name: 'Dark' }).click()
  assert((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'theme not dark')
  await page.goto(base + '/app/insights')
  await page.locator('.chart-svg').first().waitFor()
  await page.screenshot({ path: join(SHOTS, 'insights-dark.png'), fullPage: false })
  await page.goto(base + '/')
  await page.screenshot({ path: join(SHOTS, 'home-dark.png'), fullPage: false })
  await page.goto(base + '/app')
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL(base + '/')
  await page.goto(base + '/login')
  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password', { exact: true }).fill('wrong password here')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.getByText('That email and password do not match.').waitFor()
  await page.getByLabel('Password', { exact: true }).fill('a strong test password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL(/\/app$/)
})

await step('forgot password: email link resets it, old password stops working', async () => {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.goto(base + '/login')
  await p.getByRole('link', { name: 'Forgot your password?' }).click()
  await p.getByRole('heading', { name: 'Reset your password' }).waitFor()
  await p.getByLabel('Email').fill('admin@example.com')
  await p.getByRole('button', { name: 'Send reset link' }).click()
  await p.getByText(/a reset link is on its way/).waitFor()
  const link = lastLink('reset')
  assert(link, 'no reset link was printed')
  await p.goto(link)
  await p.getByRole('heading', { name: 'Choose a new password' }).waitFor()
  await p.getByLabel('New password').fill('a newer test password')
  await p.getByLabel('Type it again').fill('a newer test password')
  await p.getByRole('button', { name: 'Save new password' }).click()
  await p.getByText('Your password is changed').waitFor()
  await p.goto(link)
  await p.getByLabel('New password').fill('yet another password')
  await p.getByLabel('Type it again').fill('yet another password')
  await p.getByRole('button', { name: 'Save new password' }).click()
  await p.getByText(/expired or was already used/).waitFor()
  const old = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'pulse' }, body: JSON.stringify({ email: 'admin@example.com', password: 'a strong test password' }) })
  assert(old.status === 401, `old password still works (${old.status})`)
  await ctx.close()
})

await step('no console errors anywhere', async () => {
  assert(consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '))
})

await browser.close()
server.kill('SIGTERM')
hook.close()
rmSync(dir, { recursive: true, force: true })

console.log(failures ? `\n${failures} failed` : `\nAll ${results.length} checks passed. Screenshots in ${SHOTS}`)
process.exit(failures ? 1 : 0)
