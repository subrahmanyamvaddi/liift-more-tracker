import { useRef, useState } from 'react'
import { Sheet, toast, vibrate } from './common'
import type { Session } from '../db/db'
import { savePlan, updateSession } from '../db/store'
import type { WorkoutDef } from '../program/calendar'
import { GROUP_LABELS, type Exercise } from '../program/exercises'
import { planFor } from '../program/finishers'
import { withOrder } from '../program/schedule'

/** Drag (or ▲▼) the day's lifts into the order Joel does them; save for this day or every day of the workout. */
export function ReorderSheet({ workout, exercises, session, ensure, onClose }: {
  workout: WorkoutDef
  exercises: Exercise[]
  session: Session | undefined
  ensure: () => Promise<Session>
  onClose: () => void
}) {
  const [list, setList] = useState(exercises)
  const [dragging, setDragging] = useState<string | null>(null)
  const dragRef = useRef<string | null>(null)

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return
    const next = [...list]
    next.splice(to, 0, next.splice(from, 1)[0])
    setList(next)
  }
  const ids = list.map((e) => e.id)

  const saveDay = async () => {
    await updateSession((await ensure()).id, { order: ids })
    toast('Order saved for this day')
    onClose()
  }
  const saveAll = async () => {
    await savePlan(workout.key, { orders: withOrder(planFor(workout.key).orders, ids) })
    if (session?.order) await updateSession(session.id, { order: undefined })
    toast(`Order saved for every ${workout.name} day`)
    onClose()
  }
  const reset = async () => {
    const key = [...ids].sort().join(',')
    const rest = (planFor(workout.key).orders ?? []).filter((o) => [...o].sort().join(',') !== key)
    await savePlan(workout.key, { orders: rest.length ? rest : undefined })
    if (session?.order) await updateSession(session.id, { order: undefined })
    toast('Back to the alternating order')
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="row between">
        <div className="h2" style={{ margin: 0 }}>Exercise order</div>
        <button className="link-btn small" onClick={reset}>Reset</button>
      </div>
      <p className="muted small">Drag ⠿ (or use the arrows) to match the order in today's video. Weeks with different moves (the tracker rotates them) keep their own order.</p>
      <div className="reorder">
        {list.map((e, i) => (
          <div key={e.id} data-id={e.id} className={`ro-row ${dragging === e.id ? 'dragging' : ''}`}>
            <span className="ro-handle" aria-label={`Drag ${e.name}`}
              onPointerDown={(ev) => {
                ev.currentTarget.setPointerCapture(ev.pointerId)
                dragRef.current = e.id
                setDragging(e.id)
                vibrate(10)
              }}
              onPointerMove={(ev) => {
                const id = dragRef.current
                if (!id) return
                const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-id]')?.dataset.id
                if (!over || over === id) return
                setList((cur) => {
                  const from = cur.findIndex((x) => x.id === id)
                  const to = cur.findIndex((x) => x.id === over)
                  const next = [...cur]
                  next.splice(to, 0, next.splice(from, 1)[0])
                  return next
                })
              }}
              onPointerUp={() => { dragRef.current = null; setDragging(null) }}
              onPointerCancel={() => { dragRef.current = null; setDragging(null) }}
            >⠿</span>
            <span className="ro-no">{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 650 }}>{e.name}</span>
              <span className="faint small" style={{ display: 'block' }}>{GROUP_LABELS[e.group]}</span>
            </span>
            <button className="ro-btn" aria-label={`Move ${e.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>▲</button>
            <button className="ro-btn" aria-label={`Move ${e.name} down`} disabled={i === list.length - 1} onClick={() => move(i, i + 1)}>▼</button>
          </div>
        ))}
      </div>
      <div className="stack" style={{ marginTop: 14 }}>
        <button className="btn primary block" onClick={saveAll}>Save for every {workout.name} day with these moves</button>
        <button className="btn block" onClick={saveDay}>Just this day</button>
      </div>
    </Sheet>
  )
}
