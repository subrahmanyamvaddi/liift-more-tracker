import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet, toast, useApp } from '../components/common'
import { BodyChart } from '../components/charts'
import { db, newId, type BodyEntry, type Photo, type PhotoKind } from '../db/db'
import { fromLb, toLb } from '../logic/units'
import { toISODate } from '../program/schedule'

const FIELDS = [
  ['chestIn', 'Chest'],
  ['waistIn', 'Waist'],
  ['hipsIn', 'Hips'],
  ['armIn', 'Arm'],
  ['thighIn', 'Thigh'],
] as const

/** Downscale to 1600px JPEG so photos don't eat device storage. */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85))
}

function useObjectUrls(photos: Photo[]) {
  const urls = useMemo(() => new Map(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

function EntryForm({ onClose }: { onClose: () => void }) {
  const { run, unit } = useApp()
  const [form, setForm] = useState<Record<string, string>>({ date: toISODate(new Date()) })
  const n = (k: string) => (form[k] ? parseFloat(form[k]) : null)

  const save = async () => {
    const w = n('weight')
    const entry: BodyEntry = {
      id: newId(), runId: run.id, date: form.date, weightLb: w == null ? null : toLb(w, unit),
      chestIn: n('chestIn'), waistIn: n('waistIn'), hipsIn: n('hipsIn'), armIn: n('armIn'), thighIn: n('thighIn'),
      bodyFatPct: n('bodyFatPct'), notes: form.notes ?? '',
    }
    await db.body.add(entry)
    toast('Measurements saved')
    onClose()
  }

  const input = (k: string, label: string) => (
    <div className="field" key={k}>
      <label>{label}</label>
      <input className="input" inputMode="decimal" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  )

  return (
    <Sheet onClose={onClose}>
      <div className="h2" style={{ marginTop: 0 }}>New measurements</div>
      <div className="stack">
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="grid2">
          {input('weight', `Body weight (${unit})`)}
          {input('bodyFatPct', 'Body fat %')}
          {FIELDS.map(([k, l]) => input(k, `${l} (in)`))}
        </div>
        {input('notes', 'Notes')}
        <button className="btn primary block" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

function Compare({ before, after }: { before: string; after: string }) {
  const [split, setSplit] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    setSplit(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }
  return (
    <div
      ref={ref} className="compare" style={{ '--split': `${split}%` } as React.CSSProperties}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); move(e.clientX) }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      <img src={before} alt="Before" />
      <img src={after} alt="After" className="after" />
      <div className="divider" />
      <span className="lbl" style={{ left: 8 }}>Before</span>
      <span className="lbl" style={{ right: 8 }}>After</span>
    </div>
  )
}

export default function Body() {
  const { run, unit } = useApp()
  const entries = useLiveQuery(() => db.body.where('runId').equals(run.id).sortBy('date'), [run.id])
  const photos = useLiveQuery(() => db.photos.where('runId').equals(run.id).sortBy('date'), [run.id])
  const urls = useObjectUrls(photos ?? [])
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<PhotoKind>('before')
  const [picked, setPicked] = useState<string[]>([])
  if (!entries || !photos) return null

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      await db.photos.add({ id: newId(), runId: run.id, date: toISODate(new Date()), kind, blob: await compress(f) })
    }
    toast(`${files.length} photo${files.length > 1 ? 's' : ''} saved`)
  }

  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]))
  const defaultBefore = photos.find((p) => p.kind === 'before')
  const defaultAfter = [...photos].reverse().find((p) => p.kind !== 'before')
  const [a, b] = picked.length === 2 ? picked : [defaultBefore?.id, defaultAfter?.id]
  const chartData = entries.map((e) => ({ date: e.date, weight: e.weightLb == null ? null : fromLb(e.weightLb, unit), waist: e.waistIn }))
  const first = entries[0]
  const last = entries.at(-1)

  return (
    <>
      <div className="eyebrow">Measurements & photos</div>
      <div className="title">Body</div>

      <div className="row between">
        <div className="h2" style={{ margin: 0 }}>Measurements</div>
        <button className="btn sm primary" onClick={() => setAdding(true)}>+ Add</button>
      </div>
      {entries.length === 0 ? (
        <p className="muted small">Log your starting measurements on Day 1 and again after Week 8 to see the change.</p>
      ) : (
        <>
          {first && last && first !== last && (
            <div className="grid2" style={{ marginTop: 12 }}>
              {first.weightLb != null && last.weightLb != null && (
                <div className="stat"><div className="v">{(fromLb(last.weightLb, unit) - fromLb(first.weightLb, unit)).toFixed(1)}</div><div className="l">Weight change ({unit})</div></div>
              )}
              {first.waistIn != null && last.waistIn != null && (
                <div className="stat"><div className="v">{(last.waistIn - first.waistIn).toFixed(1)}</div><div className="l">Waist change (in)</div></div>
              )}
            </div>
          )}
          <div className="card" style={{ marginTop: 12 }}>
            <BodyChart data={chartData} dataKey="weight" label={`Weight (${unit})`} />
            {[...entries].reverse().map((e) => (
              <div key={e.id} className="row between small" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{e.date.slice(5)}</span>
                <span className="num" style={{ textAlign: 'right' }}>
                  {[e.weightLb != null && `${fromLb(e.weightLb, unit)} ${unit}`, ...FIELDS.map(([k, l]) => e[k] != null && `${l} ${e[k]}″`), e.bodyFatPct != null && `${e.bodyFatPct}% bf`].filter(Boolean).join(' · ')}
                </span>
                <button className="link-btn small" style={{ color: 'var(--faint)' }} aria-label="Delete entry" onClick={() => confirm('Delete this entry?') && db.body.delete(e.id)}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="h2">Photos</div>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <div className="seg">
          {(['before', 'progress', 'after'] as const).map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
          ))}
        </div>
        <label className="btn sm primary">
          + Add {kind} photo
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
        </label>
      </div>

      {a && b && a !== b && urls.get(a) && urls.get(b) && (
        <div style={{ marginBottom: 12 }}>
          <Compare before={urls.get(a)!} after={urls.get(b)!} />
          <p className="faint small">Drag to compare. Tap two photos below to choose which ones.</p>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="muted small">Front, side and back shots in the same spot and lighting make the best comparison. Photos stay on this device.</p>
      ) : (
        <div className="photos">
          {photos.map((p) => (
            <figure key={p.id} className={picked.includes(p.id) ? 'sel' : ''} onClick={() => pick(p.id)}>
              <img src={urls.get(p.id)} alt={`${p.kind} ${p.date}`} />
              <figcaption className="row between">
                <span>{p.kind} · {p.date.slice(5)}</span>
                <button className="link-btn" style={{ color: '#fff' }} aria-label="Delete photo" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this photo?')) db.photos.delete(p.id) }}>✕</button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {adding && <EntryForm onClose={() => setAdding(false)} />}
    </>
  )
}
