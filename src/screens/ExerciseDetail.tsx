import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MoveEditor } from '../components/moveEditor'
import { DemoPlayer, useApp } from '../components/common'
import { ExerciseChart } from '../components/charts'
import { useRunData } from '../db/hooks'
import { EXERCISE_BY_ID, GROUP_LABELS } from '../program/exercises'
import { MOVE_BY_ID, type Move } from '../program/finishers'
import { sessionsOf } from '../logic/progression'
import { formatWeight } from '../logic/units'

/** Back + Edit header, and the editor sheet. */
function Header({ id, kind, origin }: { id: string; kind: 'lift' | Move['kind']; origin?: string }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  return (
    <>
      <div className="row between">
        <button className="link-btn" onClick={() => navigate(-1)}>‹ Back</button>
        <button className="link-btn" onClick={() => setEditing(true)}>✎ Edit{origin === 'edited' ? ' (edited)' : ''}</button>
      </div>
      {editing && <MoveEditor id={id} kind={kind} onClose={() => setEditing(false)} onDeleted={() => navigate(-1)} />}
    </>
  )
}

function YourNotes({ x }: { x: { videoUrl?: string; notes?: string } }) {
  if (!x.videoUrl && !x.notes) return null
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Your notes</div>
      {x.videoUrl && <a href={x.videoUrl} target="_blank" rel="noreferrer" className="btn sm" style={{ marginBottom: x.notes ? 10 : 0 }}>▶ Watch in Joel's video</a>}
      {x.notes && <div style={{ whiteSpace: 'pre-wrap' }}>{x.notes}</div>}
    </div>
  )
}

function MoveDetail({ move }: { move: Move }) {
  const { run, unit } = useApp()
  const data = useRunData(run.id)
  if (!data) return null
  const logs = data.allExtras.filter((e) => e.moveId === move.id && e.runId === run.id && e.reps != null)
    .sort((a, b) => b.week - a.week || b.day - a.day)
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${move.name.replace(/ \(.*\)| Burnout/g, '')} proper form`)}`
  const what = move.timed ? 's' : ' reps'
  return (
    <>
      <Header id={move.id} kind={move.kind} origin={move.origin} />
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        <span className="tag">{move.kind === 'core' ? 'Core' : move.kind === 'hiit' ? 'HIIT' : 'Burnout'}</span>
        {move.origin === 'custom' && <span className="tag done">Yours</span>}
        {move.timed && <span className="tag">Timed</span>}
        {move.perSide && <span className="tag">Per side (R&L)</span>}
      </div>
      <div className="title">{move.name}</div>
      <DemoPlayer exercise={move} showBadge />
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="faint small">{move.kind === 'burnout' ? 'As many good reps as you can' : move.kind === 'hiit' ? 'Part of the HIIT block' : 'After every workout'}</span>
        <a href={yt} target="_blank" rel="noreferrer" className="small">▶ Watch on YouTube</a>
      </div>
      <YourNotes x={move} />
      {move.cues.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>How to do it</div>
          <ul className="cues">{move.cues.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {move.mistakes.length > 0 && (
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--danger)' }}>Avoid</div>
          <ul className="cues">{move.mistakes.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      <div className="h2 row between">
        <span>Your log</span>
        {logs.length > 0 && <span className="pr">Best {Math.max(...logs.map((l) => l.reps!))}{what}</span>}
      </div>
      <div className="card">
        {logs.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nothing logged yet.</p>}
        {logs.map((l) => (
          <div key={l.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="muted">W{l.week} D{l.day} · {l.date}</span>
            <span className="num">{l.weightLb != null ? `${formatWeight(l.weightLb, unit)} ${unit} × ` : ''}{l.reps}{what}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export default function ExerciseDetail() {
  const { id } = useParams()
  const { run, unit } = useApp()
  const data = useRunData(run.id)
  const ex = id ? EXERCISE_BY_ID[id] : undefined
  if (!ex && id && MOVE_BY_ID[id]) return <MoveDetail move={MOVE_BY_ID[id]} />
  if (!ex) return <p>Unknown exercise.</p>
  if (!data) return null

  const sets = data.allSets.filter((s) => s.exerciseId === ex.id && s.runId === run.id)
  const sessions = sessionsOf(sets).reverse()
  const best = Math.max(0, ...data.allSets.filter((s) => s.exerciseId === ex.id).map((s) => s.weightLb ?? 0))
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name.replace(/ \(.*\)/, '')} dumbbell proper form`)}`

  return (
    <>
      <Header id={ex.id} kind="lift" origin={ex.origin} />
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        <span className="tag">{GROUP_LABELS[ex.group]}</span>
        {ex.origin === 'custom' && <span className="tag done">Yours</span>}
        {ex.unilateral && <span className="tag">Per side (R&L)</span>}
      </div>
      <div className="title">{ex.name}</div>

      <DemoPlayer exercise={ex} showBadge />
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="faint small">Weeks: {ex.weeks.join(', ')}</span>
        <a href={yt} target="_blank" rel="noreferrer" className="small">▶ Watch on YouTube</a>
      </div>

      <YourNotes x={ex} />
      {ex.cues.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>How to do it</div>
          <ul className="cues">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {ex.mistakes.length > 0 && (
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--danger)' }}>Avoid</div>
          <ul className="cues">{ex.mistakes.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}

      <div className="h2 row between">
        <span>Your progress</span>
        {best > 0 && <span className="pr">Best {formatWeight(best, unit)} {unit}</span>}
      </div>
      <div className="card">
        <ExerciseChart sets={sets} unit={unit} />
      </div>
      {sessions.length > 0 && (
        <div className="card">
          {sessions.map((s) => (
            <div key={s.sessionId} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="muted">W{s.sets[0].week} D{s.sets[0].day} · {s.sets[0].date}</span>
              <span className="num">
                {s.sets.sort((a, b) => a.setNumber - b.setNumber).map((x) => `${formatWeight(x.weightLb, unit)}×${x.reps ?? '–'}`).join('  ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
