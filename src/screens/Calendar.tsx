import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast, useApp, vibrate } from '../components/common'
import { completedCount, nextSlot, useRunData } from '../db/hooks'
import { setRestDays } from '../db/store'
import { phaseOf, slotId, workoutFor } from '../program/calendar'
import { finisherFor } from '../program/finishers'
import { defaultRestDays, moveRestDay, planDays, restDaysOf, scheduledOn, toggleRestDay, toISODate } from '../program/schedule'
import './insights.css'

interface Drag {
  from: number
  x0: number
  y0: number
  x: number
  y: number
  over: number | null
  moved: boolean
}

export default function CalendarScreen() {
  const { run } = useApp()
  const data = useRunData(run.id)
  const navigate = useNavigate()
  const [mode, setMode] = useState<'add' | 'move' | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  // Pointer events can outpace re-renders, so handlers read the live drag from a ref.
  const dragRef = useRef<Drag | null>(null)
  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }
  if (!data) return null

  const today = scheduledOn(run, new Date())
  const todayISO = toISODate(new Date())
  const next = nextSlot(data, today)
  const days = planDays(run)
  const cells = [...days, ...Array.from({ length: (7 - (days.length % 7)) % 7 }, () => null)]
  const weekdays = days.slice(0, 7).map((d) => d.date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2))

  const finish = days.at(-1)!.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const extraRest = Math.max(0, restDaysOf(run).size - defaultRestDays().length)
  const chooseMode = (m: 'add' | 'move') => { setMode(mode === m ? null : m); setDrag(null) }

  const save = (rest: number[] | undefined) => setRestDays(run.id, rest)
  const shortDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const targetAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-offset]')
    return el ? Number(el.dataset.offset) : null
  }

  return (
    <>
      <div className="eyebrow">Workout calendar</div>
      <div className="row between">
        <div className="title">{completedCount(data)}/40 done</div>
      </div>

      <div className="cal-actions">
        <button className={`btn sm ${mode === 'add' ? 'primary' : ''}`} aria-pressed={mode === 'add'} onClick={() => chooseMode('add')}>
          {mode === 'add' ? 'Done' : '+ Add rest day'}
        </button>
        <button className={`btn sm ${mode === 'move' ? 'primary' : ''}`} aria-pressed={mode === 'move'} onClick={() => chooseMode('move')}>
          {mode === 'move' ? 'Done' : 'Move rest days'}
        </button>
      </div>

      {mode && (
        <div className="card small" style={{ marginBottom: 12 }}>
          <div className="muted">
            {mode === 'add' ? (
              <><b style={{ color: 'var(--text)' }}>Tap any day</b> to make it a rest day. That day's workout and everything after it move back a day. Tap a rest day to remove it.</>
            ) : (
              <><b style={{ color: 'var(--text)' }}>Drag</b> a rest day onto another date. Workouts stay in program order and slide around your rest days.</>
            )}
            {extraRest > 0 && <> You've added {extraRest} extra rest day{extraRest === 1 ? '' : 's'}; the program finishes {finish}.</>}
          </div>
          <button className="link-btn small" style={{ marginTop: 6 }} onClick={() => { if (confirm('Go back to the printed calendar? Your added and moved rest days will be removed.')) { save(undefined); toast('Back to the printed calendar (days 6 & 7 off)') } }}>
            Reset to the printed calendar
          </button>
        </div>
      )}

      <div className={`cal7 ${mode === 'move' ? 'editing' : mode === 'add' ? 'adding' : ''}`}>
        {weekdays.map((w, i) => <div key={i} className="hd">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />
          const dateLabel = d.date.getDate() === 1 || d.offset === 0
            ? d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : String(d.date.getDate())
          const isToday = toISODate(d.date) === todayISO

          if (d.kind === 'rest') {
            const lifted = drag?.moved && drag.from === d.offset
            return (
              <div key={d.offset} data-offset={d.offset}
                className={['cell', 'rest', isToday && 'today', lifted && 'lifted'].filter(Boolean).join(' ')}
                role={mode ? 'button' : undefined} aria-label={`${d.date.toDateString()}: rest day`}
                onClick={mode === 'add' ? () => { save(toggleRestDay(run, d.offset)); toast(`Rest day on ${shortDate(d.date)} removed`) } : undefined}
                onPointerDown={mode === 'move' ? (e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setDrag({ from: d.offset, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, over: null, moved: false })
                } : undefined}
                onPointerMove={(e) => {
                  const drag = dragRef.current
                  if (!drag) return
                  const moved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6
                  if (moved && !drag.moved) vibrate(10)
                  setDrag({ ...drag, x: e.clientX, y: e.clientY, moved, over: targetAt(e.clientX, e.clientY) })
                }}
                onPointerUp={() => {
                  const drag = dragRef.current
                  if (!drag) return
                  if (drag.moved && drag.over != null && drag.over !== drag.from) save(moveRestDay(run, drag.from, drag.over))
                  setDrag(null)
                }}
                onPointerCancel={() => setDrag(null)}
              >
                <span className="dt">{dateLabel}</span>
                <span className="nm">Rest</span>
                {mode === 'move' && <span className="grip">⠿</span>}
              </div>
            )
          }

          const s = d.slot
          const id = slotId(s)
          const session = data.sessions.get(id)
          const hiit = finisherFor(s, session?.finisher) === 'hiit'
          const cls = [
            'cell', phaseOf(s.week) === 1 ? 'p1' : 'p2',
            session?.completed ? 'done' : data.setsBySlot.has(id) && 'partial',
            next?.week === s.week && next.day === s.day && 'next',
            isToday && 'today',
            drag?.moved && drag.over === d.offset && 'drop',
          ].filter(Boolean).join(' ')
          return (
            <button key={d.offset} data-offset={d.offset} className={cls} aria-label={`${d.date.toDateString()}: week ${s.week} day ${s.day}`}
              onClick={() => {
                if (mode === 'move') return
                if (mode !== 'add') return navigate(`/session/${s.week}/${s.day}`)
                save(toggleRestDay(run, d.offset))
                toast(`Rest day added on ${shortDate(d.date)}. Workouts from W${s.week}·D${s.day} on moved back a day.`)
              }}>
              <span className="dt">{dateLabel}</span>
              <span className="wd">W{s.week}·D{s.day}</span>
              <span className="nm">{workoutFor(s.week, s.day).short}</span>
              {session?.completed ? <span className="tick">✓</span> : <span className={`fin ${hiit ? 'hiit' : ''}`}>{hiit ? 'HIIT' : 'BURN'}</span>}
            </button>
          )
        })}
      </div>

      {drag?.moved && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>Rest</div>}

      <div className="row wrap small muted" style={{ marginTop: 14, gap: 14 }}>
        <span><span className="tick">✓</span> Done</span>
        <span style={{ color: 'var(--accent)' }}>▢ Up next</span>
        <span><span style={{ color: 'var(--gold)' }}>●</span> Today</span>
        <span><b style={{ color: 'var(--gold)' }}>HIIT</b> / <b>BURN</b> finisher</span>
      </div>
      <p className="faint small">Tap any workout to log or review it. Need extra time off? Use “+ Add rest day”, and the program finishes later.</p>
    </>
  )
}
