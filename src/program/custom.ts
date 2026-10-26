import { setWorkoutNames, type WorkoutKey } from './calendar'
import { BUILT_IN_EXERCISES, setExercises, type Exercise, type MuscleGroup } from './exercises'
import { BUILT_IN_MOVES, setMoves, setPlans, type Move, type MoveKind, type WorkoutPlan } from './finishers'

export type CustomKind = 'lift' | MoveKind

/**
 * A move the user added, or their edited copy of a built-in (same id). Stored in IndexedDB and the
 * spreadsheet backup; deleting the record restores the built-in.
 */
export interface CustomMove {
  id: string
  kind: CustomKind
  name: string
  group?: MuscleGroup // lifts
  weeks?: number[] // lifts: weeks it's on the program
  perSide?: boolean
  timed?: boolean
  weighted?: boolean
  cues: string[]
  mistakes: string[]
  demo?: string
  videoUrl?: string
  notes?: string
}

const ALL_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8]

function toExercise(c: CustomMove, base?: Exercise): Exercise {
  return {
    id: c.id, name: c.name, group: c.group ?? base?.group ?? 'chest', unilateral: c.perSide, weeks: c.weeks?.length ? c.weeks : base?.weeks ?? ALL_WEEKS,
    cues: c.cues, mistakes: c.mistakes, demo: c.demo ?? base?.demo, videoUrl: c.videoUrl, notes: c.notes, origin: base ? 'edited' : 'custom',
  }
}

function toMove(c: CustomMove, base?: Move): Move {
  return {
    id: c.id, name: c.name, kind: c.kind as MoveKind, timed: c.timed, weighted: c.weighted, perSide: c.perSide,
    cues: c.cues, mistakes: c.mistakes, demo: c.demo ?? base?.demo, videoUrl: c.videoUrl, notes: c.notes, origin: base ? 'edited' : 'custom',
  }
}

/** Editable snapshot of a catalog entry, for the editor. */
export function toCustom(x: Exercise | Move): CustomMove {
  const lift = 'group' in x
  return {
    id: x.id, kind: lift ? 'lift' : x.kind, name: x.name, group: lift ? x.group : undefined, weeks: lift ? x.weeks : undefined,
    perSide: lift ? x.unilateral : x.perSide, timed: lift ? undefined : x.timed, weighted: lift ? undefined : x.weighted,
    cues: x.cues, mistakes: x.mistakes, demo: x.demo, videoUrl: x.videoUrl, notes: x.notes,
  }
}

export const isBuiltIn = (id: string) => BUILT_IN_EXERCISES.some((e) => e.id === id) || BUILT_IN_MOVES.some((m) => m.id === id)

let version = 0

/** Rebuild the live catalog from the built-ins plus the user's moves and workout plans. Returns a new version number. */
export function applyCustom(moves: CustomMove[], plans: WorkoutPlan[]): number {
  const lifts = moves.filter((m) => m.kind === 'lift')
  const others = moves.filter((m) => m.kind !== 'lift')
  const liftEdits = new Map(lifts.map((m) => [m.id, m]))
  const moveEdits = new Map(others.map((m) => [m.id, m]))

  const exercises = BUILT_IN_EXERCISES.map((e) => (liftEdits.has(e.id) ? toExercise(liftEdits.get(e.id)!, e) : e))
  for (const c of lifts) if (!BUILT_IN_EXERCISES.some((e) => e.id === c.id)) exercises.push(toExercise(c))
  setExercises(exercises)

  const finishers = BUILT_IN_MOVES.map((m) => (moveEdits.has(m.id) ? toMove(moveEdits.get(m.id)!, m) : m))
  for (const c of others) if (!BUILT_IN_MOVES.some((m) => m.id === c.id)) finishers.push(toMove(c))
  setMoves(finishers)

  setPlans(plans)
  setWorkoutNames(Object.fromEntries(plans.map((p) => [p.workoutKey, p.name ?? ''])) as Partial<Record<WorkoutKey, string>>)
  return ++version
}
