import type { SetLog } from '../db/db'

export interface SessionSets {
  sessionId: string
  order: number // (week-1)*5 + (day-1)
  sets: SetLog[]
}

const orderOf = (s: SetLog) => (s.week - 1) * 5 + (s.day - 1)
const logged = (s: SetLog) => s.weightLb != null && s.weightLb > 0

/** Group one exercise's logged sets into sessions, oldest first. */
export function sessionsOf(sets: SetLog[]): SessionSets[] {
  const by = new Map<string, SessionSets>()
  for (const s of sets) {
    if (!logged(s)) continue
    const entry = by.get(s.sessionId) ?? { sessionId: s.sessionId, order: orderOf(s), sets: [] }
    entry.sets.push(s)
    by.set(s.sessionId, entry)
  }
  return [...by.values()].sort((a, b) => a.order - b.order)
}

/** The most recent earlier session of this exercise, as setNumber → set. */
export function previousSets(sets: SetLog[], currentOrder: number): Map<number, SetLog> {
  const prior = sessionsOf(sets).filter((s) => s.order < currentOrder)
  const last = prior.at(-1)
  return new Map((last?.sets ?? []).map((s) => [s.setNumber, s]))
}

/** Heaviest weight lifted for this exercise outside the given session (null if never logged). */
export function bestOutside(sets: SetLog[], sessionId: string): number | null {
  let best: number | null = null
  for (const s of sets) if (s.sessionId !== sessionId && logged(s)) best = Math.max(best ?? 0, s.weightLb!)
  return best
}

export const isPR = (weightLb: number | null, best: number | null) =>
  weightLb != null && weightLb > 0 && best != null && weightLb > best

const top = (s: SessionSets) => Math.max(...s.sets.map((x) => x.weightLb!))
const totalReps = (s: SessionSets) => s.sets.reduce((n, x) => n + (x.reps ?? 0), 0)

/**
 * "Go heavier" when the last two sessions used the same top weight and reps held or went up —
 * you've owned that weight, so add one step (5 lb / 2.5 kg). Returns the suggested weight in lb.
 */
export function suggestHeavier(sets: SetLog[], currentOrder: number, stepLb: number): number | null {
  const prior = sessionsOf(sets).filter((s) => s.order < currentOrder)
  if (prior.length < 2) return null
  const [a, b] = prior.slice(-2)
  if (Math.abs(top(a) - top(b)) > 0.01) return null
  if (totalReps(b) < totalReps(a)) return null
  return top(b) + stepLb
}

/**
 * Sets in `runId` that beat every earlier session of the same exercise (earlier sessions in this run,
 * plus anything from other runs). The first time you log a move is a baseline, not a PR.
 */
export function prSets(sets: SetLog[], runId: string): SetLog[] {
  const out: SetLog[] = []
  const byExercise = new Map<string, SetLog[]>()
  for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
  for (const exSets of byExercise.values()) {
    const otherRuns = exSets.filter((s) => s.runId !== runId)
    for (const sess of sessionsOf(exSets.filter((s) => s.runId === runId))) {
      const earlier = [...otherRuns, ...exSets.filter((s) => s.runId === runId && orderOf(s) < sess.order)]
      const best = bestOutside(earlier, sess.sessionId)
      const winner = sess.sets.reduce((a, b) => ((b.weightLb ?? 0) > (a.weightLb ?? 0) ? b : a))
      if (isPR(winner.weightLb, best)) out.push(winner)
    }
  }
  return out
}

/** Total volume (weight × reps) of a list of sets, in lb. */
export const volume = (sets: SetLog[]) =>
  sets.reduce((n, s) => n + (s.weightLb ?? 0) * (s.reps ?? 0), 0)
