import type { ExtraLog, Session, SetLog } from '../db/db'
import { WEEKS, workoutFor } from '../program/calendar'
import { EXERCISE_BY_ID, GROUP_LABELS, GROUP_ORDER, type MuscleGroup } from '../program/exercises'
import { moveInfo, parseSlot } from '../program/finishers'

/** A part of the body the app tracks: the tracker's muscle groups plus core. */
export type Region = MuscleGroup | 'core'
export const REGIONS: Region[] = [...GROUP_ORDER, 'core']
export const regionLabel = (r: Region) => (r === 'core' ? 'Core' : GROUP_LABELS[r])

/** Which shapes on the body map light up for each region. */
export const REGION_SLUGS: Record<Region, string[]> = {
  chest: ['chest'],
  back: ['upperBack', 'trapezius', 'lowerBack'],
  shoulders: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quads: ['quadriceps', 'adductors'],
  hams: ['hamstring', 'gluteal'],
  calves: ['calves', 'tibialis'],
  core: ['abs', 'obliques'],
}

const BURNOUT_REGION: Record<string, Region> = {
  'bo-push-up': 'chest', 'bo-chair-dip': 'triceps', 'bo-squat': 'quads', 'bo-lunge': 'quads',
  'bo-glute-bridge': 'hams', 'bo-lateral-raise': 'shoulders', 'bo-hammer-curl': 'biceps', 'bo-calf-raise': 'calves',
}

export interface RegionLoad {
  sets: number
  volumeLb: number
  lastDate: string | null
  moves: string[] // names, most recent first
}

const empty = (): RegionLoad => ({ sets: 0, volumeLb: 0, lastDate: null, moves: [] })

interface Credit { region: Region; share: number }

/** Lifts count for their muscle group, core moves for core. A burnout counts for its muscle, or is shared across the day's muscles if it's one of your own. */
function creditsFor(log: ExtraLog): Credit[] {
  if (parseSlot(log.slot)[0] === 'core') return [{ region: 'core', share: 1 }]
  const single = EXERCISE_BY_ID[log.moveId]?.group ?? BURNOUT_REGION[log.moveId]
  if (single) return [{ region: single, share: 1 }]
  const groups = workoutFor(log.week, log.day).groups
  return groups.map((region) => ({ region, share: 1 / groups.length }))
}

interface Entry { region: Region; week: number; date: string; share: number; volumeLb: number; name: string }

function entries(runId: string, sets: SetLog[], extras: ExtraLog[], sessions: Iterable<Session>): Entry[] {
  // A workout's date can be changed in the logger; the session holds the current one.
  const dateOf = new Map([...sessions].map((s) => [s.id, s.date]))
  const out: Entry[] = []
  for (const s of sets) {
    const ex = EXERCISE_BY_ID[s.exerciseId]
    if (s.runId !== runId || !ex || (s.weightLb == null && s.reps == null)) continue
    out.push({ region: ex.group, week: s.week, date: dateOf.get(s.sessionId) ?? s.date, share: 1, volumeLb: (s.weightLb ?? 0) * (s.reps ?? 0), name: ex.name })
  }
  for (const e of extras) {
    if (e.runId !== runId || e.reps == null) continue
    for (const { region, share } of creditsFor(e)) {
      out.push({ region, week: e.week, date: dateOf.get(e.sessionId) ?? e.date, share, volumeLb: (e.weightLb ?? 0) * e.reps * share, name: moveInfo(e.moveId).name })
    }
  }
  return out
}

export interface LoadInput { runId: string; sets: SetLog[]; extras: ExtraLog[]; sessions: Iterable<Session> }

/** Sets, volume and last-trained date per region, optionally only from `since` (YYYY-MM-DD) on. */
export function regionLoads({ runId, sets, extras, sessions }: LoadInput, since?: string, until?: string): Record<Region, RegionLoad> {
  const out = Object.fromEntries(REGIONS.map((r) => [r, empty()])) as Record<Region, RegionLoad>
  const all = entries(runId, sets, extras, sessions)
    .filter((e) => (!since || e.date >= since) && (!until || e.date <= until))
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const e of all) {
    const load = out[e.region]
    load.sets += e.share
    load.volumeLb += e.volumeLb
    load.lastDate ??= e.date
    if (!load.moves.includes(e.name)) load.moves.push(e.name)
  }
  return out
}

/** Sets per region for each program week, for the week-by-week table. */
export function weeklyRegionSets({ runId, sets, extras, sessions }: LoadInput): Record<Region, number[]> {
  const out = Object.fromEntries(REGIONS.map((r) => [r, Array.from({ length: WEEKS }, () => 0)])) as Record<Region, number[]>
  for (const e of entries(runId, sets, extras, sessions)) if (e.week >= 1 && e.week <= WEEKS) out[e.region][e.week - 1] += e.share
  return out
}

/**
 * How hard a muscle is working, from its sets per week. These bands are the common rule of thumb
 * for muscle-building volume (roughly 10–20 hard sets a week), not a medical or BODi figure.
 */
export type Level = 0 | 1 | 2 | 3 | 4
export function intensityLevel(setsPerWeek: number): Level {
  if (setsPerWeek <= 0) return 0
  if (setsPerWeek < 6) return 1
  if (setsPerWeek < 12) return 2
  if (setsPerWeek < 20) return 3
  return 4
}
export const LEVEL_LABELS: Record<Level, string> = { 0: 'Not yet', 1: 'Light', 2: 'Moderate', 3: 'Hard', 4: 'Very hard' }
