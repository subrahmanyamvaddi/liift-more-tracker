import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DemoPlayer, Sheet, vibrate } from './common'
import { MoveEditor } from './moveEditor'
import type { ExtraLog, Session } from '../db/db'
import { saveExtra, savePlan, updateSession } from '../db/store'
import type { RunData } from '../db/hooks'
import { slotIndex, workoutFor, type Slot } from '../program/calendar'
import type { Exercise } from '../program/exercises'
import { DEFAULT_BURNOUT, defaultCore, finisherFor, moveInfo, movesOf, planFor, type ExtraSlot, type Finisher } from '../program/finishers'
import { formatWeight, fromLb, toLb, type Unit } from '../logic/units'

const parseNum = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}
const orderOf = (x: { week: number; day: number }) => slotIndex(x)

/** More reps (or seconds) than any earlier log of the move at the same or a heavier weight. */
export function isRepPR(log: Pick<ExtraLog, 'weightLb' | 'reps'>, others: ExtraLog[]): boolean {
  if (log.reps == null || log.reps <= 0) return false
  const comparable = others.filter((o) => o.reps != null && (o.weightLb ?? 0) >= (log.weightLb ?? 0))
  return comparable.length > 0 && log.reps > Math.max(...comparable.map((o) => o.reps!))
}

function MoveCard({ slot, label, moveId, options, session, ensure, data, runId, order, unit, workoutName, isPlanDefault, onMakeDefault }: {
  slot: ExtraSlot
  label: string
  moveId: string
  workoutName: string
  isPlanDefault: boolean
  onMakeDefault: () => void
  options: { group: string; ids: string[] }[]
  session: Session | undefined
  ensure: () => Promise<Session>
  data: RunData
  runId: string
  order: number
  unit: Unit
}) {
  const move = moveInfo(moveId)
  const [creating, setCreating] = useState(false)
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
      </div>
      <div className={`set-grid ${move.weighted ? '' : 'no-weight'}`}>
        <span className="hdr" />
        {move.weighted && <span className="hdr" style={{ textAlign: 'center' }}>{unit} (opt.)</span>}
        <span className="hdr" style={{ textAlign: 'center' }}>{move.timed ? 'Seconds' : slot === 'burnout' ? 'Reps to failure' : 'Reps'}</span>
        <span className="hdr">Last</span>
        <div className={`set-no ${reps ? 'filled' : ''}`}>{slot === 'burnout' ? '🔥' : slot === 'core1' ? '1' : '2'}</div>
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
        <MoveEditor kind={slot === 'burnout' ? 'burnout' : 'core'} onClose={() => setCreating(false)}
          onSaved={(id) => save({ moveId: id, weightLb: null, reps: null })} />
      )}
    </div>
  )
}

const NEW = '__new'

/** Pick which HIIT moves a workout uses (saved for every day of that workout). */
function HiitSheet({ workoutKey, workoutName, onClose }: { workoutKey: Parameters<typeof planFor>[0]; workoutName: string; onClose: () => void }) {
  const [chosen, setChosen] = useState<string[]>(planFor(workoutKey).hiit ?? [])
  const [creating, setCreating] = useState(false)
  const all = movesOf('hiit')
  const ordered = [...chosen.map((id) => all.find((m) => m.id === id)).filter((m) => m != null), ...all.filter((m) => !chosen.includes(m.id))]
  return (
    <Sheet onClose={onClose}>
      <div className="h2" style={{ marginTop: 0 }}>HIIT for {workoutName}</div>
      <p className="muted small">Tick the moves in the order Joel does them. This applies to every {workoutName} day.</p>
      {ordered.map((m) => {
        const i = chosen.indexOf(m.id)
        return (
          <label key={m.id} className="check">
            <input type="checkbox" checked={i >= 0} onChange={(e) => setChosen(e.target.checked ? [...chosen, m.id] : chosen.filter((x) => x !== m.id))} />
            <span>{i >= 0 && <b className="faint">{i + 1}. </b>}{m.name}</span>
          </label>
        )
      })}
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => setCreating(true)}>+ New HIIT move</button>
      <button className="btn primary block" style={{ marginTop: 10 }} onClick={async () => { await savePlan(workoutKey, { hiit: chosen }); onClose() }}>Save</button>
      {creating && <MoveEditor kind="hiit" onClose={() => setCreating(false)} onSaved={(id) => setChosen((c) => [...c, id])} />}
    </Sheet>
  )
}

/** HIIT or burnout after the lifts, then two core moves. */
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
  const [editingHiit, setEditingHiit] = useState(false)
  const planned = finisherFor(slot)
  const finisher = finisherFor(slot, session?.finisher)
  const mine = data.allExtras.filter((e) => e.sessionId === session?.id)
  const logged = (s: ExtraSlot) => mine.find((e) => e.slot === s)?.moveId || undefined

  // Burnout defaults to what you used last time for this workout, else the program default.
  const lastBurnout = data.allExtras
    .filter((e) => e.runId === runId && e.slot === 'burnout' && e.moveId && orderOf(e) < order && workoutFor(e.week, e.day).key === key)
    .sort((a, b) => orderOf(a) - orderOf(b)).at(-1)?.moveId
  const burnoutId = logged('burnout') ?? plan.burnout ?? lastBurnout ?? DEFAULT_BURNOUT[key]
  const [core1, core2] = defaultCore(slot)
  const common = { session, ensure, data, runId, order, unit, workoutName: workout.name }
  const burnoutOptions = [
    { group: 'Burnouts', ids: movesOf('burnout').map((m) => m.id) },
    { group: "Today's lifts", ids: exercises.map((e) => e.id) },
  ]
  const coreOptions = [{ group: 'Core', ids: movesOf('core').map((m) => m.id) }]
  const c1 = logged('core1') ?? core1
  const c2 = logged('core2') ?? core2
  const hiitMoves = (plan.hiit ?? []).map(moveInfo)

  const choose = async (f: Finisher) => updateSession((await ensure()).id, { finisher: f === planned ? undefined : f })
  // Remount inputs when the session or move changes so local input state never shows stale values.
  const k = (s: ExtraSlot, id: string) => `${slot.week}-${slot.day}-${s}-${id}-${session ? 's' : 'n'}`

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
        <div className="card">
          {hiitMoves.length === 0 ? (
            <p className="muted small" style={{ marginTop: 0 }}>Add the HIIT moves from Joel's {workout.name} video to see them here every time.</p>
          ) : (
            hiitMoves.map((m, i) => (
              <Link key={m.id} to={`/exercise/${m.id}`} className="lib-row">
                <span className="ex-thumb"><DemoPlayer exercise={m} /></span>
                <span style={{ flex: 1 }}><b className="faint">{i + 1}.</b> {m.name}</span>
                <span className="small">Form ›</span>
              </Link>
            ))
          )}
          <div className="row between" style={{ marginTop: 6 }}>
            <label className="check">
              <input type="checkbox" checked={session?.hiitDone ?? false} onChange={async (e) => updateSession((await ensure()).id, { hiitDone: e.target.checked })} />
              <b>HIIT done</b>
            </label>
            <button className="link-btn small" onClick={() => setEditingHiit(true)}>{hiitMoves.length ? 'Edit moves' : '+ Add moves'}</button>
          </div>
        </div>
      ) : (
        <MoveCard key={k('burnout', burnoutId)} slot="burnout" label="Burnout" moveId={burnoutId} options={burnoutOptions} {...common}
          isPlanDefault={(plan.burnout ?? DEFAULT_BURNOUT[key]) === burnoutId} onMakeDefault={() => savePlan(key, { burnout: burnoutId })} />
      )}

      <div className="h2">Core</div>
      <div className="stack">
        <MoveCard key={k('core1', c1)} slot="core1" label="Core 1" moveId={c1} options={coreOptions} {...common}
          isPlanDefault={plan.core?.[0] === c1 || (!plan.core?.[0] && c1 === core1)} onMakeDefault={() => savePlan(key, { core: [c1, plan.core?.[1] ?? ''] })} />
        <MoveCard key={k('core2', c2)} slot="core2" label="Core 2" moveId={c2} options={coreOptions} {...common}
          isPlanDefault={plan.core?.[1] === c2 || (!plan.core?.[1] && c2 === core2)} onMakeDefault={() => savePlan(key, { core: [plan.core?.[0] ?? '', c2] })} />
      </div>
      {editingHiit && <HiitSheet workoutKey={key} workoutName={workout.name} onClose={() => setEditingHiit(false)} />}
    </>
  )
}
