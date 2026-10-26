import { useState } from 'react'
import { db } from '../db/db'
import { putSetting, SETTINGS, startRun } from '../db/store'
import { importWorkbook } from '../logic/spreadsheet'
import type { Unit } from '../logic/units'
import { toISODate } from '../program/schedule'

export default function Onboarding() {
  const [start, setStart] = useState(toISODate(new Date()))
  const [unit, setUnit] = useState<Unit>('lb')
  const [error, setError] = useState('')

  const begin = async () => {
    await putSetting(SETTINGS.unit, unit)
    await startRun(start)
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      await importWorkbook(db, await file.arrayBuffer(), 'replace')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <main className="app" style={{ paddingTop: 'calc(var(--safe-top) + 48px)' }}>
      <div className="eyebrow">8-week program tracker</div>
      <div className="title" style={{ fontSize: 40, lineHeight: 1 }}>
        LIIFT <span style={{ color: 'var(--accent)' }}>MORE</span>
      </div>
      <p className="muted">Log every set, watch the weights climb week by week, and check form before each move.</p>

      <div className="card stack" style={{ marginTop: 24 }}>
        <div className="field">
          <label htmlFor="start">Week 1 · Day 1 date</label>
          <input id="start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="faint small">Already a few weeks in? Pick the Monday you started — the app works out where you are.</span>
        </div>
        <div className="field">
          <label>Weights in</label>
          <div className="seg">
            {(['lb', 'kg'] as const).map((u) => (
              <button key={u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>{u}</button>
            ))}
          </div>
        </div>
        <button className="btn primary block" onClick={begin} disabled={!start}>Start tracking</button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 650 }}>Continuing on a new device?</div>
        <p className="muted small" style={{ margin: '4px 0 12px' }}>Import the spreadsheet you exported from your other device.</p>
        <label className="btn block">
          Import backup (.xlsx)
          <input type="file" accept=".xlsx" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </label>
        {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    </main>
  )
}
