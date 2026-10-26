import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { Run } from '../db/db'
import type { Unit } from '../logic/units'
import { demoFrames, type Exercise } from '../program/exercises'

export interface AppState {
  run: Run
  unit: Unit
  /** Bumps whenever custom moves or workout plans change, so screens re-read the catalog. */
  catalog: number
}

export const AppContext = createContext<AppState | null>(null)
export const useApp = () => useContext(AppContext)!

/** Two-frame demo crossfading every 0.8s, like a GIF. */
export function DemoPlayer({ exercise, showBadge }: { exercise: Pick<Exercise, 'name' | 'demo'>; showBadge?: boolean }) {
  const frames = demoFrames(exercise)
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (frames.length < 2) return
    const t = setInterval(() => setFrame((f) => 1 - f), 900)
    return () => clearInterval(t)
  }, [frames.length])
  if (!frames.length) return <div className="demo empty">{showBadge ? 'No demo image. Add a video link with Edit.' : 'No demo'}</div>
  return (
    <div className="demo">
      {frames.map((src, i) => (
        <img key={src} src={src} alt={i === 0 ? `${exercise.name} start` : `${exercise.name} end`} style={{ opacity: frame === i ? 1 : 0 }} loading="lazy" />
      ))}
      {showBadge && <span className="badge">Closest-match demo</span>}
    </div>
  )
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<(m: string | null) => void>()
export function toast(message: string) {
  listeners.forEach((l) => l(message))
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => listeners.forEach((l) => l(null)), 3200)
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    listeners.add(setMsg)
    return () => void listeners.delete(setMsg)
  }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

export const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported (iOS) */ }
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

const TABS = [
  { to: '/', label: 'Today', icon: icon('M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11') },
  { to: '/calendar', label: 'Calendar', icon: icon('M4 5h16v15H4zM4 10h16M9 3v4M15 3v4') },
  { to: '/progress', label: 'Progress', icon: icon('M4 19V5M4 19h16M8 15l4-4 3 3 5-6') },
  { to: '/body', label: 'Body', icon: icon('M12 4a2 2 0 1 0 0 .01M7 21l2-8-3-3 4-2h4l4 2-3 3 2 8') },
  { to: '/settings', label: 'Settings', icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z') },
]

export function TabBar() {
  return (
    <div className="tabbar">
      <nav>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
