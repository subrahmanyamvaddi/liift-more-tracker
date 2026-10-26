import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DemoPlayer, useApp } from '../components/common'
import { KIND_LABELS, MoveEditor } from '../components/moveEditor'
import type { CustomKind } from '../program/custom'
import { EXERCISES, GROUP_LABELS, GROUP_ORDER, type Exercise } from '../program/exercises'
import { movesOf, type Move } from '../program/finishers'

function Row({ x }: { x: Exercise | Move }) {
  return (
    <Link to={`/exercise/${x.id}`} className="lib-row">
      <span className="ex-thumb"><DemoPlayer exercise={x} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ex-name" style={{ fontSize: 15 }}>{x.name}</span>
        {x.origin && <span className={`tag ${x.origin === 'custom' ? 'done' : ''}`} style={{ marginLeft: 6 }}>{x.origin === 'custom' ? 'Yours' : 'Edited'}</span>}
      </span>
      <span className="faint">›</span>
    </Link>
  )
}

export default function Library() {
  useApp() // re-render when the catalog changes
  const navigate = useNavigate()
  const [kind, setKind] = useState<CustomKind>('lift')
  const [adding, setAdding] = useState(false)

  return (
    <>
      <button className="link-btn" onClick={() => navigate(-1)}>‹ Back</button>
      <div className="row between" style={{ marginTop: 10 }}>
        <div className="title" style={{ margin: 0 }}>Exercise library</div>
        <button className="btn sm primary" onClick={() => setAdding(true)}>+ Add move</button>
      </div>
      <p className="muted small">
        Watching Joel's videos? Tap any move to rename it, rewrite the cues, or add a link to the exact spot in the video. Add the moves
        the app is missing with <b>+ Add move</b>. Your changes are saved on this device and included in the spreadsheet backup.
      </p>
      <div className="seg" style={{ marginBottom: 12 }}>
        {(['lift', 'burnout', 'core', 'hiit'] as const).map((k) => (
          <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k === 'lift' ? 'Lifts' : KIND_LABELS[k]}</button>
        ))}
      </div>

      {kind === 'lift' ? (
        GROUP_ORDER.map((g) => (
          <div key={g}>
            <div className="eyebrow" style={{ margin: '14px 0 6px' }}>{GROUP_LABELS[g]}</div>
            <div className="card" style={{ padding: '4px 12px' }}>
              {EXERCISES.filter((e) => e.group === g).map((e) => <Row key={e.id} x={e} />)}
            </div>
          </div>
        ))
      ) : (
        <div className="card" style={{ padding: '4px 12px' }}>
          {movesOf(kind).map((m) => <Row key={m.id} x={m} />)}
        </div>
      )}

      {adding && <MoveEditor kind={kind} onClose={() => setAdding(false)} onSaved={(id) => navigate(`/exercise/${id}`)} />}
    </>
  )
}
