import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DemoPlayer, Sheet, toast, useApp, vibrate } from '../components/common'
import { FinisherSection } from '../components/finisher'
import { MoveEditor } from '../components/moveEditor'
import { ReorderSheet } from '../components/reorder'
import { db, sessionId, type Session, type SetLog } from '../db/db'
import { useRunData } from '../db/hooks'
import { defaultSessionDate, getOrCreateSession, savePlan, saveSet, setOverride, updateSession } from '../db/store'
import { phaseOf, slotIndex, workoutFor } from '../program/calendar'
import { finisherFor, planFor } from '../program/finishers'
import { EXERCISES, GROUP_LABELS, GROUP_ORDER, isActive, type Exercise } from '../program/exercises'
import { exercisesFor } from '../program/schedule'
import { bestOutside, isPR, previousSets, suggestHeavier, volume } from '../logic/progression'
import { formatWeight, fromLb, stepFor, toLb, type Unit } from '../logic/units'

const SETS = [1, 2, 3]

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function SetRow({ n, log, prev, best, unit, onSave }: {
  n: number
  log?: SetLog
  prev?: SetLog
  best: number | null
  unit: Unit
  onSave: (patch: { weightLb?: number | null; reps?: number | null }) => void
}) {
  const [weight, setWeight] = useState(log?.weightLb != null ? String(fromLb(log.weightLb, unit)) : '')
  const [reps, setReps] = useState(log?.reps != null ? String(log.reps) : '')
  const weightLb = parseNum(weight) == null ? null : toLb(parseNum(weight)!, unit)
  const pr = isPR(weightLb, best)

  const copyPrev = () => {
    if (!prev) return
    const w = prev.weightLb != null ? String(fromLb(prev.weightLb, unit)) : ''
    const r = prev.reps != null ? String(prev.reps) : ''
    setWeight(w)
    setReps(r)
    onSave({ weightLb: prev.weightLb, reps: prev.reps })
  }

  return (
    <>
      <div className={`set-no ${weight ? 'filled' : ''}`}>{n}</div>
      <input
        className="set-input" inputMode="decimal" placeholder={prev?.weightLb != null ? formatWeight(prev.weightLb, unit) : unit}
        value={weight} aria-label={`Set ${n} weight`}
        onChange={(e) => {
          setWeight(e.target.value)
          const v = parseNum(e.target.value)
          const lb = v == null ? null : toLb(v, unit)
          onSave({ weightLb: lb })
          if (isPR(lb, best) && !isPR(weightLb, best)) vibrate([30, 40, 30])
        }}
      />
      <input
        className="set-input" inputMode="numeric" placeholder={prev?.reps != null ? String(prev.reps) : 'reps'}
        value={reps} aria-label={`Set ${n} reps`}
        onChange={(e) => {
          setReps(e.target.value)
          onSave({ reps: parseNum(e.target.value) })
        }}
      />
      {pr ? (
        <span className="pr">🏆 PR</span>
      ) : prev?.weightLb != null ? (
        <button className="prev" onClick={copyPrev} title="Copy last time">
          {formatWeight(prev.weightLb, unit)}×{prev.reps ?? '–'} ↺
        </button>
      ) : (
        <span className="faint small">—</span>
      )}
    </>
  )
}

function ExerciseCard({ ex, session, ensure, allSets, order, unit }: {
  ex: Exercise
  session: Session | undefined
  ensure: () => Promise<Session>
  allSets: SetLog[]
  order: number
  unit: Unit
}) {
  const { run } = useApp()
  const [editing, setEditing] = useState(false)
  const sid = session?.id ?? 'pending'
  const mine = allSets.filter((s) => s.exerciseId === ex.id)
  const thisRun = mine.filter((s) => s.runId === run.id)
  const prev = previousSets(thisRun, order)
  const best = bestOutside(mine, sid)
  const suggestion = suggestHeavier(thisRun, order, toLb(stepFor(unit), unit))
  const logs = new Map(mine.filter((s) => s.sessionId === sid).map((s) => [s.setNumber, s]))

  const save = async (n: number, patch: { weightLb?: number | null; reps?: number | null }) => {
    const s = await ensure()
    await saveSet(s, ex.id, n, patch)
  }

  return (
    <div className="card ex-card">
      <div className="ex-head">
        <Link to={`/exercise/${ex.id}`} className="ex-thumb" aria-label={`How to do ${ex.name}`}>
          <DemoPlayer exercise={ex} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/exercise/${ex.id}`} className="ex-name">{ex.name}</Link>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <span className="tag">{GROUP_LABELS[ex.group]}</span>
            {ex.unilateral && <span className="tag">Per side</span>}
            <Link to={`/exercise/${ex.id}`} className="small">Form ›</Link>
          </div>
        </div>
        <div className="card-tools">
          <button className="icon-btn" aria-label={`Rename or edit ${ex.name}`} title="Rename / edit" onClick={() => setEditing(true)}>✎</button>
        </div>
      </div>
      {editing && <MoveEditor id={ex.id} kind="lift" onClose={() => setEditing(false)} />}
      {suggestion != null && (
        <div style={{ marginTop: 10 }}>
          <span className="chip">↑ Go heavier: try {formatWeight(suggestion, unit)} {unit}</span>
        </div>
      )}
      <div className="set-grid">
        <span className="hdr">Set</span>
        <span className="hdr" style={{ textAlign: 'center' }}>{unit}</span>
        <span className="hdr" style={{ textAlign: 'center' }}>Reps</span>
        <span className="hdr">Last</span>
        {SETS.map((n) => (
          <SetRow key={n} n={n} log={logs.get(n)} prev={prev.get(n)} best={best} unit={unit} onSave={(p) => save(n, p)} />
        ))}
      </div>
    </div>
  )
}

function EditExercises({ week, day, current, onClose }: { week: number; day: number; current: Exercise[]; onClose: () => void }) {
  const { run } = useApp()
  const w = workoutFor(week, day)
  const [chosen, setChosen] = useState(new Set(current.map((e) => e.id)))
  const [name, setName] = useState(planFor(w.key).name ?? '')
  const [creating, setCreating] = useState(false)
  const base = new Set(exercisesFor(week, day).map((e) => e.id))
  const groups = [...w.groups, ...GROUP_ORDER.filter((g) => !w.groups.includes(g))]

  const apply = async () => {
    if (name.trim() !== (planFor(w.key).name ?? '')) await savePlan(w.key, { name: name.trim() || undefined })
    await setOverride(run.id, w.key, [...chosen].filter((id) => !base.has(id)), [...base].filter((id) => !chosen.has(id)))
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="row between">
        <div className="h2" style={{ margin: 0 }}>Edit {w.name}</div>
        <button className="link-btn" onClick={() => setOverride(run.id, w.key, [], []).then(onClose)}>Reset</button>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="wk-name">Workout name</label>
        <input id="wk-name" className="input" value={name} placeholder={w.name} onChange={(e) => setName(e.target.value)} />
      </div>
      <p className="muted small">Ticks apply to every {w.name} day in this run. Moves not on the tracker for this week are marked “off-week”.
        Missing one of Joel's moves? <button className="link-btn small" onClick={() => setCreating(true)}>+ New exercise</button> · <Link to="/library" className="small">Exercise library ›</Link></p>
      {groups.map((g) => (
        <div key={g}>
          <div className="eyebrow" style={{ margin: '14px 0 4px' }}>{GROUP_LABELS[g]}</div>
          {EXERCISES.filter((e) => e.group === g).map((e) => (
            <label key={e.id} className="check">
              <input type="checkbox" checked={chosen.has(e.id)} onChange={(ev) => {
                const next = new Set(chosen)
                if (ev.target.checked) next.add(e.id)
                else next.delete(e.id)
                setChosen(next)
              }} />
              <span>{e.name} {!isActive(e, week) && <span className="faint small">· off-week</span>}</span>
            </label>
          ))}
        </div>
      ))}
      <button className="btn primary block" style={{ marginTop: 16 }} onClick={apply}>Save</button>
      {creating && (
        <MoveEditor kind="lift" group={w.groups[0]} onClose={() => setCreating(false)}
          onSaved={(id) => setChosen((c) => new Set([...c, id]))} />
      )}
    </Sheet>
  )
}

export default function Logger() {
  const { run, unit, catalog } = useApp()
  const params = useParams()
  const week = Number(params.week)
  const day = Number(params.day)
  const navigate = useNavigate()
  const data = useRunData(run.id)
  const sessionQ = useLiveQuery(async () => ({ s: (await db.sessions.get(sessionId(run.id, week, day))) ?? undefined }), [run.id, week, day])
  const session = sessionQ?.s
  const [editing, setEditing] = useState(false)
  const [reordering, setReordering] = useState(false)

  const w = workoutFor(week, day)
  const exercises = useMemo(() => exercisesFor(week, day, data?.overrides.get(w.key), session?.order), [week, day, data, w.key, catalog, session?.order])
  if (!data || !sessionQ || !(week >= 1 && week <= 8 && day >= 1 && day <= 5)) return null

  const ensure = () => getOrCreateSession(run, week, day)
  const order = slotIndex({ week, day })
  const finisher = finisherFor({ week, day }, session?.finisher)
  const p = phaseOf(week) === 1 ? 'p1' : 'p2'
  const sessionSets = data.allSets.filter((s) => s.sessionId === session?.id && s.weightLb != null)

  const finish = async () => {
    const s = await ensure()
    await updateSession(s.id, { completed: true })
    const prs = sessionSets.filter((x) => isPR(x.weightLb, bestOutside(data.allSets.filter((y) => y.exerciseId === x.exerciseId), s.id)))
    const prNames = new Set(prs.map((x) => x.exerciseId)).size
    const extras = data.allExtras.filter((x) => x.sessionId === s.id && x.reps != null)
    const coreDone = extras.filter((x) => x.slot.startsWith('core')).length
    vibrate([40, 60, 40])
    toast(`Workout done 💪 ${sessionSets.length} sets · ${Math.round(fromLb(volume(sessionSets), unit)).toLocaleString()} ${unit} volume · core ${coreDone}${prNames ? ` · ${prNames} PR${prNames > 1 ? 's' : ''} 🏆` : ''}`)
    navigate('/')
  }

  return (
    <>
      <div className="row between">
        <button className="link-btn" onClick={() => navigate(-1)}>‹ Back</button>
        <span className="row" style={{ gap: 14 }}>
          <button className="link-btn" onClick={() => setReordering(true)}>⇅ Reorder</button>
          <button className="link-btn" onClick={() => setEditing(true)}>Edit exercises</button>
        </span>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        <span className={`tag ${p}`}>Week {week} · Day {day}</span>
        <span className={`tag ${finisher === 'hiit' ? 'hiit' : 'lift'}`}>{finisher === 'hiit' ? 'Lift + HIIT' : 'Lift + Burnout'} · Core</span>
        {session?.completed && <span className="tag done">✓ Done</span>}
      </div>
      <div className="title-row">
        <div className="title">{w.name}</div>
        <button className="icon-btn" aria-label="Rename workout or change its exercises" title="Rename / edit" onClick={() => setEditing(true)}>✎</button>
      </div>

      <div className="row small muted" style={{ marginTop: -6, marginBottom: 12 }}>
        Done on
        <input type="date" className="input" style={{ width: 'auto', minHeight: 34, padding: '4px 8px' }} value={session?.date ?? defaultSessionDate(run, week, day)}
          onChange={async (e) => {
            if (!e.target.value) return
            const s = await ensure()
            await updateSession(s.id, { date: e.target.value })
            await db.sets.where('sessionId').equals(s.id).modify({ date: e.target.value })
          }} />
      </div>

      <div className="stack">
        {exercises.map((ex) => (
          <ExerciseCard key={`${week}-${day}-${ex.id}`} ex={ex} session={session} ensure={ensure} allSets={data.allSets} order={order} unit={unit} />
        ))}
      </div>

      <FinisherSection slot={{ week, day }} session={session} ensure={ensure} data={data} runId={run.id} exercises={exercises} unit={unit} />

      <div className="card stack" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" className="input" placeholder="How did it feel? Form notes, energy, swaps…" defaultValue={session?.notes ?? ''} key={`${week}-${day}`}
            onChange={async (e) => updateSession((await ensure()).id, { notes: e.target.value })} />
        </div>
      </div>

      <div className="sticky-foot">
        {session?.completed ? (
          <button className="btn block" onClick={() => updateSession(session.id, { completed: false })}>Mark as not done</button>
        ) : (
          <button className="btn good block" onClick={finish}>Finish workout</button>
        )}
      </div>

      {reordering && <ReorderSheet workout={w} exercises={exercises} session={session} ensure={ensure} onClose={() => setReordering(false)} />}
      {editing && <EditExercises week={week} day={day} current={exercises} onClose={() => setEditing(false)} />}
    </>
  )
}
