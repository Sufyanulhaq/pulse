import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from '../../components/Icon.jsx'
import { Badge, Modal, Reveal, SectionHead, usePageTitle } from '../../components/ui.jsx'
import { CLIENT_WORK, EARLIER_WORK, MAKER, PRINCIPLES, PROJECTS, PROJECT_CATEGORIES, SKILL_GROUPS } from '../../data/maker.js'

const img = (name) => `/projects/${name}.webp`

function ProjectModal({ project, onClose }) {
  const [shot, setShot] = useState(0)
  return (
    <Modal open={Boolean(project)} onClose={onClose} title={project?.name || ''} size="lg">
      {project && (
        <div className="project-modal">
          {project.images.length > 0 && (
            <div className="gallery">
              <img src={img(project.images[shot])} alt={`${project.name} screenshot ${shot + 1} of ${project.images.length}`} width="1200" height="900" />
              {project.images.length > 1 && (
                <div className="gallery-thumbs">
                  {project.images.map((name, i) => (
                    <button key={name} type="button" className={i === shot ? 'active' : ''} onClick={() => setShot(i)} aria-label={`Show screenshot ${i + 1}`}>
                      <img src={img(name)} alt="" loading="lazy" width="120" height="90" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="project-summary">{project.summary}</p>
          <h3>Highlights</h3>
          <ul className="checklist">
            {project.highlights.map((h) => (
              <li key={h}>
                <Icon.Check /> {h}
              </li>
            ))}
          </ul>
          <div className="row mt">
            {project.stack.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          <div className="row mt">
            <a className="btn btn-primary" href={project.repo} target="_blank" rel="noreferrer">
              <Icon.Github width={16} height={16} /> View the code
            </a>
            {project.tests ? <span className="small muted">{project.tests} automated tests</span> : null}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function AboutPage() {
  usePageTitle('About the maker')
  const [category, setCategory] = useState('All')
  const [skill, setSkill] = useState(null)
  const [open, setOpen] = useState(null)

  const proof = useMemo(() => {
    const counts = new Map()
    for (const p of PROJECTS) for (const s of p.stack) counts.set(s, (counts.get(s) || 0) + 1)
    return counts
  }, [])

  const shown = PROJECTS.filter((p) => (category === 'All' || p.category === category) && (!skill || p.stack.includes(skill)))
  const totalTests = PROJECTS.reduce((sum, p) => sum + (p.tests || 0), 0)

  return (
    <>
      <section className="page-hero container about-hero">
        <div>
          <span className="eyebrow">About the maker</span>
          <h1>{MAKER.name}</h1>
          <p className="about-title">{MAKER.title}</p>
          <p className="hero-sub">{MAKER.intro}</p>
          <div className="row mt">
            <a className="btn btn-primary" href={MAKER.links.upwork} target="_blank" rel="noreferrer">
              <Icon.Briefcase width={16} height={16} /> Hire me on Upwork
            </a>
            <Link className="btn btn-ghost" to="/contact">
              <Icon.Mail width={16} height={16} /> Get in touch
            </Link>
          </div>
          <ul className="about-links">
            <li>
              <a href={MAKER.links.github} target="_blank" rel="noreferrer">
                <Icon.Github width={15} height={15} /> GitHub
              </a>
            </li>
            <li>
              <a href={MAKER.links.linkedin} target="_blank" rel="noreferrer">
                <Icon.Users width={15} height={15} /> LinkedIn
              </a>
            </li>
            <li>
              <a href={MAKER.links.website} target="_blank" rel="noreferrer">
                <Icon.Globe width={15} height={15} /> sufyanulhaq.com
              </a>
            </li>
            <li>
              <a href={MAKER.links.company} target="_blank" rel="noreferrer">
                <Icon.Briefcase width={15} height={15} /> Logiccel
              </a>
            </li>
          </ul>
        </div>
        <div className="about-stats">
          <div>
            <strong>{PROJECTS.length}</strong>
            <span>public projects</span>
          </div>
          <div>
            <strong>{totalTests}+</strong>
            <span>automated tests across them</span>
          </div>
          <div>
            <strong>{MAKER.location}</strong>
            <span>working with clients anywhere</span>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <SectionHead eyebrow="Skills" title="What I work with" sub="Pick a skill to see the projects that prove it." />
          <div className="skill-groups">
            {SKILL_GROUPS.map((g) => (
              <div key={g.group} className="skill-group">
                <h3>{g.group}</h3>
                <div className="skill-chips">
                  {g.skills.map((s) => {
                    const n = proof.get(s) || 0
                    if (!n) {
                      return (
                        <span key={s} className="chip chip-static">
                          {s}
                        </span>
                      )
                    }
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`chip ${skill === s ? 'active' : ''}`}
                        aria-pressed={skill === s}
                        onClick={() => {
                          setSkill(skill === s ? null : s)
                          setCategory('All')
                          document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        {s}
                        {n > 0 && <span className="chip-count">{n}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="projects">
        <div className="container">
          <SectionHead eyebrow="Work" title="Projects" sub="Each one is public, tested and documented, including its honest limitations." />
          <div className="filters center-filters">
            <div className="segmented" role="radiogroup" aria-label="Project type">
              {PROJECT_CATEGORIES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={category === c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
            {skill && (
              <button type="button" className="chip active" onClick={() => setSkill(null)}>
                Skill: {skill} <Icon.X width={12} height={12} />
              </button>
            )}
          </div>
          <motion.div className="project-grid" layout>
            <AnimatePresence>
              {shown.map((p) => (
                <motion.button
                  key={p.slug}
                  type="button"
                  layout
                  className="project-card"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  onClick={() => setOpen(p)}
                >
                  <div className="project-thumb">
                    {p.images[0] ? (
                      <img src={img(p.images[0])} alt="" loading="lazy" width="600" height="450" />
                    ) : (
                      <span className="project-thumb-empty" aria-hidden="true">
                        {p.slug === 'pulse' ? <Icon.Target width={36} height={36} /> : <Icon.Layers width={36} height={36} />}
                      </span>
                    )}
                  </div>
                  <div className="project-body">
                    <div className="row">
                      <Badge tone="primary">{p.category}</Badge>
                      {p.tests ? <span className="small muted">{p.tests} tests</span> : null}
                    </div>
                    <h3>{p.name}</h3>
                    <p>{p.summary}</p>
                    <span className="project-more">
                      Details <Icon.Arrow width={14} height={14} />
                    </span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
          {shown.length === 0 && <p className="muted center-text">No projects in that view.</p>}
          <h3 className="earlier-title">Earlier work</h3>
          <div className="earlier-grid">
            {EARLIER_WORK.map((w) => (
              <a key={w.name} className="earlier" href={w.url} target="_blank" rel="noreferrer">
                <strong>
                  {w.name} <Icon.External width={14} height={14} />
                </strong>
                <span>{w.body}</span>
                <span className="earlier-stack">{w.stack.join(' · ')}</span>
              </a>
            ))}
          </div>
          <div className="callout mt-lg">
            <Icon.Lock width={18} height={18} />
            <div>
              <strong>Client work through Logiccel</strong> (private code, live sites): {CLIENT_WORK.join('; ')}.
            </div>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">
          <SectionHead eyebrow="How I work" title="From first call to after launch" />
          <ol className="process">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05} as="li" className="process-step">
                <span className="process-num">{i + 1}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </ol>
          <p className="center-text small muted mt-lg">{MAKER.education}</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="cta-banner">
            <h2>Have a project in mind?</h2>
            <p>AI features, automation, integrations or a full web app. Tell me what you need and I will tell you honestly how I would build it.</p>
            <div className="hero-actions">
              <a className="btn btn-accent btn-lg" href={MAKER.links.upwork} target="_blank" rel="noreferrer">
                Hire me on Upwork
              </a>
              <Link className="btn btn-ghost btn-lg" to="/contact">
                Send a message
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <ProjectModal key={open?.slug} project={open} onClose={() => setOpen(null)} />
    </>
  )
}
