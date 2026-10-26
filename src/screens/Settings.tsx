import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet, toast, useApp } from '../components/common'
import { db } from '../db/db'
import { getSetting, putSetting, SETTINGS, startRun } from '../db/store'
import { exportPhotos, importPhotos } from '../logic/photosZip'
import { downloadBlob, exportWorkbook, importWorkbook } from '../logic/spreadsheet'
import { toISODate } from '../program/schedule'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export default function Settings() {
  const { run, unit } = useApp()
  const info = useLiveQuery(async () => ({
    lastBackup: Number((await getSetting(SETTINGS.lastBackup)) ?? 0),
    runs: (await db.runs.toArray()).sort((a, b) => a.createdAt - b.createdAt),
    sets: await db.sets.count(),
    photos: await db.photos.count(),
  }))
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [newRun, setNewRun] = useState(false)
  const [newStart, setNewStart] = useState(toISODate(new Date()))
  if (!info) return null

  const exportXlsx = async () => {
    downloadBlob(await exportWorkbook(db), `liift-more-backup-${toISODate(new Date())}.xlsx`, XLSX_TYPE)
    await putSetting(SETTINGS.lastBackup, String(Date.now()))
    toast('Spreadsheet exported')
  }

  const doImport = async (mode: 'replace' | 'merge') => {
    if (!pendingImport) return
    try {
      const r = await importWorkbook(db, await pendingImport.arrayBuffer(), mode)
      toast(`Imported ${r.sets} sets from ${r.sessions} workouts`)
    } catch (e) {
      toast((e as Error).message)
    }
    setPendingImport(null)
  }

  return (
    <>
      <div className="eyebrow">Program & data</div>
      <div className="title">Settings</div>

      <div className="card stack">
        <div className="field">
          <label htmlFor="start">Week 1 · Day 1 date</label>
          <input id="start" className="input" type="date" value={run.startDate} onChange={(e) => e.target.value && db.runs.update(run.id, { startDate: e.target.value })} />
        </div>
        <div className="row between">
          <span>Weight unit</span>
          <div className="seg">
            {(['lb', 'kg'] as const).map((u) => (
              <button key={u} className={unit === u ? 'on' : ''} onClick={() => putSetting(SETTINGS.unit, u)}>{u}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="h2">Exercises</div>
      <Link to="/library" className="card row between" style={{ color: 'var(--text)' }}>
        <span>
          <b>Exercise library</b>
          <span className="muted small" style={{ display: 'block' }}>Rename moves, edit cues and links, or add Joel's lifts, burnouts, core and HIIT moves.</span>
        </span>
        <span className="faint">›</span>
      </Link>

      <div className="h2">Backup & move devices</div>
      <div className="card stack">
        <p className="muted small" style={{ margin: 0 }}>
          Your data lives only on this device ({info.sets} sets, {info.photos} photos). Export the spreadsheet regularly — open it in
          Excel/Numbers to see the tracker grid, or import it on another device to continue where you left off.
          {' '}Last export: <b>{info.lastBackup ? new Date(info.lastBackup).toLocaleDateString() : 'never'}</b>.
        </p>
        <button className="btn primary block" onClick={exportXlsx}>⬇ Export spreadsheet (.xlsx)</button>
        <label className="btn block">
          ⬆ Import spreadsheet
          <input type="file" accept=".xlsx" hidden onChange={(e) => { setPendingImport(e.target.files?.[0] ?? null); e.target.value = '' }} />
        </label>
        <div className="grid2">
          <button className="btn sm" onClick={async () => downloadBlob(await exportPhotos(db), `liift-more-photos-${toISODate(new Date())}.zip`, 'application/zip')} disabled={!info.photos}>Export photos (.zip)</button>
          <label className="btn sm">
            Import photos
            <input type="file" accept=".zip" hidden onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try { toast(`Imported ${await importPhotos(db, f)} photos`) } catch (err) { toast((err as Error).message) }
            }} />
          </label>
        </div>
      </div>

      <div className="h2">Runs</div>
      <div className="card stack">
        {info.runs.map((r) => (
          <div key={r.id} className="row between">
            <div>
              <div style={{ fontWeight: 650 }}>{r.name} {r.id === run.id && <span className="tag done">Active</span>}</div>
              <div className="faint small">Started {r.startDate}</div>
            </div>
            {r.id !== run.id && <button className="btn sm" onClick={() => putSetting(SETTINGS.activeRun, r.id)}>Switch</button>}
          </div>
        ))}
        <button className="btn block" onClick={() => setNewRun(true)}>Start a new 8-week run</button>
      </div>

      <div className="h2">Install on iPhone</div>
      <div className="card muted small">
        Open this page in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>. It then opens full-screen, works offline at the gym,
        and iOS keeps its data. Data in a home-screen app is separate from the same site opened in a Safari tab.
      </div>

      {pendingImport && (
        <Sheet onClose={() => setPendingImport(null)}>
          <div className="h2" style={{ marginTop: 0 }}>Import {pendingImport.name}</div>
          <p className="muted small"><b>Replace</b> wipes logged workouts on this device and continues from the file (photos are kept). <b>Merge</b> adds the file's data and overwrites matching days.</p>
          <div className="stack">
            <button className="btn primary block" onClick={() => doImport('replace')}>Replace — continue from this file</button>
            <button className="btn block" onClick={() => doImport('merge')}>Merge into this device</button>
          </div>
        </Sheet>
      )}

      {newRun && (
        <Sheet onClose={() => setNewRun(false)}>
          <div className="h2" style={{ marginTop: 0 }}>Start a new run</div>
          <p className="muted small">The current run is archived (still viewable via Switch). Your best weights carry over for PRs and "last time" hints start fresh.</p>
          <div className="field">
            <label>Week 1 · Day 1 date</label>
            <input className="input" type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </div>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={async () => { await startRun(newStart); setNewRun(false); toast('New run started') }}>Start</button>
        </Sheet>
      )}
    </>
  )
}
