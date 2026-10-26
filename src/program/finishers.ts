import { isHiit, slotIndex, workoutFor, type Slot, type WorkoutKey } from './calendar'
import { EXERCISE_BY_ID } from './exercises'

/** What follows the lifting: a HIIT block or a burnout set, then two core moves every day. */
export type Finisher = 'hiit' | 'burnout'
export type ExtraSlot = 'burnout' | 'core1' | 'core2'

export type MoveKind = 'burnout' | 'core' | 'hiit'

export interface Move {
  id: string
  name: string
  kind: MoveKind
  /** Logged in seconds instead of reps. */
  timed?: boolean
  /** Can be done holding dumbbells; the weight field is optional. */
  weighted?: boolean
  perSide?: boolean
  cues: string[]
  mistakes: string[]
  /** free-exercise-db id for the 2-frame demo (closest match). */
  demo?: string
  videoUrl?: string
  notes?: string
  origin?: 'edited' | 'custom'
}

const BURNOUTS: Move[] = [
  {
    id: 'bo-push-up', name: 'Push-Up Burnout', kind: 'burnout', demo: 'Pushups',
    cues: ['Hands under shoulders, body in one straight line', 'Chest to a fist from the floor, then press away', 'Drop to your knees when form breaks, and keep going'],
    mistakes: ['Hips sagging or piking', 'Half reps at the end'],
  },
  {
    id: 'bo-chair-dip', name: 'Chair Dip Burnout', kind: 'burnout', demo: 'Bench_Dips',
    cues: ['Hands on the bench edge, fingers forward', 'Lower until elbows hit 90°, elbows pointing back', 'Press through the heels of your hands'],
    mistakes: ['Elbows flaring out', 'Shrugging shoulders up to the ears'],
  },
  {
    id: 'bo-squat', name: 'Squat Burnout', kind: 'burnout', weighted: true, demo: 'Bodyweight_Squat',
    cues: ['Feet shoulder-width, chest tall', 'Sit back and down to at least parallel', 'Drive through the whole foot'],
    mistakes: ['Knees caving in', 'Heels lifting'],
  },
  {
    id: 'bo-lunge', name: 'Alternating Lunge Burnout', kind: 'burnout', weighted: true, demo: 'Dumbbell_Lunges',
    cues: ['Long step, both knees to 90°', 'Front knee tracks over the toes', 'Push back to start and switch legs'],
    mistakes: ['Back knee slamming the floor', 'Leaning the torso forward'],
  },
  {
    id: 'bo-glute-bridge', name: 'Glute Bridge Burnout', kind: 'burnout', weighted: true, demo: 'Butt_Lift_Bridge',
    cues: ['Feet flat, heels close to the glutes', 'Drive hips up and squeeze hard at the top', 'Lower with control, tap and go'],
    mistakes: ['Arching the low back instead of using the glutes', 'Pushing through the toes'],
  },
  {
    id: 'bo-lateral-raise', name: 'Lateral Raise Burnout', kind: 'burnout', weighted: true, demo: 'Side_Lateral_Raise',
    cues: ['Light weights, soft elbows', 'Raise out to shoulder height, pinkies slightly up', 'Keep the tension on; no resting at the bottom'],
    mistakes: ['Swinging with the hips', 'Shrugging the traps'],
  },
  {
    id: 'bo-hammer-curl', name: 'Hammer Curl Burnout', kind: 'burnout', weighted: true, demo: 'Hammer_Curls',
    cues: ['Palms face each other the whole time', 'Elbows pinned to your sides', 'Squeeze at the top, slow on the way down'],
    mistakes: ['Swinging the body', 'Elbows drifting forward'],
  },
  {
    id: 'bo-calf-raise', name: 'Calf Raise Burnout', kind: 'burnout', weighted: true, demo: 'Standing_Dumbbell_Calf_Raise',
    cues: ['Full stretch at the bottom', 'All the way up onto the balls of the feet', 'Keep going until you can’t get full height'],
    mistakes: ['Bouncing', 'Bending the knees'],
  },
]

const CORE: Move[] = [
  {
    id: 'core-crunch', name: 'Crunch', kind: 'core', demo: 'Crunches',
    cues: ['Low back pressed into the floor', 'Curl the ribs toward the hips', 'Exhale on the way up'],
    mistakes: ['Pulling on the neck', 'Using momentum'],
  },
  {
    id: 'core-bicycle', name: 'Bicycle Crunch', kind: 'core', demo: 'Cross-Body_Crunch',
    cues: ['Elbow toward the opposite knee', 'Fully extend the other leg', 'Rotate through the ribs, not the elbow'],
    mistakes: ['Racing through reps', 'Yanking the head forward'],
  },
  {
    id: 'core-reverse-crunch', name: 'Reverse Crunch', kind: 'core', demo: 'Reverse_Crunch',
    cues: ['Knees bent at 90°', 'Curl the hips off the floor toward the ribs', 'Lower slowly'],
    mistakes: ['Swinging the legs', 'Arching the back on the way down'],
  },
  {
    id: 'core-russian-twist', name: 'Russian Twist', kind: 'core', weighted: true, demo: 'Russian_Twist',
    cues: ['Lean back with a long spine', 'Rotate the shoulders, not just the arms', 'Feet down to make it easier, up to make it harder'],
    mistakes: ['Rounding the back', 'Only moving the hands'],
  },
  {
    id: 'core-plank', name: 'Plank', kind: 'core', timed: true, demo: 'Plank',
    cues: ['Elbows under shoulders', 'Squeeze glutes and brace the abs', 'Straight line from head to heels'],
    mistakes: ['Hips sagging', 'Holding your breath'],
  },
  {
    id: 'core-side-plank', name: 'Side Plank (R&L)', kind: 'core', timed: true, perSide: true, demo: 'Side_Bridge',
    cues: ['Elbow under shoulder, feet stacked', 'Lift the hips into a straight line', 'Log the time per side'],
    mistakes: ['Hips dropping', 'Rolling the chest toward the floor'],
  },
  {
    id: 'core-flutter-kicks', name: 'Flutter Kicks', kind: 'core', demo: 'Flutter_Kicks',
    cues: ['Hands under the hips, low back down', 'Legs straight, small fast kicks', 'Lower legs = harder'],
    mistakes: ['Low back lifting off the floor', 'Kicks too big'],
  },
  {
    id: 'core-dead-bug', name: 'Dead Bug', kind: 'core', demo: 'Dead_Bug',
    cues: ['Arms up, knees over hips', 'Extend the opposite arm and leg slowly', 'Keep the low back glued down'],
    mistakes: ['Moving too fast', 'Back arching as the leg lowers'],
  },
  {
    id: 'core-mountain-climber', name: 'Mountain Climbers', kind: 'core', demo: 'Mountain_Climbers',
    cues: ['Hands under shoulders, hips level', 'Drive knees toward the chest', 'Quick feet, quiet upper body'],
    mistakes: ['Hips popping up', 'Bouncing the shoulders'],
  },
  {
    id: 'core-leg-raise', name: 'Leg Raise', kind: 'core', demo: 'Flat_Bench_Lying_Leg_Raise',
    cues: ['Legs straight, low back pressed down', 'Raise to vertical', 'Lower slowly without touching the floor'],
    mistakes: ['Arching the low back', 'Dropping the legs'],
  },
  {
    id: 'core-v-up', name: 'V-Up', kind: 'core', demo: 'Jackknife_Sit-Up',
    cues: ['Start long on the floor', 'Lift arms and legs together to meet over the hips', 'Lower with control'],
    mistakes: ['Bending the knees to cheat', 'Crashing down'],
  },
  {
    id: 'core-heel-touch', name: 'Heel Touches', kind: 'core', demo: 'Alternate_Heel_Touchers',
    cues: ['Shoulders slightly off the floor', 'Side-bend to tap each heel', 'Keep the neck relaxed'],
    mistakes: ['Lowering the shoulders between reps', 'Pulling with the neck'],
  },
]

// Starter HIIT moves; LIIFT MORE's exact HIIT blocks change by workout, so add Joel's as you watch.
const HIIT: Move[] = [
  {
    id: 'hiit-jumping-jack', name: 'Jumping Jacks', kind: 'hiit', demo: 'Star_Jump',
    cues: ['Land softly on the balls of your feet', 'Arms all the way overhead', 'Keep a steady, quick rhythm'],
    mistakes: ['Landing flat-footed', 'Half arm swings'],
  },
  {
    id: 'hiit-squat-jump', name: 'Squat Jumps', kind: 'hiit', demo: 'Freehand_Jump_Squat',
    cues: ['Squat to parallel, then explode up', 'Land soft and sink straight into the next rep', 'Swing the arms for height'],
    mistakes: ['Knees caving on landing', 'Stiff-legged landings'],
  },
  {
    id: 'hiit-tuck-jump', name: 'Tuck Jumps', kind: 'hiit', demo: 'Knee_Tuck_Jump',
    cues: ['Drive both knees toward the chest', 'Land softly, hips back', 'Reset quickly'],
    mistakes: ['Rounding forward to meet the knees', 'Loud landings'],
  },
  {
    id: 'hiit-split-jump', name: 'Split Lunge Jumps', kind: 'hiit', demo: 'Split_Jump',
    cues: ['Start in a lunge', 'Jump and switch legs in the air', 'Land in a lunge with control'],
    mistakes: ['Front knee collapsing inward', 'Short, choppy stance'],
  },
  {
    id: 'hiit-mountain-climber', name: 'Mountain Climbers', kind: 'hiit', demo: 'Mountain_Climbers',
    cues: ['Hands under shoulders, hips level', 'Drive knees fast toward the chest'],
    mistakes: ['Hips piking up', 'Bouncing the shoulders'],
  },
  {
    id: 'hiit-butt-kick', name: 'Butt Kicks', kind: 'hiit', demo: 'Single_Leg_Butt_Kick',
    cues: ['Run in place, heels to glutes', 'Stay light on your feet', 'Pump the arms'],
    mistakes: ['Leaning forward', 'Heavy feet'],
  },
  {
    id: 'hiit-high-knees', name: 'High Knees', kind: 'hiit',
    cues: ['Knees to hip height', 'Stay on the balls of the feet', 'Fast arms'],
    mistakes: ['Leaning back', 'Knees only half way up'],
  },
  {
    id: 'hiit-burpee', name: 'Burpees', kind: 'hiit',
    cues: ['Hands down, jump feet back to a plank', 'Jump feet in, then jump up with arms overhead', 'Brace the core in the plank'],
    mistakes: ['Hips sagging in the plank', 'Landing hard'],
  },
]

export const BUILT_IN_MOVES: Move[] = [...BURNOUTS, ...CORE, ...HIIT]

/** Built-ins merged with the user's edits and own moves (see program/custom.ts). */
export let MOVES: Move[] = BUILT_IN_MOVES
export let MOVE_BY_ID: Record<string, Move> = Object.fromEntries(MOVES.map((m) => [m.id, m]))

export function setMoves(list: Move[]) {
  MOVES = list
  MOVE_BY_ID = Object.fromEntries(list.map((m) => [m.id, m]))
}

export const movesOf = (kind: MoveKind) => MOVES.filter((m) => m.kind === kind)

/** The user's own program for a workout: its name and which finisher/core moves Joel uses. */
export interface WorkoutPlan {
  workoutKey: WorkoutKey
  name?: string
  burnout?: string
  core?: string[] // [core1, core2]
  hiit?: string[]
  /** Saved exercise orders, one per distinct set of moves (the rotation changes the moves week to week). */
  orders?: string[][]
}

let PLANS: Partial<Record<WorkoutKey, WorkoutPlan>> = {}
export const setPlans = (plans: WorkoutPlan[]) => { PLANS = Object.fromEntries(plans.map((p) => [p.workoutKey, p])) }
export const planFor = (key: WorkoutKey): WorkoutPlan => PLANS[key] ?? { workoutKey: key }

/** A finisher move, or one of the main lifts used as a burnout. Unknown ids (a deleted move) get a placeholder. */
export function moveInfo(id: string): Move {
  if (MOVE_BY_ID[id]) return MOVE_BY_ID[id]
  const ex = EXERCISE_BY_ID[id]
  if (ex) return { id, name: ex.name, kind: 'burnout', weighted: true, perSide: ex.unilateral, cues: ex.cues, mistakes: ex.mistakes, demo: ex.demo, videoUrl: ex.videoUrl, notes: ex.notes }
  return { id, name: 'Deleted move', kind: 'core', cues: [], mistakes: [] }
}

export const DEFAULT_BURNOUT: Record<WorkoutKey, string> = {
  'chest-biceps': 'bo-push-up',
  'quads-calves': 'bo-squat',
  'back-triceps': 'bo-chair-dip',
  'hams-glutes': 'bo-glute-bridge',
  shoulders: 'bo-lateral-raise',
  legs: 'bo-squat',
  'chest-back': 'bo-push-up',
  'shoulders-2': 'bo-lateral-raise',
  'more-legs': 'bo-glute-bridge',
  arms: 'bo-hammer-curl',
}

/** Rotating pairs so the core work changes day to day; any move can be swapped in the logger. */
const CORE_PAIRS: [string, string][] = [
  ['core-crunch', 'core-plank'],
  ['core-bicycle', 'core-leg-raise'],
  ['core-reverse-crunch', 'core-side-plank'],
  ['core-russian-twist', 'core-flutter-kicks'],
  ['core-v-up', 'core-mountain-climber'],
  ['core-dead-bug', 'core-heel-touch'],
]

/** Your saved core pair for this workout, else the rotating default. */
export function defaultCore(s: Slot): [string, string] {
  const [a, b] = CORE_PAIRS[slotIndex(s) % CORE_PAIRS.length]
  const plan = planFor(workoutFor(s.week, s.day).key).core
  return [plan?.[0] || a, plan?.[1] || b]
}

/** The calendar's finisher (LIFT/HIIT days get HIIT, LIFT days a burnout), unless the session overrides it. */
export const finisherFor = (s: Slot, override?: Finisher): Finisher => override ?? (isHiit(s.week, s.day) ? 'hiit' : 'burnout')
