import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SetLog } from '../db/db'
import { best1RM, sessionsOf, volume } from '../logic/progression'
import { fromLb, type Unit } from '../logic/units'

const tooltipStyle = { background: '#23272d', border: '1px solid #30353d', borderRadius: 10, color: '#e9ecef', fontSize: 13 }

export type ExerciseMetric = 'top' | 'e1rm' | 'volume'
const METRIC_LABELS: Record<ExerciseMetric, string> = { top: 'Top set', e1rm: 'Est. 1RM', volume: 'Volume' }

/** One measure per session for one exercise: top weight, estimated one-rep max, or volume. */
export function ExerciseChart({ sets, unit, metric = 'top' }: { sets: SetLog[]; unit: Unit; metric?: ExerciseMetric }) {
  const rows = sessionsOf(sets).map((s) => ({
    label: `W${s.sets[0].week}D${s.sets[0].day}`,
    top: Math.round(fromLb(
      metric === 'volume' ? volume(s.sets) : metric === 'e1rm' ? best1RM(s.sets) ?? 0 : Math.max(...s.sets.map((x) => x.weightLb!)),
      unit,
    )),
  }))
  if (rows.length === 0) return <p className="muted small">No sets logged yet — your chart will appear after the first workout.</p>
  // Round the axis to whole 5s (one plate-ish step) so ticks read cleanly.
  const step = Math.max(5, Math.ceil((Math.max(...rows.map((r) => r.top)) - Math.min(...rows.map((r) => r.top)) + 10) / 4 / 5) * 5)
  const lo = Math.max(0, Math.floor((Math.min(...rows.map((r) => r.top)) - 5) / step) * step)
  const hi = Math.ceil((Math.max(...rows.map((r) => r.top)) + 5) / step) * step
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step)
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#2a2e34" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} domain={[lo, hi]} ticks={ticks} width={metric === 'volume' ? 60 : undefined} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()} ${unit}`, METRIC_LABELS[metric]]} />
        <Line type="monotone" dataKey="top" stroke="#3cc0f0" strokeWidth={2.5} dot={{ r: 3.5, fill: '#3cc0f0' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function WeeklyVolumeChart({ sets, unit }: { sets: SetLog[]; unit: Unit }) {
  const rows = Array.from({ length: 8 }, (_, i) => ({
    week: `W${i + 1}`,
    volume: Math.round(fromLb(volume(sets.filter((s) => s.week === i + 1)), unit)),
    phase: i < 4 ? 1 : 2,
  }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid stroke="#2a2e34" vertical={false} />
        <XAxis dataKey="week" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${v % 1000 ? (v / 1000).toFixed(1) : v / 1000}k` : String(v))} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [`${Number(v).toLocaleString()} ${unit}`, 'Volume']} />
        <Bar dataKey="volume" fill="#3cc0f0" radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BodyChart({ data, dataKey, label }: { data: { date: string; [k: string]: number | string | null }[]; dataKey: string; label: string }) {
  const rows = data.filter((d) => d[dataKey] != null)
  if (rows.length < 2) return null
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#2a2e34" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, label]} />
        <Line type="monotone" dataKey={dataKey} stroke="#f5c542" strokeWidth={2.5} dot={{ r: 3.5, fill: '#f5c542' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
