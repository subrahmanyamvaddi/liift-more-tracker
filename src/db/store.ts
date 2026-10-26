import { db, extraId, newId, sessionId, setId, type ExtraLog, type Run, type Session, type SetLog } from './db'
import type { ExtraSlot, WorkoutPlan } from '../program/finishers'
import type { WorkoutKey } from '../program/calendar'
import type { Unit } from '../logic/units'
import { dateForSlot, toISODate } from '../program/schedule'

export const SETTINGS = {
  activeRun: 'activeRunId',
  unit: 'unit',
  lastBackup: 'lastBackupAt',
} as const

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export const putSetting = (key: string, value: string) => db.settings.put({ key, value })

export async function getUnit(): Promise<Unit> {
  return ((await getSetting(SETTINGS.unit)) as Unit) ?? 'lb'
}

export async function getActiveRun(): Promise<Run | undefined> {
  const id = await getSetting(SETTINGS.activeRun)
  return id ? db.runs.get(id) : undefined
}

export async function startRun(startDate: string, name = 'LIIFT MORE'): Promise<Run> {
  const run: Run = { id: newId(), name, startDate, archived: false, createdAt: Date.now() }
  await db.transaction('rw', db.runs, db.settings, async () => {
    const current = await getActiveRun()
    if (current) await db.runs.update(current.id, { archived: true })
    await db.runs.add(run)
    await putSetting(SETTINGS.activeRun, run.id)
  })
  return run
}

/** Backfilling a past workout? Default to its calendar date rather than today. */
export function defaultSessionDate(run: Run, week: number, day: number): string {
  const scheduled = dateForSlot(run, { week, day })
  return toISODate(scheduled < new Date() ? scheduled : new Date())
}

export async function getOrCreateSession(run: Run, week: number, day: number): Promise<Session> {
  const runId = run.id
  const id = sessionId(runId, week, day)
  const existing = await db.sessions.get(id)
  if (existing) return existing
  const s: Session = { id, runId, week, day, date: defaultSessionDate(run, week, day), completed: false, hiitDone: false, notes: '' }
  await db.sessions.put(s)
  return s
}

export const updateSession = (id: string, patch: Partial<Session>) => db.sessions.update(id, patch)

export async function saveSet(
  session: Session,
  exerciseId: string,
  setNumber: number,
  patch: Partial<Pick<SetLog, 'weightLb' | 'reps'>>,
) {
  const id = setId(session.id, exerciseId, setNumber)
  const existing = await db.sets.get(id)
  const row: SetLog = {
    id,
    sessionId: session.id,
    runId: session.runId,
    exerciseId,
    week: session.week,
    day: session.day,
    setNumber,
    weightLb: null,
    reps: null,
    date: session.date,
    ...existing,
    ...patch,
  }
  await db.sets.put(row)
}

export async function saveExtra(
  session: Session,
  slot: ExtraSlot,
  patch: Partial<Pick<ExtraLog, 'moveId' | 'weightLb' | 'reps'>>,
) {
  const id = extraId(session.id, slot)
  const existing = await db.extras.get(id)
  await db.extras.put({
    id, sessionId: session.id, runId: session.runId, week: session.week, day: session.day, slot,
    moveId: '', weightLb: null, reps: null, date: session.date,
    ...existing,
    ...patch,
  })
}

export const setRestDays = (runId: string, restDays: number[] | undefined) => db.runs.update(runId, { restDays })

export async function setOverride(runId: string, workoutKey: WorkoutKey, added: string[], removed: string[]) {
  await db.overrides.put({ id: `${runId}:${workoutKey}`, runId, workoutKey, added, removed })
}

/** Save part of a workout's plan (name, burnout, core, HIIT); empty fields fall back to the program defaults. */
export async function savePlan(workoutKey: WorkoutKey, patch: Partial<Omit<WorkoutPlan, 'workoutKey'>>) {
  const existing = await db.plans.get(workoutKey)
  await db.plans.put({ ...existing, ...patch, workoutKey })
}
