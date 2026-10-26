import { useState } from 'react'
import { Sheet, toast } from './common'
import { db, newId } from '../db/db'
import { isBuiltIn, toCustom, type CustomKind, type CustomMove } from '../program/custom'
import { EXERCISE_BY_ID, GROUP_LABELS, GROUP_ORDER, type MuscleGroup } from '../program/exercises'
import { MOVE_BY_ID } from '../program/finishers'

export const KIND_LABELS: Record<CustomKind, string> = { lift: 'Lift', burnout: 'Burnout', core: 'Core', hiit: 'HIIT' }
const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean)

/** Create a move, or edit any move (built-in edits are saved as your copy and can be reset). */
export function MoveEditor({ id, kind, group, onClose, onSaved, onDeleted }: {
  id?: string
  kind: CustomKind
  group?: MuscleGroup
  onClose: () => void
  onSaved?: (id: string) => void
  onDeleted?: () => void
}) {
  const existing = id ? EXERCISE_BY_ID[id] ?? MOVE_BY_ID[id] : undefined
  const [m, setM] = useState<CustomMove>(() =>
    existing ? toCustom(existing) : { id: `my-${newId().slice(0, 8)}`, kind, name: '', group: group ?? 'chest', weeks: [1, 2, 3, 4, 5, 6, 7, 8], cues: [], mistakes: [] },
  )
  const [cues, setCues] = useState(m.cues.join('\n'))
  const [mistakes, setMistakes] = useState(m.mistakes.join('\n'))
  const builtIn = isBuiltIn(m.id)
  const edited = !!existing?.origin
  const set = (patch: Partial<CustomMove>) => setM({ ...m, ...patch })
  const lift = m.kind === 'lift'

  const save = async () => {
    if (!m.name.trim()) return toast('Give the move a name')
    const record: CustomMove = { ...m, name: m.name.trim(), cues: lines(cues), mistakes: lines(mistakes), videoUrl: m.videoUrl?.trim() || undefined, notes: m.notes?.trim() || undefined }
    await db.moves.put(record)
    toast(`Saved ${record.name}`)
    onSaved?.(record.id)
    onClose()
  }

  const remove = async () => {
    const used = (await db.sets.where('exerciseId').equals(m.id).count()) + (await db.extras.where('moveId').equals(m.id).count())
    if (!confirm(used ? `Delete ${m.name}? Its ${used} logged entries will show as “Deleted move”.` : `Delete ${m.name}?`)) return
    await db.moves.delete(m.id)
    toast('Move deleted')
    onClose()
    onDeleted?.()
  }

  const check = (key: 'perSide' | 'timed' | 'weighted', label: string) => (
    <label className="check">
      <input type="checkbox" checked={!!m[key]} onChange={(e) => set({ [key]: e.target.checked })} />
      <span>{label}</span>
    </label>
  )

  return (
    <Sheet onClose={onClose}>
      <div className="row between">
        <div className="h2" style={{ margin: 0 }}>{existing ? 'Edit' : 'New'} {m.kind === 'hiit' ? 'HIIT' : KIND_LABELS[m.kind].toLowerCase()} move</div>
        {builtIn && edited && (
          <button className="link-btn small" onClick={async () => { await db.moves.delete(m.id); toast('Back to the original'); onClose() }}>Reset to original</button>
        )}
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {!existing && (
          <div className="seg">
            {(['lift', 'burnout', 'core', 'hiit'] as const).map((k) => (
              <button key={k} className={m.kind === k ? 'on' : ''} onClick={() => set({ kind: k })}>{KIND_LABELS[k]}</button>
            ))}
          </div>
        )}
        <div className="field">
          <label htmlFor="mv-name">Name (as Joel calls it)</label>
          <input id="mv-name" className="input" value={m.name} placeholder="e.g. Hammer Curl Burnout" onChange={(e) => set({ name: e.target.value })} />
        </div>

        {lift ? (
          <>
            <div className="field">
              <label htmlFor="mv-group">Muscle group</label>
              <select id="mv-group" className="input" value={m.group} onChange={(e) => set({ group: e.target.value as MuscleGroup })}>
                {GROUP_ORDER.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Weeks it's on the program</label>
              <div className="weeks">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => {
                  const on = m.weeks?.includes(w)
                  return (
                    <button key={w} className={on ? 'on' : ''} onClick={() => set({ weeks: on ? m.weeks!.filter((x) => x !== w) : [...(m.weeks ?? []), w].sort() })}>{w}</button>
                  )
                })}
              </div>
              <span className="faint small">It shows up on every {GROUP_LABELS[m.group ?? 'chest']} workout in these weeks.</span>
            </div>
            {check('perSide', 'One side at a time (R&L)')}
          </>
        ) : (
          <>
            {m.kind !== 'hiit' && check('timed', 'Timed — log seconds instead of reps')}
            {m.kind !== 'hiit' && check('weighted', 'Can use dumbbells (adds a weight field)')}
            {check('perSide', 'One side at a time (R&L)')}
          </>
        )}

        <div className="field">
          <label htmlFor="mv-video">Video link (optional)</label>
          <input id="mv-video" className="input" type="url" inputMode="url" value={m.videoUrl ?? ''} placeholder="Link to the exact spot, e.g. https://youtu.be/…?t=754" onChange={(e) => set({ videoUrl: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="mv-cues">How to do it · one cue per line</label>
          <textarea id="mv-cues" className="input" value={cues} onChange={(e) => setCues(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mv-mistakes">Mistakes to avoid · one per line</label>
          <textarea id="mv-mistakes" className="input" value={mistakes} onChange={(e) => setMistakes(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mv-notes">Notes</label>
          <textarea id="mv-notes" className="input" value={m.notes ?? ''} placeholder="Tempo, reps or time Joel calls for, modifications…" onChange={(e) => set({ notes: e.target.value })} />
        </div>
        <button className="btn primary block" onClick={save}>Save</button>
        {existing && !builtIn && <button className="btn block" style={{ color: 'var(--danger)' }} onClick={remove}>Delete move</button>}
      </div>
    </Sheet>
  )
}
