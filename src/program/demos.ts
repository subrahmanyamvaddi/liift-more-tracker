import demoIndex from '../generated/demoIndex.json'
import { BUILT_IN_EXERCISES, type Exercise } from './exercises'
import { BUILT_IN_MOVES } from './finishers'

/** Saved on a move when you don't want any demo, so one isn't matched automatically. */
export const NO_DEMO = 'none'

const REMOTE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises'
// Demos used by built-in moves ship with the app; any other one is fetched once, then kept for offline use.
const BUNDLED = new Set([...BUILT_IN_EXERCISES, ...BUILT_IN_MOVES].map((m) => m.demo))

export function demoFrames(ex: Pick<Exercise, 'demo'>): string[] {
  if (!ex.demo || ex.demo === NO_DEMO) return []
  const base = BUNDLED.has(ex.demo) ? `${import.meta.env.BASE_URL}exercises` : REMOTE
  return [`${base}/${ex.demo}/0.jpg`, `${base}/${ex.demo}/1.jpg`]
}

// Words that describe how a move is programmed rather than what it is.
const STOP = new Set(['a', 'and', 'alt', 'alternating', 'burnout', 'exercise', 'hiit', 'in', 'joel', 'joels', 'l', 'move', 'of', 'on', 'pulse', 'r', 'rl', 'the', 'to', 'with'])

const stem = (w: string) => (/(ch|sh|x)es$/.test(w) ? w.slice(0, -2) : /[^s]s$/.test(w) && w !== 'abs' ? w.slice(0, -1) : w)

function tokens(name: string): string[] {
  const clean = name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[’']/g, '').replace(/&/g, ' ')
    .replace(/pushup/g, 'push up').replace(/pullup/g, 'pull up').replace(/situp/g, 'sit up').replace(/[^a-z0-9]+/g, ' ')
  return clean.split(' ').filter(Boolean).map(stem).filter((w) => !STOP.has(w))
}

/** Common names the database spells differently. Each points at the closest movement it has. */
export const DEMO_ALIASES: [RegExp, string][] = [
  [/\bjumping jack\b|\bstar jump\b/, 'Star_Jump'],
  [/\b(squat jump|jump squat)\b/, 'Freehand_Jump_Squat'],
  [/\b(lunge jump|jump lunge|split lunge jump)\b/, 'Split_Jump'],
  [/\bskater\b/, 'Lateral_Bound'],
  [/\bhigh knee\b/, 'Fast_Skipping'],
  [/\b(sprint|run in place)\b/, 'Wind_Sprints'],
  [/\bbicycle\b/, 'Air_Bike'],
  [/\bv up\b/, 'Jackknife_Sit-Up'],
  [/\bside plank\b/, 'Side_Bridge'],
  [/\bhip (raise|lift|thrust)\b|\bglute bridge\b/, 'Butt_Lift_Bridge'],
  [/\b(chair|bench) dip\b/, 'Bench_Dips'],
  [/\bleg raise\b/, 'Flat_Bench_Lying_Leg_Raise'],
  [/\bscissor\b/, 'Scissor_Kick'],
  [/\btoe touch\b/, 'Toe_Touchers'],
  [/\bpush up\b$/, 'Pushups'],
  [/\bsquat\b$/, 'Bodyweight_Squat'],
]

const INDEX = demoIndex.map((d) => ({ ...d, words: tokens(d.name) }))

/** The closest demo for a move's name, or undefined if nothing is close enough to be useful. */
export function matchDemo(name: string): string | undefined {
  const words = tokens(name)
  if (!words.length) return undefined
  const joined = words.join(' ')
  for (const [pattern, id] of DEMO_ALIASES) if (pattern.test(joined)) return id
  let best: { id: string; score: number } | undefined
  for (const d of INDEX) {
    if (d.stretch && !words.includes('stretch')) continue
    const shared = words.filter((w) => d.words.includes(w)).length
    // Sørensen–Dice overlap, with bodyweight versions winning ties: your own moves are mostly bodyweight.
    const score = (2 * shared) / (words.length + d.words.length) + (d.body ? 0.01 : 0)
    if (!best || score > best.score) best = { id: d.id, score }
  }
  return best && best.score >= 0.66 ? best.id : undefined
}

/** Demos whose name contains every word typed, for the picker. */
export function searchDemos(query: string, limit = 30) {
  const words = tokens(query)
  if (!words.length) return []
  return INDEX.filter((d) => words.every((w) => d.words.some((x) => x.startsWith(w)))).sort((a, b) => b.body - a.body || a.name.length - b.name.length).slice(0, limit)
}
