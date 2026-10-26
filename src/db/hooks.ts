import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ExtraLog, type Override, type Session, type SetLog } from './db'
import { allSlots, slotId, slotIndex, type Slot, type WorkoutKey } from '../program/calendar'
import type { ScheduledDay } from '../program/schedule'

export interface RunData {
  sessions: Map<string, Session> // by slotId (w1d1)
  setsBySlot: Map<string, SetLog[]>
  allSets: SetLog[] // every run, for PRs/history
  allExtras: ExtraLog[] // burnout + core logs, every run
  overrides: Map<WorkoutKey, Override>
}

export function useRunData(runId: string): RunData | undefined {
  return useLiveQuery(async () => {
    const [sessions, allSets, overrides, allExtras] = await Promise.all([
      db.sessions.where('runId').equals(runId).toArray(),
      db.sets.toArray(),
      db.overrides.where('runId').equals(runId).toArray(),
      db.extras.toArray(),
    ])
    const setsBySlot = new Map<string, SetLog[]>()
    for (const s of allSets) {
      if (s.runId !== runId || s.weightLb == null) continue
      const k = slotId(s)
      setsBySlot.set(k, [...(setsBySlot.get(k) ?? []), s])
    }
    return {
      sessions: new Map(sessions.map((s) => [slotId(s), s])),
      setsBySlot,
      allSets,
      allExtras,
      overrides: new Map(overrides.map((o) => [o.workoutKey, o])),
    }
  }, [runId])
}

/**
 * The workout to do next: today's calendar workout if it isn't done yet, otherwise the first
 * unfinished one after your last completed workout (or after today's position if you joined mid-program).
 */
export function nextSlot(data: RunData, today: ScheduledDay): Slot | undefined {
  const done = (s: Slot) => data.sessions.get(slotId(s))?.completed
  if (today.kind === 'workout' && !done(today)) return { week: today.week, day: today.day }
  const slots = allSlots()
  const lastDone = Math.max(-1, ...slots.filter(done).map(slotIndex))
  let from = lastDone + 1
  if (lastDone < 0 && today.kind === 'rest') from = today.nextIndex
  return slots.find((s) => slotIndex(s) >= from && !done(s)) ?? slots.find((s) => !done(s))
}

export const completedCount = (data: RunData) => [...data.sessions.values()].filter((s) => s.completed).length
