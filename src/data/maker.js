/**
 * The maker of Pulse and their public work. Every project, test count and
 * detail here comes from that project's own README on GitHub.
 */
export const MAKER = {
  name: 'Sufyan Ul Haq',
  title: 'Python software developer · AI and automation · full stack',
  location: 'Liverpool, UK',
  intro:
    'I build web applications with Next.js, React and Laravel, and the AI features inside them: assistants that answer from a company’s own documents, automation between the tools a business already uses, and integrations with the Claude and OpenAI APIs. I am a cofounder of Logiccel, a software company in Liverpool, where I lead the development side.',
  links: {
    upwork: 'https://www.upwork.com/freelancers/~013b81e78082f94d09',
    github: 'https://github.com/Sufyanulhaq',
    linkedin: 'https://www.linkedin.com/in/sufyanulhaq/',
    website: 'https://sufyanulhaq.com',
    company: 'https://logiccel.com',
    email: 'hello@sufyanulhaq.com',
  },
  education: 'BS Computer Science, FUUAST, 2019 to 2023',
}

export const SKILL_GROUPS = [
  { group: 'AI and LLMs', skills: ['Claude API', 'OpenAI API', 'RAG and search', 'AI agents', 'MCP servers', 'Prompt safety'] },
  { group: 'Automation and integrations', skills: ['n8n', 'Webhooks', 'REST APIs', 'CRM integration', 'Data extraction'] },
  { group: 'Back end', skills: ['Python', 'FastAPI', 'Node.js', 'Laravel', 'PHP', 'Authentication'] },
  { group: 'Front end', skills: ['React', 'Next.js', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Motion design'] },
  { group: 'Data', skills: ['SQL', 'SQLite', 'PostgreSQL', 'MySQL', 'Dashboards', 'CSV and reporting'] },
  { group: 'Quality and delivery', skills: ['Automated testing', 'pytest', 'Vitest', 'Security', 'Vercel', 'AWS', 'Git'] },
]

export const PROJECT_CATEGORIES = ['All', 'AI assistants', 'Automation', 'Full stack', 'Data']

export const PROJECTS = [
  {
    slug: 'pulse',
    name: 'Pulse',
    category: 'Full stack',
    summary: 'This product. A focus timer with analytics, teams, signed webhooks, a personal API and an assistant that answers from your own data.',
    stack: ['React', 'Node.js', 'SQLite', 'Claude API', 'Vitest', 'Webhooks', 'Authentication', 'Motion design'],
    tests: null,
    repo: 'https://github.com/Sufyanulhaq/pulse',
    images: [],
    highlights: [
      'Accounts with salted scrypt passwords, login lockout and per device sessions',
      'Webhooks signed with HMAC SHA 256, retried with backoff, replayable',
      'Assistant that cites every figure it uses, with Claude or fully offline',
      'Team insights that stay hidden until three people join',
    ],
  },
  {
    slug: 'ai-docs-assistant',
    name: 'AI Docs Assistant',
    category: 'AI assistants',
    summary: 'A chat assistant that answers questions from your own documentation, streams the answer as it is written, and shows exactly which passages each claim came from.',
    stack: ['Python', 'FastAPI', 'Next.js', 'TypeScript', 'Claude API', 'OpenAI API', 'RAG and search'],
    tests: 58,
    repo: 'https://github.com/Sufyanulhaq/ai-docs-assistant',
    images: ['ai-docs-assistant--answer-with-sources', 'ai-docs-assistant--refuses-to-guess', 'ai-docs-assistant--start'],
    highlights: [
      'BM25 search passes only relevant passages to the model',
      'Streams the answer token by token over server sent events',
      'Refuses to guess: no relevant passage means no model call',
      'Runs with Claude, OpenAI, or offline with no key',
    ],
  },
  {
    slug: 'document-assistant',
    name: 'AI Document Assistant',
    category: 'AI assistants',
    summary: 'Upload PDFs and ask questions in plain English. Every answer shows the page it came from, and when the documents do not say, it says so.',
    stack: ['Python', 'FastAPI', 'Claude API', 'RAG and search', 'Prompt safety'],
    tests: 65,
    repo: 'https://github.com/Sufyanulhaq/document-assistant',
    images: ['document-assistant--answer-with-sources', 'document-assistant--refuses-to-guess'],
    highlights: [
      'Page numbers stay true: text is never merged across pages',
      'A citation that does not match a passage is dropped',
      'Document text is escaped so it cannot inject instructions',
      'Falls back to an offline answerer if the API fails',
    ],
  },
  {
    slug: 'email-assistant',
    name: 'AI Email Assistant',
    category: 'AI assistants',
    summary: 'A support inbox helper that sorts email, pulls out order numbers and amounts with code, and drafts replies from written policies for a person to approve. It never sends anything.',
    stack: ['Python', 'FastAPI', 'Claude API', 'Prompt safety', 'Data extraction'],
    tests: 95,
    repo: 'https://github.com/Sufyanulhaq/email-assistant',
    images: ['email-assistant--needs-a-person', 'email-assistant--routine-reply'],
    highlights: [
      'Fixed rules flag legal, safety and privacy wording; the AI cannot switch them off',
      'Order numbers and amounts come from code, never the model',
      'Nothing downloads until a person approves the draft',
    ],
  },
  {
    slug: 'lead-qualification-agent',
    name: 'Lead Qualification Agent',
    category: 'AI assistants',
    summary: 'A website chat assistant that asks a visitor a few questions, scores the lead with written reasons, saves it and sends it to a CRM.',
    stack: ['Python', 'FastAPI', 'Claude API', 'AI agents', 'CRM integration', 'Webhooks', 'SQLite'],
    tests: 67,
    repo: 'https://github.com/Sufyanulhaq/lead-qualification-agent',
    images: ['lead-qualification-agent--qualified-lead', 'lead-qualification-agent--mid-conversation'],
    highlights: [
      'Reads every reply for all six fields, so nobody is asked twice',
      'Transparent scoring: every point comes from a written rule',
      'An email is kept only if it really appears in what the visitor typed',
      'CRM delivery retries with an idempotency key, and nothing is lost on failure',
    ],
  },
  {
    slug: 'proposal-writer',
    name: 'Proposal Writer',
    category: 'Full stack',
    summary: 'A SaaS MVP for freelancers: describe yourself once, paste a job post, get a proposal draft that can only claim what is in your profile, and track your win rate.',
    stack: ['Python', 'FastAPI', 'Claude API', 'Authentication', 'SQLite', 'Security'],
    tests: 88,
    repo: 'https://github.com/Sufyanulhaq/proposal-writer',
    images: ['proposal-writer--workspace', 'proposal-writer--profile'],
    highlights: [
      'Accounts with salted scrypt and sessions in HttpOnly cookies',
      'Every query filters by account; a test proves cross account access is a 404',
      'Monthly allowance enforced in one SQL statement, safe under concurrency',
      'Numbers in a draft that are not in your profile are flagged',
    ],
  },
  {
    slug: 'content-repurposer',
    name: 'Content Repurposer',
    category: 'AI assistants',
    summary: 'Turns one article into LinkedIn, newsletter and short post drafts, then checks every number, date, quote and name against the source before a person approves.',
    stack: ['Python', 'FastAPI', 'Claude API', 'Prompt safety'],
    tests: 153,
    repo: 'https://github.com/Sufyanulhaq/content-repurposer',
    images: ['content-repurposer--facts-checked', 'content-repurposer--invented-number-caught', 'content-repurposer--house-style-blocks-approval'],
    highlights: [
      'Fact checks are plain code, applied the same to Claude and to human edits',
      'Understands 62%, 62 percent and 62 per cent as the same figure',
      'House style rules block approval until fixed',
    ],
  },
  {
    slug: 'invoice-extractor',
    name: 'Invoice Extractor',
    category: 'Data',
    summary: 'Turns invoices and receipts into spreadsheet data and checks its own work. Anything unsure or that does not add up is marked for review.',
    stack: ['Python', 'Claude API', 'Data extraction', 'CSV and reporting'],
    tests: 20,
    repo: 'https://github.com/Sufyanulhaq/invoice-extractor',
    images: ['invoice-extractor--extraction-run'],
    highlights: [
      'Offline rules for text PDFs, Claude for scans and photos',
      'Line items must add up to the subtotal, and subtotal plus tax to the total',
      'Exit codes let it run inside scheduled jobs',
    ],
  },
  {
    slug: 'integration-hub',
    name: 'Integration Hub',
    category: 'Automation',
    summary: 'Connects a shop to a CRM, accounting, Slack and a spreadsheet. Checks signed webhooks, rejects repeats, retries outages, and stops on refusals until a person replays.',
    stack: ['Python', 'FastAPI', 'Webhooks', 'REST APIs', 'SQLite', 'Security'],
    tests: 81,
    repo: 'https://github.com/Sufyanulhaq/integration-hub',
    images: ['integration-hub--dashboard'],
    highlights: [
      'HMAC SHA 256 signatures with a five minute replay window',
      'Event and deliveries saved together or not at all',
      'Retries 5xx and 429 with backoff; stops on other 4xx',
      'Idempotency keys so a retry never creates a second record',
    ],
  },
  {
    slug: 'n8n-workflows',
    name: 'n8n Workflows',
    category: 'Automation',
    summary: 'Three production style n8n workflows: lead intake and scoring, a signed order webhook sent to CRM, accounting and Slack, and a daily sales digest.',
    stack: ['n8n', 'Webhooks', 'JavaScript', 'CRM integration'],
    tests: 21,
    repo: 'https://github.com/Sufyanulhaq/n8n-workflows',
    images: [],
    highlights: [
      '11 headless runs and 10 live runs against mock services',
      'Real testing found and fixed two bugs, including signature checks on reformatted bodies',
    ],
  },
  {
    slug: 'mcp-orders-server',
    name: 'MCP Orders Server',
    category: 'AI assistants',
    summary: 'An MCP server in Python that lets an AI assistant look up orders and sales figures in a database, read only by default, with validation and an audit log.',
    stack: ['Python', 'MCP servers', 'SQLite', 'AI agents'],
    tests: 22,
    repo: 'https://github.com/Sufyanulhaq/mcp-orders-server',
    images: ['mcp-orders-server--stdio-session'],
    highlights: ['Three clear tools with careful descriptions', 'Validation on every input', 'Every call written to an audit log'],
  },
  {
    slug: 'business-dashboard',
    name: 'Sales Dashboard',
    category: 'Data',
    summary: 'A business dashboard with revenue, orders and customers for 7, 30 or 90 days against the period before, plus a searchable, filterable order table with CSV export.',
    stack: ['Next.js', 'TypeScript', 'React', 'Dashboards', 'CSV and reporting'],
    tests: 38,
    repo: 'https://github.com/Sufyanulhaq/business-dashboard',
    images: ['business-dashboard--overview', 'business-dashboard--orders-table'],
    highlights: [
      'Says n/a instead of inventing a percentage when there is nothing to compare',
      'Filters live in the URL, so a view can be shared',
      'CSV export neutralises spreadsheet formulas',
    ],
  },
]

export const EARLIER_WORK = [
  { name: 'Personal website', url: 'https://github.com/Sufyanulhaq/sufyanulhaq-website', body: 'My site, with content managed in a CMS.', stack: ['Next.js', 'TypeScript', 'Sanity'] },
  { name: 'Roof.info', url: 'https://github.com/Sufyanulhaq/ROOF', body: 'A review and information site for roof shingles.', stack: ['Laravel', 'PHP', 'MySQL'] },
  { name: 'Hotel Booking Website', url: 'https://github.com/Sufyanulhaq/Hotel-Booking-Website-Working-Code-master', body: 'Search and book hotel rooms online.', stack: ['PHP', 'MySQL'] },
  { name: 'Butcher Shop', url: 'https://github.com/Sufyanulhaq/butcher-shop', body: 'An online shop with cart, checkout and an admin area.', stack: ['PHP', 'MySQL'] },
]

export const CLIENT_WORK = [
  'A renewable energy communities platform in Laravel',
  'A Next.js rebuild for a UK boiler company',
  'A booking and payment platform for a transfer company in Crete',
]

export const PRINCIPLES = [
  { title: 'Look before quoting', body: 'Find out what is actually going on first, so the price and scope do not move halfway through.' },
  { title: 'Plain English updates', body: 'You talk to me directly and get a clear update at each stage.' },
  { title: 'Test what matters', body: 'Search quality, payments and anything that loses data get real tests.' },
  { title: 'Keep it simple', body: 'The simplest structure that does the job, so the next developer can follow it.' },
  { title: 'Stay after launch', body: 'Things change once real people use the product, and I am still around for that.' },
]
