import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useData } from '../../state/DataContext.jsx'
import { useToast } from '../../state/ToastContext.jsx'
import { byHour, byTag, byWeekday, comparePeriods, dailySeries, focusScore, hourWeekMatrix, longestStreak, peakIndex, streak } from '../../lib/stats.js'
import { WEEKDAYS, WEEKDAYS_LONG, change, duration, hourLabel, percent, shortDate } from '../../lib/format.js'
import { BarChart, BarList, Heatmap, ShareBar } from '../../components/Charts.jsx'
import { EmptyState, Segmented, Stat, usePageTitle } from '../../components/ui.jsx'
import { Icon } from '../../components/Icon.jsx'
import { ExportMenu } from './ExportMenu.jsx'

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

export default function InsightsPage() {
  usePageTitle('Insights')
  const { sessions, settings, loadSample } = useData()
  const { toast } = useToast()
  const [days, setDays] = useState(30)
  const data = useMemo(() => {
    const now = Date.now()
    const { current, previous, currentSessions } = comparePeriods(sessions, days, now)
    const series = dailySeries(sessions, days, now)
    const hours = byHour(currentSessions)
    const weekdays = byWeekday(currentSessions)
    return {
      current,
      previous,
      score: focusScore(current, settings.goalMinutes, days),
      prevScore: focusScore(previous, settings.goalMinutes, days),
      series,
      hours,
      weekdays,
      matrix: hourWeekMatrix(currentSessions),
      tags: byTag(currentSessions),
      peakHour: peakIndex(hours),
      peakDay: peakIndex(weekdays),
      streak: streak(sessions, now),
      longest: longestStreak(sessions),
      goalDays: series.filter((d) => d.minutes >= settings.goalMinutes).length,
      activeDays: series.filter((d) => d.minutes > 0).length,
    }
  }, [sessions, days, settings.goalMinutes])

  if (!sessions.length) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Insights</h1>
            <p>Patterns in when and how well you focus.</p>
          </div>
        </div>
        <div className="card">
          <EmptyState
            icon={Icon.Chart}
            title="No sessions yet"
            action={
              <>
                <Link className="btn btn-primary" to="/app">
                  Start a focus block
                </Link>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={async () => {
                    const r = await loadSample()
                    toast(`Loaded ${r.imported} sample sessions. You can remove them in Settings.`, { tone: 'success' })
                  }}
                >
                  Load sample data
                </button>
              </>
            }
          >
            Charts fill in as you finish focus blocks. Or load 75 days of sample data to see what Insights looks like.
          </EmptyState>
        </div>
      </>
    )
  }

  const { current, previous } = data
  const labelEvery = days === 7 ? 1 : days === 30 ? 5 : 15

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <p>
            {shortDate(data.series[0].date)} to {shortDate(data.series[data.series.length - 1].date)}, compared with the {days} days before.
          </p>
        </div>
        <div className="row">
          <Segmented label="Date range" value={days} onChange={setDays} options={RANGES} />
          <ExportMenu />
        </div>
      </div>

      <div className="grid grid-4">
        <Stat label="Focused time" icon={Icon.Clock} value={duration(current.minutes)} delta={change(current.minutes, previous.minutes)} sub="vs previous period" />
        <Stat label="Focus score" icon={Icon.Target} value={data.score} delta={change(data.score, data.prevScore)} sub="out of 100" />
        <Stat label="Sessions" icon={Icon.Layers} value={current.count} delta={change(current.count, previous.count)} sub={`${percent(current.completionRate)} finished`} />
        <Stat
          label="Interruptions"
          icon={Icon.Bell}
          value={current.interruptionsPerHour.toFixed(1)}
          // Fewer interruptions is better, so the sign is flipped for colour.
          delta={previous.interruptionsPerHour ? -change(current.interruptionsPerHour, previous.interruptionsPerHour) : null}
          sub="per focused hour"
        />
      </div>

      <section className="card mt" aria-labelledby="daily-title">
        <div className="card-head">
          <div>
            <h2 id="daily-title">Focused time per day</h2>
            <p className="card-sub">
              Goal met on {data.goalDays} of {days} days · active on {data.activeDays}
            </p>
          </div>
        </div>
        <BarChart
          data={data.series.map((d) => ({
            label: days === 7 ? WEEKDAYS[(new Date(d.date).getDay() + 6) % 7] : shortDate(d.date),
            title: new Date(d.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
            value: Math.round(d.minutes),
          }))}
          goal={settings.goalMinutes}
          format={(v) => duration(v)}
          labelEvery={labelEvery}
          highlightLast
          summary={`Focused minutes per day over the last ${days} days. Total ${duration(current.minutes)}.`}
        />
      </section>

      <div className="grid grid-2 mt">
        <section className="card" aria-labelledby="heat-title">
          <div className="card-head">
            <div>
              <h2 id="heat-title">When you focus</h2>
              <p className="card-sub">
                {data.peakHour >= 0 ? `Strongest hour: ${hourLabel(data.peakHour)} to ${hourLabel((data.peakHour + 1) % 24)}` : 'Not enough data yet'}
                {data.peakDay >= 0 ? ` · best day: ${WEEKDAYS_LONG[data.peakDay]}` : ''}
              </p>
            </div>
          </div>
          <Heatmap matrix={data.matrix} />
        </section>

        <section className="card" aria-labelledby="tags-title">
          <div className="card-head">
            <div>
              <h2 id="tags-title">Where your time goes</h2>
              <p className="card-sub">Focused time by tag</p>
            </div>
          </div>
          <ShareBar items={data.tags.map((t) => ({ label: t.tag, value: Math.round(t.minutes) }))} format={(v) => duration(v)} />
          <div className="mt-sm">
            <BarList
              items={data.tags.slice(0, 6).map((t) => ({
                label: t.tag,
                value: t.count,
                note: `${((t.interruptions / Math.max(1, t.minutes)) * 60).toFixed(1)} interruptions per hour · ${percent(t.completed / t.count)} finished`,
              }))}
              format={(v) => `${v} session${v === 1 ? '' : 's'}`}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-2 mt">
        <section className="card" aria-labelledby="hour-title">
          <div className="card-head">
            <h2 id="hour-title">By hour of day</h2>
          </div>
          <BarChart
            data={data.hours.map((v, h) => ({ label: h % 3 === 0 ? hourLabel(h) : '', title: `${hourLabel(h)} to ${hourLabel((h + 1) % 24)}`, value: Math.round(v) }))}
            format={(v) => duration(v)}
            height={180}
            summary="Focused minutes by hour of day"
          />
        </section>
        <section className="card" aria-labelledby="records-title">
          <div className="card-head">
            <h2 id="records-title">Records</h2>
          </div>
          <dl className="records">
            <div>
              <dt>Current streak</dt>
              <dd>
                <Icon.Flame width={16} height={16} /> {data.streak} day{data.streak === 1 ? '' : 's'}
              </dd>
            </div>
            <div>
              <dt>Longest streak</dt>
              <dd>{data.longest} days</dd>
            </div>
            <div>
              <dt>Average session</dt>
              <dd>{duration(current.avgLength)}</dd>
            </div>
            <div>
              <dt>Daily average</dt>
              <dd>{duration(current.minutes / days)}</dd>
            </div>
          </dl>
          <details className="score-explain">
            <summary>How the focus score works</summary>
            <ul>
              <li>
                <strong>60 points</strong> for reaching your daily goal of {duration(settings.goalMinutes)} on average.
              </li>
              <li>
                <strong>25 points</strong> for the share of blocks you finish rather than stop early.
              </li>
              <li>
                <strong>15 points</strong> for few interruptions: none per hour scores all 15, four or more scores none.
              </li>
            </ul>
            <p className="small muted">No sessions means a score of 0, never a guess.</p>
          </details>
        </section>
      </div>
    </>
  )
}
