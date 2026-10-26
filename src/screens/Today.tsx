import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useApp } from '../components/common'
import { db } from '../db/db'
import { completedCount, nextSlot, useRunData } from '../db/hooks'
import { getSetting, SETTINGS } from '../db/store'
import { phaseOf, slotId, workoutFor, type Slot } from '../program/calendar'
import { finisherFor } from '../program/finishers'
import { dateForSlot, exercisesFor, scheduledOn } from '../program/schedule'
import { prSets } from '../logic/progression'

const DAY_MS = 86_400_000

function WorkoutHero({ slot, label }: { slot: Slot; label: string }) {
  const { run } = useApp()
  const data = useRunData(run.id)
  const w = workoutFor(slot.week, slot.day)
  const exercises = exercisesFor(slot.week, slot.day, data?.overrides.get(w.key), data?.sessions.get(slotId(slot))?.order)
  const hiit = finisherFor(slot, data?.sessions.get(slotId(slot))?.finisher) === 'hiit'
  const when = dateForSlot(run, slot).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const p = phaseOf(slot.week) === 1 ? 'p1' : 'p2'
  return (
    <div className={`card hero ${p}`}>
      <div className="row between">
        <span className="eyebrow">{label}{label === 'Up next' && ` · ${when}`}</span>
        <span className={`tag ${p}`}>Week {slot.week} · Day {slot.day}</span>
      </div>
      <div className="big">{w.name}</div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <span className={`tag ${hiit ? 'hiit' : 'lift'}`}>{hiit ? 'Lift + HIIT' : 'Lift + Burnout'}</span>
        <span className="muted small">{exercises.length} lifts × 3 sets · 2 core</span>
      </div>
      <div className="muted small" style={{ marginBottom: 14 }}>{exercises.map((e) => e.name.replace(/ \(.*\)/, '')).join(' · ')}</div>
      <Link to={`/session/${slot.week}/${slot.day}`} className="btn primary block">
        {data?.setsBySlot.has(slotId(slot)) ? 'Continue workout' : 'Start workout'}
      </Link>
    </div>
  )
}

export default function Today() {
  const { run } = useApp()
  const data = useRunData(run.id)
  const extra = useLiveQuery(async () => ({
    lastBackup: Number((await getSetting(SETTINGS.lastBackup)) ?? 0),
    photos: await db.photos.where('runId').equals(run.id).toArray(),
  }), [run.id])
  if (!data || !extra) return null

  const today = scheduledOn(run, new Date())
  const next = nextSlot(data, today)
  const done = completedCount(data)
  const isTodayNext = today.kind === 'workout' && next && today.week === next.week && today.day === next.day

  const prCount = prSets(data.allSets, run.id).length
  const weekNow = next?.week ?? 8
  const weekDone = [1, 2, 3, 4, 5].filter((d) => data.sessions.get(`w${weekNow}d${d}`)?.completed).length
  const backupStale = data.allSets.length > 0 && Date.now() - extra.lastBackup > 7 * DAY_MS
  const hasBefore = extra.photos.some((p) => p.kind === 'before')
  const needAfter = next === undefined || (next.week === 8 && next.day === 5)
  const hasAfter = extra.photos.some((p) => p.kind === 'after')

  return (
    <>
      <div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <div className="title">
        LIIFT <span style={{ color: 'var(--accent)' }}>MORE</span>
      </div>

      <div className="stack">
        {backupStale && (
          <Link to="/settings" className="banner">
            💾 <span>Last backup was {extra.lastBackup ? `${Math.floor((Date.now() - extra.lastBackup) / DAY_MS)} days ago` : 'never'}. Export your spreadsheet so you don't lose progress.</span>
          </Link>
        )}
        {!hasBefore && done === 0 && (
          <Link to="/body" className="banner">📸 <span>Take your <b>before</b> photos and measurements before Day 1.</span></Link>
        )}
        {needAfter && hasBefore && !hasAfter && (
          <Link to="/body" className="banner">🏁 <span>Final workout! Take your <b>after</b> photos and measurements.</span></Link>
        )}

        {next ? (
          <WorkoutHero slot={next} label={isTodayNext ? "Today's workout" : 'Up next'} />
        ) : (
          <div className="card hero p2">
            <div className="eyebrow">Program complete</div>
            <div className="big">All 40 workouts done 🎉</div>
            <p className="muted">Compare your before/after photos on the Body tab, or start a new run in Settings.</p>
          </div>
        )}

        {today.kind === 'rest' && <div className="card"><div className="eyebrow">Today</div><div style={{ fontWeight: 700 }}>Rest & recovery day 🧘</div><div className="muted small">Stretch, walk, sleep. Next workout is ready when you are.</div></div>}
        {today.kind === 'before' && <div className="card muted">Program starts {new Date(run.startDate + 'T00:00').toLocaleDateString()}.</div>}
      </div>

      <div className="h2">Progress</div>
      <div className="grid2">
        <div className="stat"><div className="v">{done}<span className="faint" style={{ fontSize: 15 }}>/40</span></div><div className="l">Workouts done</div></div>
        <div className="stat"><div className="v">{weekDone}<span className="faint" style={{ fontSize: 15 }}>/5</span></div><div className="l">This week (W{weekNow})</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--gold)' }}>{prCount}</div><div className="l">Personal records</div></div>
        <div className="stat"><div className="v">{Math.round((done / 40) * 100)}%</div><div className="l">Program complete</div></div>
      </div>
      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, marginTop: 12, overflow: 'hidden' }}>
        <div style={{ width: `${(done / 40) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--p1), var(--accent))' }} />
      </div>
    </>
  )
}
