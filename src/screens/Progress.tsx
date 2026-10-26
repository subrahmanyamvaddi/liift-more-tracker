import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../components/common'
import { ExerciseChart, WeeklyVolumeChart } from '../components/charts'
import { useRunData } from '../db/hooks'
import { WEEKS } from '../program/calendar'
import { EXERCISES, EXERCISE_BY_ID, GROUP_LABELS, GROUP_ORDER, isActive } from '../program/exercises'
import { prSets } from '../logic/progression'
import { formatWeight, fromLb } from '../logic/units'

type Tab = 'tracker' | 'charts' | 'prs'

export default function Progress() {
  const { run, unit } = useApp()
  const data = useRunData(run.id)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('tracker')
  const [exId, setExId] = useState(EXERCISES[0].id)
  if (!data) return null

  const runSets = data.allSets.filter((s) => s.runId === run.id && s.weightLb != null)
  const cell = new Map(runSets.map((s) => [`${s.exerciseId}:${s.week}:${s.setNumber}`, s]))
  const weeks = Array.from({ length: WEEKS }, (_, i) => i + 1)
  const prs = prSets(data.allSets, run.id).sort((a, b) => b.week - a.week || b.day - a.day)
  const prIds = new Set(prs.map((s) => s.id))

  return (
    <>
      <div className="eyebrow">Weight progression</div>
      <div className="title">Progress</div>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(['tracker', 'charts', 'prs'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'tracker' ? 'Tracker' : t === 'charts' ? 'Charts' : `PRs (${prs.length})`}
          </button>
        ))}
      </div>

      {tab === 'tracker' && (
        <>
          <p className="faint small" style={{ marginTop: 0 }}>Same layout as the paper sheet, in {unit}. Gray = not on the program that week. Gold = a new PR. Scroll sideways →</p>
          <div className="tracker-wrap">
            <table className="tracker">
              <thead>
                <tr>
                  <th className="ex" />
                  {weeks.map((w) => <th key={w} colSpan={3} className="wk-h" style={{ color: w <= 4 ? '#f0a49b' : '#9dc0f2' }}>WEEK {w}</th>)}
                </tr>
                <tr>
                  <th className="ex" />
                  {weeks.map((w) => [1, 2, 3].map((n) => <th key={`${w}-${n}`} className={n === 1 ? 'wk-h' : ''}>S{n}</th>))}
                </tr>
              </thead>
              <tbody>
                {GROUP_ORDER.map((g) => (
                  <Fragment key={g}>
                    <tr className="grp"><td colSpan={1 + WEEKS * 3}>{GROUP_LABELS[g]}</td></tr>
                    {EXERCISES.filter((e) => e.group === g).map((e) => (
                      <tr key={e.id}>
                        <td className="ex" onClick={() => navigate(`/exercise/${e.id}`)}>{e.name}</td>
                        {weeks.map((w) => [1, 2, 3].map((n) => {
                          const s = cell.get(`${e.id}:${w}:${n}`)
                          const off = !isActive(e, w) && !s
                          const cls = [off ? 'off' : 'v', n === 1 && 's1', s && 'has', s && prIds.has(s.id) && 'best'].filter(Boolean).join(' ')
                          return <td key={`${w}-${n}`} className={cls}>{s ? fromLb(s.weightLb!, unit) : ''}</td>
                        }))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'charts' && (
        <>
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Total volume per week ({unit} × reps)</div>
            <WeeklyVolumeChart sets={runSets} unit={unit} />
          </div>
          <div className="card">
            <select className="input" value={exId} onChange={(e) => setExId(e.target.value)} style={{ marginBottom: 10 }}>
              {GROUP_ORDER.map((g) => (
                <optgroup key={g} label={GROUP_LABELS[g]}>
                  {EXERCISES.filter((e) => e.group === g).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Top set per workout ({unit})</div>
            <ExerciseChart sets={runSets.filter((s) => s.exerciseId === exId)} unit={unit} />
          </div>
        </>
      )}

      {tab === 'prs' && (
        <div className="card">
          {prs.length === 0 && <p className="muted small" style={{ margin: 0 }}>Beat a weight from an earlier week and it shows up here. 🏆</p>}
          {prs.map((s) => (
            <div key={s.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 650 }}>{EXERCISE_BY_ID[s.exerciseId]?.name}</div>
                <div className="faint small">W{s.week} D{s.day} · {s.date}</div>
              </div>
              <span className="pr" style={{ fontSize: 15 }}>🏆 {formatWeight(s.weightLb, unit)} {unit}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
