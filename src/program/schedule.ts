import { DAYS_PER_WEEK, slotIndex, WEEKS, workoutFor, type Slot, type WorkoutKey } from './calendar'
import { EXERCISES, EXERCISE_BY_ID, GROUP_ORDER, isActive, type Exercise } from './exercises'
import { planFor } from './finishers'

const MS_PER_DAY = 86_400_000

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export type ScheduledDay =
  | { kind: 'before' }
  | { kind: 'after' }
  | { kind: 'workout'; week: number; day: number }
  | { kind: 'rest'; nextIndex: number } // slotIndex of the next workout

/** A run's calendar: Week 1 Day 1 on startDate, rest on the given day offsets. */
export interface Plan {
  startDate: string
  restDays?: number[]
}

export const TOTAL_WORKOUTS = WEEKS * DAYS_PER_WEEK

/** The printed calendar: days 6 and 7 of every week off. */
export function defaultRestDays(): number[] {
  return Array.from({ length: WEEKS }, (_, w) => [w * 7 + 5, w * 7 + 6]).flat()
}

export const restDaysOf = (p: Plan) => new Set(p.restDays ?? defaultRestDays())

/**
 * Day offset (from startDate) of each of the 40 workouts, in program order. Workouts always run
 * in sequence; they fill whichever days aren't rest days.
 */
export function workoutOffsets(p: Plan): number[] {
  const rest = restDaysOf(p)
  const out: number[] = []
  for (let o = 0; out.length < TOTAL_WORKOUTS; o++) if (!rest.has(o)) out.push(o)
  return out
}

const slotAt = (i: number): Slot => ({ week: Math.floor(i / DAYS_PER_WEEK) + 1, day: (i % DAYS_PER_WEEK) + 1 })

const offsetOf = (p: Plan, date: Date) => {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((day.getTime() - parseDate(p.startDate).getTime()) / MS_PER_DAY)
}

/** Where the plan says you are on `date`. */
export function scheduledOn(p: Plan, date: Date): ScheduledDay {
  const offset = offsetOf(p, date)
  if (offset < 0) return { kind: 'before' }
  const offsets = workoutOffsets(p)
  const i = offsets.indexOf(offset)
  if (i >= 0) return { kind: 'workout', ...slotAt(i) }
  const nextIndex = offsets.findIndex((o) => o > offset)
  return nextIndex < 0 ? { kind: 'after' } : { kind: 'rest', nextIndex }
}

export const offsetToDate = (p: Plan, offset: number) => {
  const d = parseDate(p.startDate)
  d.setDate(d.getDate() + offset)
  return d
}

/** Calendar date a slot falls on. */
export const dateForSlot = (p: Plan, s: Slot) => offsetToDate(p, workoutOffsets(p)[slotIndex(s)])

/** Day-by-day layout from the start date to the last workout, for the calendar grid. */
export function planDays(p: Plan): ({ offset: number; date: Date } & ({ kind: 'rest' } | { kind: 'workout'; slot: Slot }))[] {
  const offsets = workoutOffsets(p)
  const bySlot = new Map(offsets.map((o, i) => [o, i]))
  return Array.from({ length: offsets.at(-1)! + 1 }, (_, offset) => {
    const date = offsetToDate(p, offset)
    const i = bySlot.get(offset)
    return i == null ? { offset, date, kind: 'rest' as const } : { offset, date, kind: 'workout' as const, slot: slotAt(i) }
  })
}

/** Move a rest day to another date; the workouts in between shift to fill the gap. */
export function moveRestDay(p: Plan, from: number, to: number): number[] {
  const rest = restDaysOf(p)
  if (!rest.has(from) || rest.has(to) || to < 0) return [...rest].sort((a, b) => a - b)
  rest.delete(from)
  rest.add(to)
  return [...rest].sort((a, b) => a - b)
}

/** Turn a day into a rest day, or a rest day back into a workout day. */
export function toggleRestDay(p: Plan, offset: number): number[] {
  const rest = restDaysOf(p)
  if (rest.has(offset)) rest.delete(offset)
  else rest.add(offset)
  return [...rest].sort((a, b) => a - b)
}

export interface WorkoutOverride {
  workoutKey: WorkoutKey
  added: string[]
  removed: string[]
}

/**
 * Exercises for a session: the workout's groups filtered by tracker week, then the user's edits.
 * Groups alternate (chest, biceps, chest, biceps…) the way the program supersets them, unless you've
 * saved your own order for this day (sessionOrder) or for every day of this workout (the plan's order).
 */
export function exercisesFor(week: number, day: number, override?: WorkoutOverride, sessionOrder?: string[]): Exercise[] {
  const w = workoutFor(week, day)
  const base = EXERCISES.filter((e) => w.groups.includes(e.group) && isActive(e, week))
  const removed = new Set(override?.removed ?? [])
  const list = base.filter((e) => !removed.has(e.id))
  for (const id of override?.added ?? []) {
    const ex = EXERCISE_BY_ID[id]
    if (ex && !list.includes(ex)) list.push(ex)
  }
  const byGroup = w.groups.map((g) => list.filter((e) => e.group === g).sort((a, b) => EXERCISES.indexOf(a) - EXERCISES.indexOf(b)))
  const interleaved: Exercise[] = []
  for (let i = 0; i < Math.max(0, ...byGroup.map((g) => g.length)); i++) for (const g of byGroup) if (g[i]) interleaved.push(g[i])
  // Moves from groups outside the workout (added via Edit exercises) go last.
  const extra = list.filter((e) => !w.groups.includes(e.group))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || EXERCISES.indexOf(a) - EXERCISES.indexOf(b))
  const ordered = [...interleaved, ...extra]
  return applyOrder(ordered, sessionOrder ?? bestOrder(planFor(w.key).orders, ordered.map((e) => e.id)))
}

/** The saved order sharing the most moves with this day (later saves win ties). */
export function bestOrder(orders: string[][] | undefined, ids: string[]): string[] | undefined {
  let best: string[] | undefined
  let bestScore = 0
  for (const o of orders ?? []) {
    const score = o.filter((id) => ids.includes(id)).length
    if (score >= bestScore && score > 0) [best, bestScore] = [o, score]
  }
  return best
}

/** Add or replace the saved order for this exact set of moves. */
export function withOrder(orders: string[][] | undefined, order: string[]): string[][] {
  const key = [...order].sort().join(',')
  return [...(orders ?? []).filter((o) => [...o].sort().join(',') !== key), order]
}

/**
 * Reorder by a saved list of ids. Moves in the list take the saved order; moves it doesn't mention
 * (e.g. the other week's rotation) keep their default spots.
 */
export function applyOrder<T extends { id: string }>(list: T[], order?: string[]): T[] {
  if (!order?.length) return list
  const rank = new Map(order.map((id, i) => [id, i]))
  const ranked = list.filter((x) => rank.has(x.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  let next = 0
  return list.map((x) => (rank.has(x.id) ? ranked[next++] : x))
}
