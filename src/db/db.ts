import Dexie, { type EntityTable } from 'dexie'
import type { WorkoutKey } from '../program/calendar'
import type { CustomMove } from '../program/custom'
import type { ExtraSlot, Finisher, WorkoutPlan } from '../program/finishers'
import type { WorkoutOverride } from '../program/schedule'

export interface Run {
  id: string
  name: string
  startDate: string // YYYY-MM-DD, Week 1 Day 1
  restDays?: number[] // day offsets from startDate; unset = days 6 and 7 of every week
  archived: boolean
  createdAt: number
}

export interface Session {
  id: string // `${runId}:w${week}d${day}`
  runId: string
  week: number
  day: number
  date: string // when it was actually done
  completed: boolean
  hiitDone: boolean
  finisher?: Finisher // unset = what the calendar says for this day
  order?: string[] // exercise ids, when reordered for just this day
  notes: string
}

export interface SetLog {
  id: string // `${sessionId}:${exerciseId}:${setNumber}`
  sessionId: string
  runId: string
  exerciseId: string
  week: number
  day: number
  setNumber: number // 1..3
  weightLb: number | null // canonical unit; converted for display
  reps: number | null
  date: string
}

/** Burnout set or core move logged after the main lifts. */
export interface ExtraLog {
  id: string // `${sessionId}:${slot}`
  sessionId: string
  runId: string
  week: number
  day: number
  slot: ExtraSlot
  moveId: string
  weightLb: number | null
  reps: number | null // seconds for timed moves
  date: string
}

export interface BodyEntry {
  id: string
  runId: string
  date: string
  weightLb: number | null
  chestIn: number | null
  waistIn: number | null
  hipsIn: number | null
  armIn: number | null
  thighIn: number | null
  bodyFatPct: number | null
  notes: string
}

export type PhotoKind = 'before' | 'progress' | 'after'

export interface Photo {
  id: string
  runId: string
  date: string
  kind: PhotoKind
  blob: Blob
}

export interface Setting {
  key: string
  value: string
}

export interface Override extends WorkoutOverride {
  id: string // `${runId}:${workoutKey}`
  runId: string
  workoutKey: WorkoutKey
}

export class LiiftDB extends Dexie {
  runs!: EntityTable<Run, 'id'>
  sessions!: EntityTable<Session, 'id'>
  sets!: EntityTable<SetLog, 'id'>
  body!: EntityTable<BodyEntry, 'id'>
  photos!: EntityTable<Photo, 'id'>
  settings!: EntityTable<Setting, 'key'>
  overrides!: EntityTable<Override, 'id'>
  extras!: EntityTable<ExtraLog, 'id'>
  moves!: EntityTable<CustomMove, 'id'>
  plans!: EntityTable<WorkoutPlan, 'workoutKey'>

  constructor(name = 'liift-more') {
    super(name)
    this.version(1).stores({
      runs: 'id, archived',
      sessions: 'id, runId, [runId+week+day]',
      sets: 'id, sessionId, runId, exerciseId, [runId+exerciseId]',
      body: 'id, runId, date',
      photos: 'id, runId, date, kind',
      settings: 'key',
      overrides: 'id, runId',
    })
    this.version(2).stores({ extras: 'id, sessionId, runId, moveId' })
    this.version(3).stores({ moves: 'id, kind', plans: 'workoutKey' })
  }
}

export const db = new LiiftDB()

export const sessionId = (runId: string, week: number, day: number) => `${runId}:w${week}d${day}`
export const extraId = (sessId: string, slot: ExtraSlot) => `${sessId}:${slot}`
export const setId = (sessId: string, exerciseId: string, n: number) => `${sessId}:${exerciseId}:${n}`
export const newId = () => crypto.randomUUID()
