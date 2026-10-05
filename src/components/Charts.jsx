import { useId, useMemo, useRef, useState } from 'react'
import { WEEKDAYS, hourLabel } from '../lib/format.js'

/**
 * Plain SVG charts. Each one has a hover and focus tooltip, a text summary for
 * screen readers, and draws its colors from CSS variables so light and dark
 * themes each get their own steps.
 */

function niceMax(value) {
  if (value <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(value))
  const n = value / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * pow
}

function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: `${tip.x}%`, top: tip.y }} role="presentation">
      <strong>{tip.title}</strong>
      <span>{tip.body}</span>
    </div>
  )
}

/**
 * Vertical bars from a zero baseline. `data` is [{ label, value, title }].
 * `goal` draws a dashed reference line.
 */
export function BarChart({ data, height = 220, format = (v) => String(v), goal, labelEvery = 1, summary, highlightLast = false }) {
  const [tip, setTip] = useState(null)
  const [active, setActive] = useState(-1)
  const max = niceMax(Math.max(goal || 0, ...data.map((d) => d.value)))
  const W = 100
  const H = height
  const top = 12
  const bottom = 24
  const plot = H - top - bottom
  const gap = data.length > 40 ? 0.25 : data.length > 14 ? 0.5 : 1.2
  const bw = W / data.length - gap
  const y = (v) => top + plot - (v / max) * plot
  const ticks = [0, max / 2, max]

  const show = (i) => {
    const d = data[i]
    setActive(i)
    setTip({ x: ((i + 0.5) / data.length) * 100, y: Math.max(0, y(d.value) - 8), title: d.title || d.label, body: format(d.value) })
  }
  const hide = () => {
    setActive(-1)
    setTip(null)
  }

  return (
    <figure className="chart" onMouseLeave={hide}>
      <div className="chart-plot" style={{ height: H }}>
        <div className="chart-yaxis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ top: y(t) }}>
              {format(t)}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg" role="img" aria-label={summary}>
          {ticks.map((t) => (
            <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-baseline' : 'chart-grid'} vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const x = i * (W / data.length) + gap / 2
            const h = Math.max(d.value > 0 ? 1.5 : 0, (d.value / max) * plot)
            return (
              <g key={d.label + i}>
                <rect
                  x={x}
                  y={top + plot - h}
                  width={bw}
                  height={h}
                  rx="0.6"
                  className={`chart-bar ${active === i ? 'is-active' : ''} ${highlightLast && i === data.length - 1 ? 'is-current' : ''}`}
                />
                <rect
                  x={i * (W / data.length)}
                  y="0"
                  width={W / data.length}
                  height={H - bottom}
                  className="chart-hit"
                  tabIndex={0}
                  aria-label={`${d.title || d.label}: ${format(d.value)}`}
                  onMouseEnter={() => show(i)}
                  onFocus={() => show(i)}
                  onBlur={hide}
                />
              </g>
            )
          })}
          {goal ? <line x1="0" x2={W} y1={y(goal)} y2={y(goal)} className="chart-goal" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        {goal ? (
          <span className="chart-goal-label" style={{ top: y(goal) - 18 }}>
            Goal {format(goal)}
          </span>
        ) : null}
        <Tooltip tip={tip} />
      </div>
      <div className="chart-xaxis" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.label + i} style={{ visibility: i % labelEvery === 0 || i === data.length - 1 ? 'visible' : 'hidden' }}>
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Weekday by hour grid, one blue from light to dark. */
export function Heatmap({ matrix, format = (v) => `${Math.round(v)}m` }) {
  const [tip, setTip] = useState(null)
  const max = Math.max(1, ...matrix.flat())
  const step = (v) => (v <= 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)))
  const ref = useRef(null)
  return (
    <figure className="heatmap" ref={ref} onMouseLeave={() => setTip(null)}>
      <div className="heatmap-grid" role="img" aria-label="Focused minutes by weekday and hour">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="heatmap-hour" aria-hidden="true">
            {h % 3 === 0 ? hourLabel(h) : ''}
          </span>
        ))}
        {matrix.map((row, d) => (
          <div className="heatmap-row" key={d} style={{ display: 'contents' }}>
            <span className="heatmap-day">{WEEKDAYS[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                className={`heat-cell heat-${step(v)}`}
                tabIndex={v > 0 ? 0 : -1}
                aria-label={`${WEEKDAYS[d]} ${hourLabel(h)}: ${format(v)}`}
                onMouseEnter={() => setTip({ x: ((h + 1.5) / 25) * 100, y: d * 22, title: `${WEEKDAYS[d]} ${hourLabel(h)} to ${hourLabel((h + 1) % 24)}`, body: format(v) })}
                onFocus={() => setTip({ x: ((h + 1.5) / 25) * 100, y: d * 22, title: `${WEEKDAYS[d]} ${hourLabel(h)}`, body: format(v) })}
              />
            ))}
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
      <figcaption className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={`heat-cell heat-${s}`} aria-hidden="true" />
        ))}
        <span>More</span>
      </figcaption>
    </figure>
  )
}

/** Labelled horizontal bars; the label carries identity so one hue is enough. */
export function BarList({ items, format = (v) => String(v), empty = 'Nothing yet.' }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="muted">{empty}</p>
  return (
    <ul className="barlist">
      {items.map((item) => (
        <li key={item.label}>
          <div className="barlist-row">
            <span className="barlist-label">{item.label}</span>
            <span className="barlist-value">{format(item.value)}</span>
          </div>
          <div className="barlist-track" aria-hidden="true">
            <span className="barlist-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          {item.note && <span className="barlist-note">{item.note}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Share of a whole across up to six categories, with a legend and direct values. */
export function ShareBar({ items, format = (v) => String(v) }) {
  const parts = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.value - a.value)
    if (sorted.length <= 6) return sorted
    const rest = sorted.slice(5).reduce((sum, i) => sum + i.value, 0)
    return [...sorted.slice(0, 5), { label: 'Other', value: rest }]
  }, [items])
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  if (!total) return null
  return (
    <div className="sharebar">
      <div className="sharebar-track" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
        {parts.map((p, i) => (
          <span key={p.label} className={`series-${i + 1}`} style={{ flexGrow: p.value }} title={`${p.label}: ${format(p.value)}`} />
        ))}
      </div>
      <ul className="legend">
        {parts.map((p, i) => (
          <li key={p.label}>
            <span className={`legend-swatch series-${i + 1}`} aria-hidden="true" />
            <span className="legend-label">{p.label}</span>
            <span className="legend-value">
              {format(p.value)} · {Math.round((p.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A progress ring for one figure against a target. */
export function Ring({ value, max, size = 160, stroke = 12, children, label }) {
  const id = useId()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = Math.max(0, Math.min(1, max ? value / max : 0))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={id}>
        <title id={id}>{label}</title>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

/** A tiny line for a stat tile. */
export function Sparkline({ values, width = 120, height = 32 }) {
  if (!values.length) return null
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - 2 - (v / max) * (height - 4)}`)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
