import { useState } from 'react'
import './finisher.css'
import { Link } from 'react-router-dom'
import { DemoPlayer, Sheet, toast, vibrate } from './common'
import { MoveEditor } from './moveEditor'
import { db, newId, type ExtraLog, type Session } from '../db/db'
import { removeExtra, saveExtra, savePlan, updateSession } from '../db/store'
import type { RunData } from '../db/hooks'
import { slotIndex, workoutFor, type Slot } from '../program/calendar'
import type { Exercise } from '../program/exercises'
import { burnoutsOf, coreFor, DEFAULT_BURNOUT, finisherFor, moveInfo, movesOf, parseSlot, planFor, slotName, type Finisher, type ListKind, type MoveKind } from '../program/finishers'
import { formatWeight, fromLb, toLb, type Unit } from '../logic/units'

const parseNum = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}
const orderOf = (x: { week: number; day: number }) => slotIndex(x)
const KIND_NAME: Record<MoveKind, string> = { burnout: 'burnout', core: 'core', hiit: 'HIIT' }

/** More reps (or seconds) than any earlier log of the move at the same or a heavier weight. */
export function isRepPR(log: Pick<ExtraLog, 'weightLb' | 'reps'>, others: ExtraLog[]): boolean {
  if (log.reps == null || log.reps <= 0) return false
  const comparable = others.filter((o) => o.reps != null && (o.weightLb ?? 0) >= (log.weightLb ?? 0))
  return comparable.length > 0 && log.reps > Math.max(...comparable.map((o) => o.reps!))
}

/** Pick a move by typing its name; anything new is created on the spot (fill in details later with ✎). */
function AddMoveSheet({ kind, title, extra = [], onPick, onClose }: {
  kind: MoveKind
  title: string
  extra?: { group: string; ids: string[] }[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const name = q.trim()
  const match = (n: string) => n.toLowerCase().includes(name.toLowerCase())
  const groups = [{ group: `${KIND_NAME[kind][0].toUpperCase()}${KIND_NAME[kind].slice(1)} moves`, ids: movesOf(kind).map((m) => m.id) }, ...extra]
    .map((g) => ({ ...g, ids: g.ids.filter((id) => match(moveInfo(id).name)) }))
    .filter((g) => g.ids.length)
  const exact = groups.some((g) => g.ids.some((id) => moveInfo(id).name.toLowerCase() === name.toLowerCase()))
  const pick = (id: string) => { onPick(id); onClose() }
  const create = async () => {
    const id = `my-${newId().slice(0, 8)}`
    await db.moves.put({ id, kind, name, weighted: kind === 'burnout' || undefined, cues: [], mistakes: [] })
    toast(`Added ${name}`)
    pick(id)
  }

  const createBtn = (
    <button className={`btn block ${groups.length ? '' : 'primary'}`} style={{ marginTop: 12 }} onClick={create}>+ Add “{name}” as a new {KIND_NAME[kind]} move</button>
  )

  return (
    <Sheet onClose={onClose}>
      <div className="h2" style={{ marginTop: 0 }}>{title}</div>
      <input className="input" autoFocus value={q} placeholder="Type the move name Joel uses…" aria-label="Move name"
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name && !exact && !groups.length) create() }} />
      {name && !exact && !groups.length && createBtn}
      {groups.map((g) => (
        <div key={g.group}>
          <div className="eyebrow" style={{ margin: '14px 0 4px' }}>{g.group}</div>
          {g.ids.map((id) => (
            <button key={id} className="lib-row pick-row" onClick={() => pick(id)}>
              <span className="ex-thumb"><DemoPlayer exercise={moveInfo(id)} /></span>
              <span style={{ flex: 1, textAlign: 'left' }}>{moveInfo(id).name}</span>
              <span className="small">Add</span>
            </button>
          ))}
        </div>
      ))}
      {name && !exact && groups.length > 0 && createBtn}
    </Sheet>
  )
}

function MoveCard({ kind, index, label, moveId, options, session, ensure, data, runId, order, unit, workoutName, isPlanDefault, onMakeDefault, onRemove }: {
  kind: ListKind
  index: number
  label: string
  moveId: string
  workoutName: string
  isPlanDefault: boolean
  onMakeDefault: () => void
  onRemove: () => void
  options: { group: string; ids: string[] }[]
  session: Session | undefined
  ensure: () => Promise<Session>
  data: RunData
  runId: string
  order: number
  unit: Unit
}) {
  const slot = slotName(kind, index)
  const move = moveInfo(moveId)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const log = data.allExtras.find((e) => e.sessionId === session?.id && e.slot === slot)
  const same = data.allExtras.filter((e) => e.moveId === moveId && e.sessionId !== session?.id && e.reps != null)
  const prev = same.filter((e) => e.runId === runId && orderOf(e) < order).sort((a, b) => orderOf(a) - orderOf(b)).at(-1)
  const [weight, setWeight] = useState(log?.weightLb != null ? String(fromLb(log.weightLb, unit)) : '')
  const [reps, setReps] = useState(log?.reps != null ? String(log.reps) : '')
  const weightLb = parseNum(weight) == null ? null : toLb(parseNum(weight)!, unit)
  const pr = isRepPR({ weightLb, reps: parseNum(reps) }, same)
  const what = move.timed ? 'sec' : 'reps'

  const save = async (patch: Partial<Pick<ExtraLog, 'moveId' | 'weightLb' | 'reps'>>) => saveExtra(await ensure(), slot, { moveId, ...patch })
  const copyPrev = () => {
    if (!prev) return
    setWeight(prev.weightLb != null ? String(fromLb(prev.weightLb, unit)) : '')
    setReps(prev.reps != null ? String(prev.reps) : '')
    save({ weightLb: prev.weightLb, reps: prev.reps })
  }

  return (
    <div className="card ex-card">
      <div className="ex-head">
        <Link to={`/exercise/${moveId}`} className="ex-thumb" aria-label={`How to do ${move.name}`}>
          <DemoPlayer exercise={move} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <select className="move-select" value={moveId} aria-label={`${label} move`}
            onChange={(e) => (e.target.value === NEW ? setCreating(true) : save({ moveId: e.target.value, weightLb: null, reps: null }))}>
            {!options.some((g) => g.ids.includes(moveId)) && <option value={moveId}>{move.name}</option>}
            {options.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.ids.map((id) => <option key={id} value={id}>{moveInfo(id).name}</option>)}
              </optgroup>
            ))}
            <option value={NEW}>+ New move…</option>
          </select>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <span className="tag">{label}</span>
            {move.timed && <span className="tag">Seconds</span>}
            {move.perSide && <span className="tag">Per side</span>}
            <Link to={`/exercise/${moveId}`} className="small">Form ›</Link>
          </div>
        </div>
        <div className="card-tools">
          <button className="icon-btn" aria-label={`Rename or edit ${move.name}`} title="Rename / edit" onClick={() => setEditing(true)}>✎</button>
          <button className="icon-btn" aria-label={`Remove ${label}`} title="Remove" onClick={onRemove}>✕</button>
        </div>
      </div>
      <div className={`set-grid ${move.weighted ? '' : 'no-weight'}`}>
        <span className="hdr" />
        {move.weighted && <span className="hdr" style={{ textAlign: 'center' }}>{unit} (opt.)</span>}
        <span className="hdr" style={{ textAlign: 'center' }}>{move.timed ? 'Seconds' : kind === 'burnout' ? 'Reps to failure' : 'Reps'}</span>
        <span className="hdr">Last</span>
        <div className={`set-no ${reps ? 'filled' : ''}`}>{kind === 'burnout' ? '🔥' : index + 1}</div>
        {move.weighted && (
          <input className="set-input" inputMode="decimal" aria-label={`${move.name} weight`}
            placeholder={prev?.weightLb != null ? formatWeight(prev.weightLb, unit) : 'BW'} value={weight}
            onChange={(e) => {
              setWeight(e.target.value)
              const v = parseNum(e.target.value)
              save({ weightLb: v == null ? null : toLb(v, unit) })
            }} />
        )}
        <input className="set-input" inputMode="numeric" aria-label={`${move.name} ${what}`}
          placeholder={prev?.reps != null ? String(prev.reps) : what} value={reps}
          onChange={(e) => {
            setReps(e.target.value)
            const r = parseNum(e.target.value)
            save({ reps: r })
            if (isRepPR({ weightLb, reps: r }, same) && !pr) vibrate([30, 40, 30])
          }} />
        {pr ? (
          <span className="pr">🏆 PR</span>
        ) : prev ? (
          <button className="prev" onClick={copyPrev} title="Copy last time">
            {prev.weightLb != null ? `${formatWeight(prev.weightLb, unit)}×` : ''}{prev.reps}{move.timed ? 's' : ''} ↺
          </button>
        ) : (
          <span className="faint small">—</span>
        )}
      </div>
      {!isPlanDefault && (
        <button className="link-btn small" style={{ marginTop: 8 }} onClick={onMakeDefault}>Use {move.name} on every {workoutName} day</button>
      )}
      {creating && (
        <MoveEditor kind={kind} onClose={() => setCreating(false)}
          onSaved={(id) => save({ moveId: id, weightLb: null, reps: null })} />
      )}
      {editing && <MoveEditor id={moveId} kind={kind} onClose={() => setEditing(false)} />}
    </div>
  )
}

const NEW = '__new'

/** The HIIT block for a workout: Joel's moves in order, saved for every day of that workout. */
function HiitList({ workoutKey, workoutName, done, onDone }: {
  workoutKey: Parameters<typeof planFor>[0]
  workoutName: string
  done: boolean
  onDone: (done: boolean) => void
}) {
  const ids = planFor(workoutKey).hiit ?? []
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string>()
  const saveList = (hiit: string[]) => savePlan(workoutKey, { hiit })
  const move = (i: number) => saveList(ids.map((id, j) => (j === i - 1 ? ids[i] : j === i ? ids[i - 1] : id)))

  return (
    <div className="card">
      {ids.length === 0 && (
        <p className="muted small" style={{ marginTop: 0 }}>Add the HIIT moves from Joel's {workoutName} video. They'll show here on every {workoutName} day.</p>
      )}
      {ids.map((id, i) => {
        const m = moveInfo(id)
        return (
          <div key={`${id}-${i}`} className="lib-row">
            <Link to={`/exercise/${id}`} className="ex-thumb" aria-label={`How to do ${m.name}`}><DemoPlayer exercise={m} /></Link>
            <Link to={`/exercise/${id}`} style={{ flex: 1, minWidth: 0, color: 'var(--text)' }}><b className="faint">{i + 1}.</b> {m.name}</Link>
            <span className="card-tools row">
              {i > 0 && <button className="icon-btn" aria-label={`Move ${m.name} up`} title="Move up" onClick={() => move(i)}>▲</button>}
              <button className="icon-btn" aria-label={`Rename or edit ${m.name}`} title="Rename / edit" onClick={() => setEditing(id)}>✎</button>
              <button className="icon-btn" aria-label={`Remove ${m.name}`} title="Remove" onClick={() => saveList(ids.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>
        )
      })}
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ Add HIIT move</button>
      <label className="check" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={done} onChange={(e) => onDone(e.target.checked)} />
        <b>HIIT done</b>
      </label>
      {adding && <AddMoveSheet kind="hiit" title={`Add a HIIT move to ${workoutName}`} onPick={(id) => saveList([...ids, id])} onClose={() => setAdding(false)} />}
      {editing && <MoveEditor id={editing} kind="hiit" onClose={() => setEditing(undefined)} />}
    </div>
  )
}

/** HIIT or burnout after the lifts, then core every day. Each list can grow, shrink and be renamed. */
export function FinisherSection({ slot, session, ensure, data, runId, exercises, unit }: {
  slot: Slot
  session: Session | undefined
  ensure: () => Promise<Session>
  data: RunData
  runId: string
  exercises: Exercise[]
  unit: Unit
}) {
  const order = slotIndex(slot)
  const workout = workoutFor(slot.week, slot.day)
  const key = workout.key
  const plan = planFor(key)
  const [adding, setAdding] = useState<ListKind>()
  const planned = finisherFor(slot)
  const finisher = finisherFor(slot, session?.finisher)
  const mine = data.allExtras.filter((e) => e.sessionId === session?.id)

  // Burnout defaults to what you used last time for this workout, else the program default.
  const lastBurnout = data.allExtras
    .filter((e) => e.runId === runId && e.slot === 'burnout' && e.moveId && orderOf(e) < order && workoutFor(e.week, e.day).key === key)
    .sort((a, b) => orderOf(a) - orderOf(b)).at(-1)?.moveId
  const planLists: Record<ListKind, string[]> = {
    burnout: burnoutsOf(plan) ?? [lastBurnout ?? DEFAULT_BURNOUT[key]],
    core: coreFor(slot),
  }
  // What each card shows today: the logged move, else the plan. Logged entries past the plan keep their card.
  const shown = (kind: ListKind) => {
    const logged = new Map(mine.map((e) => parseSlot(e.slot)).map(([k, i], n) => [`${k}${i}`, mine[n].moveId]))
    const count = Math.max(planLists[kind].length, ...mine.map((e) => parseSlot(e.slot)).filter(([k]) => k === kind).map(([, i]) => i + 1))
    return Array.from({ length: count }, (_, i) => logged.get(`${kind}${i}`) || planLists[kind][i] || planLists[kind][0] || DEFAULT_BURNOUT[key])
  }
  const savedList = (kind: ListKind) => (kind === 'burnout' ? [...planLists.burnout] : [...(plan.core ?? ['', ''])])
  const saveList = (kind: ListKind, list: string[]) =>
    savePlan(key, kind === 'burnout' ? { burnouts: list, burnout: undefined } : { core: list })

  const makeDefault = (kind: ListKind, i: number, id: string) => {
    const list = savedList(kind)
    while (list.length <= i) list.push('')
    list[i] = id
    return saveList(kind, list.map((x) => x || (kind === 'burnout' ? id : '')))
  }
  const add = (kind: ListKind, id: string) => saveList(kind, [...savedList(kind), id])
  const remove = async (kind: ListKind, i: number, id: string) => {
    const log = mine.find((e) => e.slot === slotName(kind, i))
    if (log?.reps != null && !confirm(`Remove ${moveInfo(id).name}? Today's entry for it will be deleted too.`)) return
    if (i < planLists[kind].length) await saveList(kind, planLists[kind].filter((_, j) => j !== i))
    if (session) await removeExtra(session.id, kind, i)
    toast(`Removed from every ${workout.name} day`)
  }

  const common = { session, ensure, data, runId, order, unit, workoutName: workout.name }
  const options: Record<ListKind, { group: string; ids: string[] }[]> = {
    burnout: [
      { group: 'Burnouts', ids: movesOf('burnout').map((m) => m.id) },
      { group: "Today's lifts", ids: exercises.map((e) => e.id) },
    ],
    core: [{ group: 'Core', ids: movesOf('core').map((m) => m.id) }],
  }
  const choose = async (f: Finisher) => updateSession((await ensure()).id, { finisher: f === planned ? undefined : f })
  // Remount inputs when the session or move changes so local input state never shows stale values.
  const k = (kind: ListKind, i: number, id: string) => `${slot.week}-${slot.day}-${kind}${i}-${id}-${session ? 's' : 'n'}`

  const cards = (kind: ListKind) => {
    const ids = shown(kind)
    const name = kind === 'burnout' ? 'Burnout' : 'Core'
    return (
      <div className="stack">
        {ids.length === 0 && <p className="muted small" style={{ margin: 0 }}>No {name.toLowerCase()} moves for {workout.name} yet.</p>}
        {ids.map((id, i) => (
          <MoveCard key={k(kind, i, id)} kind={kind} index={i} label={ids.length > 1 || kind === 'core' ? `${name} ${i + 1}` : name} moveId={id}
            options={options[kind]} {...common}
            isPlanDefault={planLists[kind][i] === id}
            onMakeDefault={() => makeDefault(kind, i, id)}
            onRemove={() => remove(kind, i, id)} />
        ))}
        <button className="btn block" onClick={() => setAdding(kind)}>+ Add {name.toLowerCase()} move</button>
      </div>
    )
  }

  return (
    <>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <div className="h2" style={{ margin: 0 }}>Finisher</div>
        <div className="seg">
          {(['hiit', 'burnout'] as const).map((f) => (
            <button key={f} className={finisher === f ? 'on' : ''} onClick={() => choose(f)}>{f === 'hiit' ? 'HIIT' : 'Burnout'}</button>
          ))}
        </div>
      </div>
      {finisher !== planned && <p className="faint small" style={{ marginTop: -4 }}>The calendar has {planned === 'hiit' ? 'HIIT' : 'a burnout'} today; you switched it.</p>}
      {finisher === 'hiit' ? (
        <HiitList workoutKey={key} workoutName={workout.name} done={session?.hiitDone ?? false}
          onDone={async (done) => updateSession((await ensure()).id, { hiitDone: done })} />
      ) : (
        cards('burnout')
      )}

      <div className="h2">Core</div>
      {cards('core')}
      <p className="faint small">Adding or removing a move changes every {workout.name} day. Swapping one with its menu only changes today.</p>
      {adding && (
        <AddMoveSheet kind={adding} title={`Add a ${adding} move to ${workout.name}`} extra={adding === 'burnout' ? options.burnout.slice(1) : []}
          onPick={(id) => add(adding, id)} onClose={() => setAdding(undefined)} />
      )}
    </>
  )
}
