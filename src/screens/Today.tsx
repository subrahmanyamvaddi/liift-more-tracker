import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BodyMap, type Figure } from '../components/bodyMap'
import { toast, useApp } from '../components/common'
import { db } from '../db/db'
import { completedCount, nextSlot, useRunData, type RunData } from '../db/hooks'
import { getSetting, putSetting, setRestDays, SETTINGS } from '../db/store'
import { allSlots, phaseOf, slotId, slotIndex, workoutFor, type Slot } from '../program/calendar'
import { EXERCISE_BY_ID } from '../program/exercises'
import { coreFor, finisherFor } from '../program/finishers'
import { dateForSlot, exercisesFor, offsetOf, parseDate, scheduledOn, toggleRestDay, toISODate, TOTAL_WORKOUTS } from '../program/schedule'
import { intensityLevel, LEVEL_LABELS, regionLabel, regionLoads, REGIONS, type Level, type Region } from '../logic/muscles'
import { prSets, strengthGains } from '../logic/progression'
import { formatWeight, fromLb, type Unit } from '../logic/units'
import './insights.css'

const DAY_MS = 86_400_000
const FIGURE_KEY = 'bodyFigure'
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

function daysAgo(iso: string): string {
  const days = Math.round((parseDate(toISODate(new Date())).getTime() - parseDate(iso).getTime()) / DAY_MS)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** Every workout in the program as a plate on the bar, grouped by week. */
function ProgramBar({ data, next }: { data: RunData; next?: Slot }) {
  const slots = allSlots()
  const weeks = Array.from({ length: 8 }, (_, w) => slots.filter((s) => s.week === w + 1))
  return (
    <div className="bar-rail" role="img" aria-label={`${completedCount(data)} of ${TOTAL_WORKOUTS} workouts done`}>
      {weeks.map((week, i) => (
        <div key={i} className="bar-week">
          {week.map((s) => {
            const done = data.sessions.get(slotId(s))?.completed
            const isNext = next && slotIndex(next) === slotIndex(s)
            return <div key={slotId(s)} className={`bar-plate ${done ? 'done' : isNext ? 'next' : ''}`} />
          })}
        </div>
      ))}
    </div>
  )
}

function WorkoutHero({ slot, label, data, figure }: { slot: Slot; label: string; data: RunData; figure: Figure }) {
  const { run } = useApp()
  const w = workoutFor(slot.week, slot.day)
  const exercises = exercisesFor(slot.week, slot.day, data.overrides.get(w.key), data.sessions.get(slotId(slot))?.order)
  const hiit = finisherFor(slot, data.sessions.get(slotId(slot))?.finisher) === 'hiit'
  const core = coreFor(slot).length
  const p = phaseOf(slot.week) === 1 ? 'p1' : 'p2'
  const levels = Object.fromEntries(w.groups.map((g) => [g, 3 as Level])) as Partial<Record<Region, Level>>
  if (core) levels.core = 2
  return (
    <div className={`card hero ${p}`}>
      <div className="hero-row">
        <div>
          <span className="eyebrow">{label}{label === 'Up next' && ` · ${shortDate(dateForSlot(run, slot))}`}</span>
          <div className="big">{w.name}</div>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className={`tag ${p}`}>W{slot.week} · D{slot.day}</span>
            <span className={`tag ${hiit ? 'hiit' : 'lift'}`}>{hiit ? 'HIIT' : 'Burnout'}</span>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>{exercises.length} lifts × 3 sets · {core} core</div>
        </div>
        <div className="hero-map"><BodyMap levels={levels} figure={figure} label={`Muscles worked: ${w.groups.map(regionLabel).join(', ')}`} /></div>
      </div>
      <Link to={`/session/${slot.week}/${slot.day}`} className="btn primary block" style={{ marginTop: 14 }}>
        {data.setsBySlot.has(slotId(slot)) ? 'Continue workout' : 'Start workout'}
      </Link>
    </div>
  )
}

type Range = 'week' | 'program'

/** The body map and per-muscle numbers: what you've worked and how hard. */
function MuscleCard({ data, runId, startDate, unit, figure, setFigure }: { data: RunData; runId: string; startDate: string; unit: Unit; figure: Figure; setFigure: (f: Figure) => void }) {
  const [range, setRange] = useState<Range>('week')
  const [selected, setSelected] = useState<Region>()
  const today = new Date()
  const elapsedDays = Math.max(1, Math.round((parseDate(toISODate(today)).getTime() - parseDate(startDate).getTime()) / DAY_MS) + 1)
  const weeksElapsed = Math.max(1, elapsedDays / 7)
  const since = range === 'week' ? toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)) : undefined
  const loads = regionLoads({ runId, sets: data.allSets, extras: data.allExtras, sessions: data.sessions.values() }, since)
  const perWeek = (r: Region) => (range === 'week' ? loads[r].sets : loads[r].sets / weeksElapsed)
  const levels = Object.fromEntries(REGIONS.map((r) => [r, intensityLevel(perWeek(r))])) as Record<Region, Level>
  const max = Math.max(1, ...REGIONS.map((r) => loads[r].sets))
  const ranked = [...REGIONS].sort((a, b) => loads[b].sets - loads[a].sets)
  const trained = ranked.filter((r) => loads[r].sets > 0)

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 750 }}>Muscles worked</div>
        <div className="seg">
          <button className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>7 days</button>
          <button className={range === 'program' ? 'on' : ''} onClick={() => setRange('program')}>Program</button>
        </div>
      </div>
      <BodyMap levels={levels} figure={figure} selected={selected} onSelect={(r) => setSelected(selected === r ? undefined : r)}
        label={trained.length ? `Trained: ${trained.map((r) => `${regionLabel(r)} ${LEVEL_LABELS[levels[r]].toLowerCase()}`).join(', ')}` : 'No muscles trained yet'} />
      <div className="level-key">
        {([1, 2, 3, 4] as const).map((l) => <span key={l}><i style={{ background: `var(--lv${l})` }} />{LEVEL_LABELS[l]}</span>)}
      </div>
      <p className="faint small" style={{ margin: '6px 0 10px' }}>
        Intensity is sets per week for that muscle: under 6 is light, 6–11 moderate, 12–19 hard, 20+ very hard.{' '}
        <button className="link-btn small" onClick={() => setFigure(figure === 'male' ? 'female' : 'male')}>Switch figure</button>
      </p>
      {trained.length === 0 && <p className="muted small" style={{ margin: 0 }}>{range === 'week' ? 'Nothing logged in the last 7 days. Your next workout lights this up.' : 'Log your first workout and this figure starts to light up.'}</p>}
      {trained.map((r) => {
        const load = loads[r]
        return (
          <button key={r} className="muscle-row" aria-expanded={selected === r} onClick={() => setSelected(selected === r ? undefined : r)}>
            <span className="nm">{regionLabel(r)}</span>
            <span className="ct">{Math.round(load.sets)} sets · {LEVEL_LABELS[levels[r]]}</span>
            <span className="track"><span className="fill" style={{ display: 'block', width: `${(load.sets / max) * 100}%`, background: `var(--lv${levels[r]})` }} /></span>
            {selected === r && (
              <span className="more">
                Last worked {daysAgo(load.lastDate!)}{load.volumeLb > 0 && ` · ${Math.round(fromLb(load.volumeLb, unit)).toLocaleString()} ${unit} moved`}<br />
                {load.moves.slice(0, 4).join(', ')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function Today() {
  const { run, unit, catalog } = useApp()
  const data = useRunData(run.id)
  const extra = useLiveQuery(async () => ({
    lastBackup: Number((await getSetting(SETTINGS.lastBackup)) ?? 0),
    photos: await db.photos.where('runId').equals(run.id).toArray(),
    figure: ((await getSetting(FIGURE_KEY)) ?? 'male') as Figure,
  }), [run.id, catalog])
  if (!data || !extra) return null

  const now = new Date()
  const today = scheduledOn(run, now)
  const next = nextSlot(data, today)
  const done = completedCount(data)
  const isTodayNext = today.kind === 'workout' && next && today.week === next.week && today.day === next.day
  const todaySession = today.kind === 'workout' ? data.sessions.get(slotId(today)) : undefined
  const canRestToday = isTodayNext && !todaySession?.completed && !data.setsBySlot.has(slotId(today))

  const runSets = data.allSets.filter((s) => s.runId === run.id)
  const runExtras = data.allExtras.filter((e) => e.runId === run.id)
  const movedLb = runSets.reduce((n, s) => n + (s.weightLb ?? 0) * (s.reps ?? 0), 0) + runExtras.reduce((n, e) => n + (e.weightLb ?? 0) * (e.reps ?? 0), 0)
  const prCount = prSets(data.allSets, run.id).length
  const gains = strengthGains(data.allSets, run.id).filter((g) => EXERCISE_BY_ID[g.exerciseId]).slice(0, 3)
  const hiitDone = [...data.sessions.values()].filter((s) => s.hiitDone).length
  const weekNow = next?.week ?? 8
  const lastOffset = dateForSlot(run, { week: 8, day: 5 })
  const backupStale = runSets.length > 0 && Date.now() - extra.lastBackup > 7 * DAY_MS
  const hasBefore = extra.photos.some((p) => p.kind === 'before')
  const needAfter = next === undefined || (next.week === 8 && next.day === 5)
  const hasAfter = extra.photos.some((p) => p.kind === 'after')

  const toggleToday = async () => {
    const restDays = toggleRestDay(run, offsetOf(run, now))
    await setRestDays(run.id, restDays)
    if (today.kind !== 'workout') return toast('Rest day removed. Your next workout is on today.')
    toast(`Rest day added. ${workoutFor(today.week, today.day).name} moves to ${shortDate(dateForSlot({ ...run, restDays }, today))}.`)
  }

  return (
    <>
      <div className="home-head">
        <div className="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        <div className="eyebrow">LIIFT <span style={{ color: 'var(--accent)' }}>MORE</span></div>
      </div>
      <div className="home-week">Week {weekNow}<span>of 8</span></div>
      <ProgramBar data={data} next={next} />
      <div className="muted small" style={{ marginBottom: 14 }}>
        {done} of {TOTAL_WORKOUTS} workouts done · finishes {lastOffset.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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

        {today.kind === 'rest' && (
          <div className="card row between">
            <div>
              <div style={{ fontWeight: 700 }}>Rest day today</div>
              <div className="muted small">Stretch, walk, sleep.</div>
            </div>
            <button className="btn sm" onClick={toggleToday}>Train today</button>
          </div>
        )}
        {today.kind === 'before' && <div className="card muted">Program starts {parseDate(run.startDate).toLocaleDateString()}.</div>}

        {next ? (
          <WorkoutHero slot={next} label={isTodayNext ? "Today's workout" : 'Up next'} data={data} figure={extra.figure} />
        ) : (
          <div className="card hero p2">
            <div className="eyebrow">Program complete</div>
            <div className="big">All 40 workouts done 🎉</div>
            <p className="muted">Compare your before/after photos on the Body tab, or start a new run in Settings.</p>
          </div>
        )}
        {canRestToday && (
          <button className="link-btn small" style={{ alignSelf: 'center' }} onClick={toggleToday}>Need a break? Make today a rest day</button>
        )}

        <MuscleCard data={data} runId={run.id} startDate={run.startDate} unit={unit} figure={extra.figure} setFigure={(f) => putSetting(FIGURE_KEY, f)} />

        <div className="card">
          <p className="earned">
            <b>{Math.round(fromLb(movedLb, unit)).toLocaleString()} {unit}</b>
            moved across {done} workout{done === 1 ? '' : 's'}
          </p>
          <div className="row wrap small muted" style={{ gap: 14 }}>
            <Link to="/progress" className="home-link">🏆 {prCount} personal record{prCount === 1 ? '' : 's'}</Link>
            <span>⚡ {hiitDone} HIIT block{hiitDone === 1 ? '' : 's'}</span>
          </div>
          {gains.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 2 }}>Getting stronger</div>
              {gains.map((g) => (
                <Link key={g.exerciseId} to={`/exercise/${g.exerciseId}`} className="gain-row">
                  <span>{EXERCISE_BY_ID[g.exerciseId].name}</span>
                  <span className="up">{formatWeight(g.fromLb, unit)} → {formatWeight(g.toLb, unit)} {unit}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
