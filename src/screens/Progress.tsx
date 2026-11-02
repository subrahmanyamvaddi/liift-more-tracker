import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../components/common'
import { ExerciseChart, WeeklyVolumeChart, type ExerciseMetric } from '../components/charts'
import type { SetLog } from '../db/db'
import { nextSlot, useRunData } from '../db/hooks'
import { WEEKS } from '../program/calendar'
import { EXERCISES, EXERCISE_BY_ID, GROUP_LABELS, GROUP_ORDER, isActive } from '../program/exercises'
import { moveInfo } from '../program/finishers'
import { parseDate, scheduledOn, toISODate } from '../program/schedule'
import { intensityLevel, regionLabel, regionLoads, REGIONS, weeklyRegionSets } from '../logic/muscles'
import { best1RM, prSets, sessionsOf, volume } from '../logic/progression'
import { formatWeight, fromLb } from '../logic/units'
import './insights.css'

type Tab = 'overview' | 'tracker' | 'lifts' | 'prs'
const TAB_LABELS: Record<Tab, string> = { overview: 'Overview', tracker: 'Tracker', lifts: 'Lifts', prs: 'PRs' }
const dayShift = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}
const shortDate = (iso: string) => parseDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (before === 0) return <div className="d">{label}</div>
  const pct = Math.round(((now - before) / before) * 100)
  return <div className={`d ${pct > 0 ? 'up' : ''}`}>{pct > 0 ? '↑' : pct < 0 ? '↓' : '='} {Math.abs(pct)}% {label}</div>
}

export default function Progress() {
  const { run, unit, catalog } = useApp()
  const data = useRunData(run.id)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [exId, setExId] = useState<string>()
  const [metric, setMetric] = useState<ExerciseMetric>('top')
  const [show, setShow] = useState<'weight' | 'reps'>('weight')
  const trackerRef = useRef<HTMLDivElement>(null)
  const currentWeek = data ? nextSlot(data, scheduledOn(run, new Date()))?.week ?? WEEKS : 1

  // Open the wide tracker at the current week rather than at week 1.
  useEffect(() => {
    if (tab !== 'tracker') return
    const wrap = trackerRef.current
    const th = wrap?.querySelector<HTMLElement>('th.now')
    if (wrap && th) wrap.scrollLeft = th.offsetLeft - 150
  }, [tab])

  if (!data) return null
  void catalog

  const runSets = data.allSets.filter((s) => s.runId === run.id && s.weightLb != null)
  const cell = new Map(runSets.map((s) => [`${s.exerciseId}:${s.week}:${s.setNumber}`, s]))
  const weeks = Array.from({ length: WEEKS }, (_, i) => i + 1)
  const prs = prSets(data.allSets, run.id).sort((a, b) => b.week - a.week || b.day - a.day)
  const prIds = new Set(prs.map((s) => s.id))
  const input = { runId: run.id, sets: data.allSets, extras: data.allExtras, sessions: data.sessions.values() }

  // Last 7 days against the 7 before them.
  const inRange = (s: SetLog, from: string, to: string) => s.date >= from && s.date <= to
  const thisWeek = runSets.filter((s) => inRange(s, dayShift(-6), dayShift(0)))
  const lastWeek = runSets.filter((s) => inRange(s, dayShift(-13), dayShift(-7)))
  const workoutsIn = (from: string, to: string) => [...data.sessions.values()].filter((s) => s.completed && s.date >= from && s.date <= to).length
  const workoutsNow = workoutsIn(dayShift(-6), dayShift(0))
  const workoutsBefore = workoutsIn(dayShift(-13), dayShift(-7))

  const weekly = weeklyRegionSets(input)
  const recent = regionLoads(input)
  const started = dayShift(0) >= run.startDate && (runSets.length > 0 || data.allExtras.some((e) => e.runId === run.id))
  const neglected = started
    ? REGIONS.map((r) => ({ r, last: recent[r].lastDate })).sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''))[0]
    : undefined
  const neglectedDays = neglected?.last ? Math.round((parseDate(dayShift(0)).getTime() - parseDate(neglected.last).getTime()) / 86_400_000) : null

  // Lifts tab: exercises you've logged, most recent first, then the rest of the program.
  const loggedIds = [...new Set([...runSets].sort((a, b) => b.date.localeCompare(a.date) || (b.week - a.week) || (b.day - a.day)).map((s) => s.exerciseId))].filter((id) => EXERCISE_BY_ID[id])
  const selectedId = exId ?? loggedIds[0] ?? EXERCISES[0].id
  const exSets = runSets.filter((s) => s.exerciseId === selectedId)
  const exSessions = sessionsOf(exSets)
  const topOf = (sets: SetLog[]) => Math.max(...sets.map((x) => x.weightLb!))
  const firstTop = exSessions[0] ? topOf(exSessions[0].sets) : null
  const bestTop = exSessions.length ? Math.max(...exSessions.map((s) => topOf(s.sets))) : null
  const e1rm = best1RM(exSets)

  // Burnout and core bests.
  const bests = new Map<string, { reps: number; weightLb: number | null; date: string }>()
  for (const e of data.allExtras) {
    if (e.runId !== run.id || e.reps == null || e.reps <= 0) continue
    const cur = bests.get(e.moveId)
    if (!cur || e.reps > cur.reps) bests.set(e.moveId, { reps: e.reps, weightLb: e.weightLb, date: e.date })
  }

  return (
    <>
      <div className="eyebrow">Weight progression</div>
      <div className="title">Progress</div>
      <div className="seg full" style={{ marginBottom: 14 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}{t === 'prs' && prs.length > 0 ? ` (${prs.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="stack">
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Last 7 days</div>
            <div className="wk-compare">
              <div><div className="v">{workoutsNow}</div><div className="l">Workouts</div><Delta now={workoutsNow} before={workoutsBefore} label="vs prior 7" /></div>
              <div><div className="v">{thisWeek.length}</div><div className="l">Sets logged</div><Delta now={thisWeek.length} before={lastWeek.length} label="vs prior 7" /></div>
              <div><div className="v">{Math.round(fromLb(volume(thisWeek), unit)).toLocaleString()}</div><div className="l">{unit} moved</div><Delta now={volume(thisWeek)} before={volume(lastWeek)} label="vs prior 7" /></div>
            </div>
            {neglected && (
              <p className="small muted" style={{ margin: '12px 0 0' }}>
                {neglectedDays == null ? <><b style={{ color: 'var(--text)' }}>{regionLabel(neglected.r)}</b> hasn't been logged yet in this run.</> : <>Longest since a workout: <b style={{ color: 'var(--text)' }}>{regionLabel(neglected.r)}</b>, {neglectedDays === 0 ? 'today' : neglectedDays === 1 ? '1 day ago' : `${neglectedDays} days ago`}.</>}
              </p>
            )}
          </div>

          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Volume per program week ({unit} × reps)</div>
            {runSets.length ? <WeeklyVolumeChart sets={runSets} unit={unit} /> : <p className="muted small" style={{ margin: 0 }}>Log a workout to see your weekly volume here.</p>}
          </div>

          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Sets per muscle, by program week</div>
            <table className="heat">
              <thead>
                <tr>
                  <th />
                  {weeks.map((w) => <th key={w} scope="col" className={w === currentWeek ? 'now' : ''}>{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {REGIONS.map((r) => (
                  <tr key={r}>
                    <th scope="row" className="nm">{r === 'hams' ? 'Hams / Glutes' : regionLabel(r)}</th>
                    {weekly[r].map((n, i) => <td key={i} className={`lv${intensityLevel(n)}`}>{n > 0 ? Math.round(n) : ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="faint small" style={{ margin: '8px 0 0' }}>Darker to brighter: under 6 sets, 6–11, 12–19, 20+.</p>
          </div>
        </div>
      )}

      {tab === 'tracker' && (
        <>
          <div className="row between" style={{ marginBottom: 8, gap: 10 }}>
            <p className="faint small" style={{ margin: 0 }}>Laid out like the paper sheet, in {show === 'weight' ? unit : 'reps'}. Gray = not on the program that week. Gold = a new PR.</p>
            <div className="seg" style={{ flex: 'none' }}>
              <button className={show === 'weight' ? 'on' : ''} onClick={() => setShow('weight')}>{unit}</button>
              <button className={show === 'reps' ? 'on' : ''} onClick={() => setShow('reps')}>Reps</button>
            </div>
          </div>
          <div className="tracker-wrap" ref={trackerRef}>
            <table className="tracker">
              <thead>
                <tr>
                  <th className="ex" />
                  {weeks.map((w) => <th key={w} colSpan={3} className={`wk-h ${w === currentWeek ? 'now' : ''}`} style={w === currentWeek ? undefined : { color: w <= 4 ? '#f0a49b' : '#9dc0f2' }}>WEEK {w}</th>)}
                </tr>
                <tr>
                  <th className="ex" />
                  {weeks.map((w) => [1, 2, 3].map((n) => <th key={`${w}-${n}`} className={n === 1 ? 'wk-h' : ''}>S{n}</th>))}
                </tr>
              </thead>
              <tbody>
                {GROUP_ORDER.map((g) => (
                  <Fragment key={g}>
                    <tr className="grp"><td colSpan={1 + WEEKS * 3}><span>{GROUP_LABELS[g]}</span></td></tr>
                    {EXERCISES.filter((e) => e.group === g).map((e) => (
                      <tr key={e.id}>
                        <td className="ex" onClick={() => navigate(`/exercise/${e.id}`)}>{e.name}</td>
                        {weeks.map((w) => [1, 2, 3].map((n) => {
                          const s = cell.get(`${e.id}:${w}:${n}`)
                          const off = !isActive(e, w) && !s
                          const cls = [off ? 'off' : 'v', n === 1 && 's1', s && 'has', s && prIds.has(s.id) && 'best'].filter(Boolean).join(' ')
                          return <td key={`${w}-${n}`} className={cls}>{s ? (show === 'weight' ? fromLb(s.weightLb!, unit) : s.reps ?? '') : ''}</td>
                        }))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'lifts' && (
        <div className="card">
          <select className="input" aria-label="Exercise" value={selectedId} onChange={(e) => setExId(e.target.value)} style={{ marginBottom: 12 }}>
            {loggedIds.length > 0 && (
              <optgroup label="Logged, most recent first">
                {loggedIds.map((id) => <option key={id} value={id}>{EXERCISE_BY_ID[id].name}</option>)}
              </optgroup>
            )}
            {GROUP_ORDER.map((g) => (
              <optgroup key={g} label={GROUP_LABELS[g]}>
                {EXERCISES.filter((e) => e.group === g && !loggedIds.includes(e.id)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            ))}
          </select>
          {exSessions.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>No sets logged for this move yet. Its chart appears after your first workout with it.</p>
          ) : (
            <>
              <div className="lift-stats">
                <div><div className="v">{formatWeight(bestTop!, unit)}</div><div className="l">Best, {unit}</div></div>
                <div><div className="v">{e1rm != null ? formatWeight(Math.round(e1rm), unit) : '–'}</div><div className="l">Est. 1RM, {unit}</div></div>
                <div><div className="v">{bestTop! > firstTop! ? `+${formatWeight(bestTop! - firstTop!, unit)}` : '0'}</div><div className="l">Since first, {unit}</div></div>
              </div>
              <div className="seg full" style={{ marginBottom: 10 }}>
                {(['top', 'e1rm', 'volume'] as const).map((m) => (
                  <button key={m} className={metric === m ? 'on' : ''} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === 'top' ? 'Top set' : m === 'e1rm' ? 'Est. 1RM' : 'Volume'}</button>
                ))}
              </div>
              <ExerciseChart sets={exSets} unit={unit} metric={metric} />
              <div className="eyebrow" style={{ margin: '14px 0 2px' }}>History</div>
              {[...exSessions].reverse().map((s) => (
                <div key={s.sessionId} className="history-row">
                  <span className="muted">W{s.sets[0].week}·D{s.sets[0].day} · {shortDate(s.sets[0].date)}</span>
                  <span className="sets">{[...s.sets].sort((a, b) => a.setNumber - b.setNumber).map((x) => `${formatWeight(x.weightLb!, unit)}×${x.reps ?? '–'}`).join('  ')}</span>
                </div>
              ))}
              <Link to={`/exercise/${selectedId}`} className="small" style={{ display: 'block', marginTop: 10 }}>Form and cues ›</Link>
            </>
          )}
        </div>
      )}

      {tab === 'prs' && (
        <div className="stack">
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 4 }}>Weight PRs</div>
            {prs.length === 0 && <p className="muted small" style={{ margin: 0 }}>Lift more than you did in an earlier workout and it shows up here. 🏆</p>}
            {prs.map((s) => (
              <div key={s.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 650 }}>{EXERCISE_BY_ID[s.exerciseId]?.name}</div>
                  <div className="faint small">W{s.week} D{s.day} · {shortDate(s.date)}</div>
                </div>
                <span className="pr" style={{ fontSize: 15 }}>🏆 {formatWeight(s.weightLb, unit)} {unit}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 4 }}>Burnout and core bests</div>
            {bests.size === 0 && <p className="muted small" style={{ margin: 0 }}>Log reps or seconds on a burnout or core move to set your first best.</p>}
            {[...bests].sort((a, b) => b[1].date.localeCompare(a[1].date)).map(([id, b]) => {
              const move = moveInfo(id)
              return (
                <div key={id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 650 }}>{move.name}</div>
                    <div className="faint small">{shortDate(b.date)}</div>
                  </div>
                  <span className="num" style={{ fontWeight: 700 }}>{b.weightLb != null ? `${formatWeight(b.weightLb, unit)} ${unit} × ` : ''}{b.reps}{move.timed ? ' s' : ' reps'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
