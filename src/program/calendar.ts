import type { MuscleGroup } from './exercises'

export const WEEKS = 8
export const DAYS_PER_WEEK = 5

export type WorkoutKey =
  | 'chest-biceps'
  | 'quads-calves'
  | 'back-triceps'
  | 'hams-glutes'
  | 'shoulders'
  | 'legs'
  | 'chest-back'
  | 'shoulders-2'
  | 'more-legs'
  | 'arms'

export interface WorkoutDef {
  key: WorkoutKey
  name: string
  short: string // fits a calendar cell
  groups: MuscleGroup[]
}

export const WORKOUTS: Record<WorkoutKey, WorkoutDef> = {
  'chest-biceps': { key: 'chest-biceps', name: 'Chest & Biceps', short: 'Chest Biceps', groups: ['chest', 'biceps'] },
  'quads-calves': { key: 'quads-calves', name: 'Quads & Calves', short: 'Quads Calves', groups: ['quads', 'calves'] },
  'back-triceps': { key: 'back-triceps', name: 'Back & Triceps', short: 'Back Triceps', groups: ['back', 'triceps'] },
  'hams-glutes': { key: 'hams-glutes', name: 'Hamstrings & Glutes', short: 'Hams Glutes', groups: ['hams'] },
  shoulders: { key: 'shoulders', name: 'Shoulders', short: 'Shoul­ders', groups: ['shoulders'] },
  // Weeks 5–8. The tracker doesn't say how leg moves split across Legs / More Legs,
  // so these are defaults; the user can edit a workout's exercises in the app.
  legs: { key: 'legs', name: 'Legs', short: 'Legs', groups: ['quads', 'calves'] },
  'chest-back': { key: 'chest-back', name: 'Chest & Back', short: 'Chest Back', groups: ['chest', 'back'] },
  'shoulders-2': { key: 'shoulders-2', name: 'Shoulders', short: 'Shoul­ders', groups: ['shoulders'] },
  'more-legs': { key: 'more-legs', name: 'More Legs', short: 'More Legs', groups: ['hams'] },
  arms: { key: 'arms', name: 'Arms', short: 'Arms', groups: ['biceps', 'triceps'] },
}

const BUILT_IN_NAMES = Object.fromEntries(Object.values(WORKOUTS).map((w) => [w.key, { name: w.name, short: w.short }]))

/** Apply the user's renamed workouts (empty = the program's name). */
export function setWorkoutNames(names: Partial<Record<WorkoutKey, string>>) {
  for (const w of Object.values(WORKOUTS)) {
    const custom = names[w.key]?.trim()
    w.name = custom || BUILT_IN_NAMES[w.key].name
    w.short = custom || BUILT_IN_NAMES[w.key].short
  }
}

const PHASE_1: WorkoutKey[] = ['chest-biceps', 'quads-calves', 'back-triceps', 'hams-glutes', 'shoulders']
const PHASE_2: WorkoutKey[] = ['legs', 'chest-back', 'shoulders-2', 'more-legs', 'arms']

export const phaseOf = (week: number): 1 | 2 => (week <= 4 ? 1 : 2)

export function workoutFor(week: number, day: number): WorkoutDef {
  const keys = phaseOf(week) === 1 ? PHASE_1 : PHASE_2
  return WORKOUTS[keys[day - 1]]
}

/** Odd weeks put HIIT on days 2 and 4; even weeks on days 1, 3 and 5. */
export function isHiit(week: number, day: number): boolean {
  return week % 2 === 1 ? day % 2 === 0 : day % 2 === 1
}

export interface Slot {
  week: number
  day: number
}

export function allSlots(): Slot[] {
  const out: Slot[] = []
  for (let week = 1; week <= WEEKS; week++)
    for (let day = 1; day <= DAYS_PER_WEEK; day++) out.push({ week, day })
  return out
}

export const slotId = (s: Slot) => `w${s.week}d${s.day}`
export const slotIndex = (s: Slot) => (s.week - 1) * DAYS_PER_WEEK + (s.day - 1)
