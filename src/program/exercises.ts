export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hams' | 'calves'

export const GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hams: 'Hamstrings / Glutes',
  calves: 'Calves',
}

/** Tracker order, matching the paper weight-progression sheet. */
export const GROUP_ORDER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hams', 'calves']

export interface Exercise {
  id: string
  name: string
  group: MuscleGroup
  /** Logged per side (R&L) — weight is per dumbbell. */
  unilateral?: boolean
  /** Weeks the exercise is done; the gray cells on the tracker are the weeks it's skipped. */
  weeks: number[]
  cues: string[]
  mistakes: string[]
  /** free-exercise-db id used for the 2-frame demo; closest available match, not always exact. */
  demo?: string
  /** User-supplied link, e.g. the exact spot in Joel's video. */
  videoUrl?: string
  notes?: string
  origin?: 'edited' | 'custom'
}

const ALL = [1, 2, 3, 4, 5, 6, 7, 8]
const ODD = [1, 3, 5, 7]
const EVEN = [2, 4, 6, 8]

export const BUILT_IN_EXERCISES: Exercise[] = [
  // ── Chest ────────────────────────────────────────────────
  {
    id: 'flat-bench-press', name: 'Flat Bench Press', group: 'chest', weeks: ODD, demo: 'Dumbbell_Bench_Press',
    cues: ['Feet flat, shoulder blades pinched and pressed into the bench', 'Lower until elbows are just below the bench, ~45° from your torso', 'Press up and slightly in; stop just short of the dumbbells touching'],
    mistakes: ['Flaring elbows to 90° (shoulder strain)', 'Bouncing the weights off your chest'],
  },
  {
    id: 'flat-bench-fly', name: 'Flat Bench Fly', group: 'chest', weeks: EVEN, demo: 'Dumbbell_Flyes',
    cues: ['Palms facing, soft bend in elbows that stays fixed', 'Open wide in an arc until you feel a chest stretch', 'Hug a big tree to bring the weights back together'],
    mistakes: ['Turning it into a press by bending the elbows more', 'Going so deep the shoulders roll forward'],
  },
  {
    id: 'flat-bench-rotating-press', name: 'Flat Bench Rotating Press', group: 'chest', weeks: EVEN, demo: 'Dumbbell_Bench_Press',
    cues: ['Start at the chest with palms facing each other', 'Rotate palms to face your feet as you press up', 'Reverse the rotation on the way down'],
    mistakes: ['Rushing the rotation instead of making it smooth', 'Losing the shoulder-blade squeeze at the top'],
  },
  {
    id: 'flat-bench-neutral-press', name: 'Flat Bench Neutral Press', group: 'chest', weeks: ODD, demo: 'Dumbbell_Bench_Press_with_Neutral_Grip',
    cues: ['Palms facing each other the whole rep, dumbbells close', 'Elbows track close to your ribs', 'Squeeze the inner chest and triceps at the top'],
    mistakes: ['Letting the dumbbells drift apart', 'Arching the low back off the bench'],
  },
  {
    id: 'incline-bench-press', name: 'Incline Bench Press', group: 'chest', weeks: ODD, demo: 'Incline_Dumbbell_Press',
    cues: ['Bench at ~30–45°', 'Lower to upper-chest level with elbows ~45°', 'Press straight up over the shoulders'],
    mistakes: ['Pressing toward your face instead of over your shoulders', 'Shrugging the shoulders up to the ears'],
  },
  {
    id: 'incline-bench-fly', name: 'Incline Bench Fly', group: 'chest', weeks: ODD, demo: 'Incline_Dumbbell_Flyes',
    cues: ['Same arc as the flat fly, on an incline', 'Fixed soft elbows, open until a stretch in the upper chest', 'Bring together over the upper chest'],
    mistakes: ['Going too heavy and bending into a press', 'Dropping the weights below shoulder height'],
  },
  {
    id: 'incline-bench-rotating-press', name: 'Incline Bench Rotating Press', group: 'chest', weeks: EVEN, demo: 'Incline_Dumbbell_Press',
    cues: ['Start neutral (palms in) at the upper chest', 'Rotate to palms forward as you press', 'Control the rotation back down'],
    mistakes: ['Letting elbows flare wide at the bottom', 'Clanking the dumbbells at the top'],
  },
  {
    id: 'incline-bench-neutral-press', name: 'Incline Bench Neutral Press', group: 'chest', weeks: EVEN, demo: 'Incline_Dumbbell_Bench_With_Palms_Facing_In',
    cues: ['Palms facing, dumbbells close together', 'Elbows tucked near your sides', 'Drive through the upper chest'],
    mistakes: ['Bench too steep (turns into a shoulder press)', 'Half reps'],
  },
  // ── Back ─────────────────────────────────────────────────
  {
    id: 'bent-over-row', name: 'Bent Over Row', group: 'back', weeks: ALL, demo: 'Bent_Over_Two-Dumbbell_Row',
    cues: ['Hinge at the hips, flat back, chest ~45° or lower', 'Pull elbows back toward your hips', 'Squeeze shoulder blades, lower under control'],
    mistakes: ['Rounding the lower back', 'Standing up taller each rep to use momentum'],
  },
  {
    id: 'flat-bench-single-row', name: 'Flat Bench Single Row (R&L)', group: 'back', unilateral: true, weeks: ODD, demo: 'One-Arm_Dumbbell_Row',
    cues: ['Hand and knee on the bench, back flat like a table', 'Row the dumbbell to your hip pocket', 'Full stretch at the bottom without twisting'],
    mistakes: ['Rotating the torso to heave the weight', 'Pulling with the biceps instead of the elbow'],
  },
  {
    id: 'incline-supinated-single-row', name: 'Incline Bench Supinated Single Row (R&L)', group: 'back', unilateral: true, weeks: EVEN, demo: 'Dumbbell_Incline_Row',
    cues: ['Chest supported on the incline bench', 'Palm facing forward (supinated)', 'Drive the elbow back and close to the body'],
    mistakes: ['Lifting the chest off the pad', 'Short-changing the stretch at the bottom'],
  },
  {
    id: 'reverse-fly', name: 'Reverse Fly (seated or standing)', group: 'back', weeks: ODD, demo: 'Seated_Bent-Over_Rear_Delt_Raise',
    cues: ['Hinge forward, flat back, palms facing', 'Soft elbows, open arms out to the sides', 'Squeeze the upper back at shoulder height'],
    mistakes: ['Going too heavy and swinging', 'Shrugging with the traps'],
  },
  {
    id: 'wide-raise', name: 'Wide Raise (seated or standing)', group: 'back', weeks: EVEN, demo: 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench',
    cues: ['Hinged position, palms facing back', 'Raise arms wide, elbows slightly bent', 'Pause and squeeze the shoulder blades together'],
    mistakes: ['Using the lower back to lift', 'Dropping the weights quickly'],
  },
  {
    id: 'flat-bench-pullover', name: 'Flat Bench Pullover', group: 'back', weeks: ALL, demo: 'Bent-Arm_Dumbbell_Pullover',
    cues: ['Hold one dumbbell with both hands over the chest', 'Lower behind your head with slightly bent elbows', 'Pull back over the chest using lats'],
    mistakes: ['Bending the elbows so it becomes a triceps extension', 'Flaring the ribs and arching hard'],
  },
  // ── Shoulders ────────────────────────────────────────────
  {
    id: 'seated-overhead-press', name: 'Seated Overhead Press', group: 'shoulders', weeks: ALL, demo: 'Seated_Dumbbell_Press',
    cues: ['Back against the pad, core braced', 'Dumbbells at ear level, elbows slightly forward', 'Press up until arms are straight but not locked'],
    mistakes: ['Arching the low back', 'Bringing weights below ear level with a bounce'],
  },
  {
    id: 'seated-arm-opener', name: 'Seated Arm Opener', group: 'shoulders', weeks: ALL, demo: 'Side_Laterals_to_Front_Raise',
    cues: ['Raise arms in front to shoulder height', 'Open them out to the sides, staying at shoulder height', 'Return to the front, then lower'],
    mistakes: ['Letting arms drop below shoulder height during the open', 'Using momentum from the torso'],
  },
  {
    id: 'seated-lateral-raise', name: 'Seated Lateral Raise', group: 'shoulders', weeks: ALL, demo: 'Seated_Side_Lateral_Raise',
    cues: ['Slight bend in elbows, lead with the elbows', 'Raise to shoulder height, pinkies slightly up', 'Lower slowly — 2–3 seconds'],
    mistakes: ['Raising above shoulder height with a shrug', 'Swinging the weights up'],
  },
  {
    id: 'standing-high-row', name: 'Standing High Row', group: 'shoulders', weeks: ALL, demo: 'Bent_Over_Two-Dumbbell_Row',
    cues: ['Slight hip hinge, palms facing back', 'Row with elbows high and wide (to shoulder level)', 'Squeeze rear delts at the top'],
    mistakes: ['Elbows dropping toward the ribs (turns into a lat row)', 'Rounding the upper back'],
  },
  {
    id: 'standing-upright-row', name: 'Standing Upright Row', group: 'shoulders', weeks: ALL, demo: 'Standing_Dumbbell_Upright_Row',
    cues: ['Dumbbells in front of thighs, palms in', 'Lead with elbows up to about chest height', 'Keep the weights close to your body'],
    mistakes: ['Pulling too high (shoulder impingement)', 'Leaning back to finish the rep'],
  },
  {
    id: 'seated-front-raise', name: 'Seated Front Raise', group: 'shoulders', weeks: ALL, demo: 'Front_Dumbbell_Raise',
    cues: ['Arms nearly straight, palms down', 'Raise to shoulder height in front', 'Lower with control'],
    mistakes: ['Leaning back to swing the weight', 'Going above eye level'],
  },
  {
    id: 'seated-reverse-raise', name: 'Seated Reverse Raise', group: 'shoulders', weeks: ALL, demo: 'Seated_Bent-Over_Rear_Delt_Raise',
    cues: ['Sit at the end of the bench, chest toward thighs', 'Raise arms out to the sides', 'Squeeze the rear delts, pause, lower slowly'],
    mistakes: ['Sitting up as you lift', 'Using too much weight'],
  },
  {
    id: 'seated-trap-rotation', name: 'Seated Trap Rotation', group: 'shoulders', weeks: [1, 3, 5, 6, 7, 8], demo: 'Cuban_Press',
    cues: ['Elbows at shoulder height, bent 90°', 'Rotate forearms up until vertical, keeping elbows still', 'Rotate down slowly'],
    mistakes: ['Dropping the elbows', 'Going heavy — this is a small rotator-cuff move'],
  },
  {
    id: 'standing-trap-opener', name: 'Standing Trap Opener', group: 'shoulders', weeks: [2, 4, 5, 7], demo: 'Reverse_Flyes_With_External_Rotation',
    cues: ['Elbows bent at 90°, upper arms by your sides', 'Rotate the forearms outward, opening the chest', 'Squeeze between the shoulder blades'],
    mistakes: ['Letting the elbows leave your sides', 'Arching the low back'],
  },
  // ── Biceps ───────────────────────────────────────────────
  {
    id: 'supine-curl', name: 'Supine Curl (seated or standing)', group: 'biceps', weeks: ALL, demo: 'Dumbbell_Bicep_Curl',
    cues: ['Palms up, elbows pinned to your sides', 'Curl to the shoulders, squeeze', 'Lower fully to straight arms'],
    mistakes: ['Swinging the hips', 'Elbows drifting forward'],
  },
  {
    id: 'hammer-curl', name: 'Hammer Curl (seated or standing)', group: 'biceps', weeks: ALL, demo: 'Hammer_Curls',
    cues: ['Palms facing each other the whole rep', 'Elbows stay at your sides', 'Control the lowering phase'],
    mistakes: ['Rotating the wrists', 'Half reps at the bottom'],
  },
  {
    id: 'wide-curl', name: 'Wide Curl (seated or standing)', group: 'biceps', weeks: ALL, demo: 'Standing_Inner-Biceps_Curl',
    cues: ['Palms up, dumbbells angled out wider than the shoulders', 'Curl in that wide path', 'Squeeze at the top'],
    mistakes: ['Letting the dumbbells drift inward', 'Using the shoulders to lift'],
  },
  {
    id: 'seated-iso-curl', name: 'Seated Iso Curl (R&L)', group: 'biceps', unilateral: true, weeks: ODD, demo: 'Seated_Dumbbell_Curl',
    cues: ['Hold one arm at 90° (isometric) while the other curls', 'Switch sides after the set', 'Keep the hold arm from sagging'],
    mistakes: ['Letting the hold arm drop', 'Leaning to the working side'],
  },
  {
    id: 'standing-rotating-curl', name: 'Standing Rotating Curl', group: 'biceps', weeks: EVEN, demo: 'Dumbbell_Alternate_Bicep_Curl',
    cues: ['Start palms facing in at your sides', 'Rotate to palms up as you curl', 'Reverse the rotation on the way down'],
    mistakes: ['Rotating too late (only at the top)', 'Swinging'],
  },
  // ── Triceps ──────────────────────────────────────────────
  {
    id: 'skull-crusher', name: 'Skull Crusher', group: 'triceps', weeks: ALL, demo: 'Lying_Dumbbell_Tricep_Extension',
    cues: ['Lie flat, arms straight over the shoulders, palms in', 'Bend only at the elbows, lowering beside your head', 'Extend back up, squeeze the triceps'],
    mistakes: ['Elbows flaring out', 'Moving the upper arms'],
  },
  {
    id: 'iso-crusher', name: 'Iso-Crusher (R&L) (flat or incline)', group: 'triceps', unilateral: true, weeks: ALL, demo: 'Lying_Dumbbell_Tricep_Extension',
    cues: ['One arm holds straight up while the other does a skull crusher', 'Switch sides', 'Upper arm stays vertical'],
    mistakes: ['Letting the hold arm drift', 'Rushing the lowering phase'],
  },
  {
    id: 'triceps-press', name: 'Triceps Press', group: 'triceps', weeks: ALL, demo: 'Seated_Triceps_Press',
    cues: ['One dumbbell with both hands overhead', 'Lower behind the head, elbows pointing up', 'Extend fully'],
    mistakes: ['Elbows flaring wide', 'Arching the low back'],
  },
  {
    id: 'kickback', name: 'Kickback (seated or standing)', group: 'triceps', weeks: ALL, demo: 'Tricep_Dumbbell_Kickback',
    cues: ['Hinge forward, upper arms parallel to the floor', 'Extend the forearms back until straight', 'Pause, then return to 90°'],
    mistakes: ['Upper arms dropping', 'Swinging the weight'],
  },
  // ── Quads ────────────────────────────────────────────────
  {
    id: 'hanging-squat', name: 'Hanging Squat', group: 'quads', weeks: ALL, demo: 'Dumbbell_Squat',
    cues: ['Dumbbells hanging at your sides, feet shoulder-width', 'Sit hips back and down to at least parallel', 'Drive through the heels, chest up'],
    mistakes: ['Knees caving in', 'Heels lifting off the floor'],
  },
  {
    id: 'front-loaded-narrow-squat', name: 'Front Loaded Narrow Squat', group: 'quads', weeks: ALL, demo: 'Goblet_Squat',
    cues: ['Hold the dumbbell(s) at your chest, feet narrow', 'Squat down keeping the torso upright', 'Knees track over toes'],
    mistakes: ['Leaning forward and dropping the chest', 'Cutting depth'],
  },
  {
    id: 'benched-step-up', name: 'Benched Step Up (R&L)', group: 'quads', unilateral: true, weeks: [2, 4, 6, 7, 8], demo: 'Dumbbell_Step_Ups',
    cues: ['Whole foot on the bench', 'Drive through the top heel to stand up', 'Lower slowly — don\'t push off the bottom foot'],
    mistakes: ['Bouncing off the back leg', 'Knee caving inward'],
  },
  {
    id: 'static-lunge', name: 'Static Lunge (R&L)', group: 'quads', unilateral: true, weeks: ALL, demo: 'Split_Squat_with_Dumbbells',
    cues: ['Split stance, feet hip-width apart (not on a tightrope)', 'Drop the back knee straight down', 'Front knee over the ankle'],
    mistakes: ['Front heel lifting', 'Torso leaning way forward'],
  },
  {
    id: 'side-lunge', name: 'Side Lunge (R&L)', group: 'quads', unilateral: true, weeks: ODD, demo: 'Barbell_Side_Split_Squat',
    cues: ['Wide stance, toes forward', 'Sit into one hip, other leg straight', 'Push back to center'],
    mistakes: ['Knee collapsing past the toes', 'Rounding the back'],
  },
  {
    id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat (R&L)', group: 'quads', unilateral: true, weeks: [5, 6, 8], demo: 'One_Leg_Barbell_Squat',
    cues: ['Rear foot laces-down on the bench', 'Front foot far enough forward to keep the knee over the ankle', 'Lower until the front thigh is parallel'],
    mistakes: ['Standing too close to the bench', 'Pushing off the rear foot'],
  },
  // ── Hamstrings / Glutes ──────────────────────────────────
  {
    id: 'stiff-legged-deadlift', name: 'Stiff-Legged Deadlift', group: 'hams', weeks: ALL, demo: 'Stiff-Legged_Dumbbell_Deadlift',
    cues: ['Soft knees, hinge at the hips', 'Weights slide down the front of the legs', 'Stop when the hamstrings are stretched; squeeze glutes to stand'],
    mistakes: ['Rounding the back to reach lower', 'Bending the knees into a squat'],
  },
  {
    id: 'wide-leg-deadlift', name: 'Wide Leg Deadlift', group: 'hams', weeks: ALL, demo: 'Sumo_Deadlift',
    cues: ['Wide stance, toes slightly out', 'Hinge with a flat back, weights between the legs', 'Drive hips forward to stand'],
    mistakes: ['Knees caving', 'Hyperextending at the top'],
  },
  {
    id: 'single-leg-deadlift', name: 'Single-Leg Deadlift (R&L)', group: 'hams', unilateral: true, weeks: ALL, demo: 'Kettlebell_One-Legged_Deadlift',
    cues: ['Stand on one leg, soft knee', 'Hinge forward as the free leg extends back', 'Hips stay square to the floor'],
    mistakes: ['Opening the hip of the raised leg', 'Rounding the back'],
  },
  {
    id: 'sumo-squat', name: 'Sumo Squat', group: 'hams', weeks: ALL, demo: 'Plie_Dumbbell_Squat',
    cues: ['Very wide stance, toes out ~45°', 'Hold one dumbbell between the legs', 'Sit straight down, knees over toes'],
    mistakes: ['Knees falling inward', 'Leaning forward'],
  },
  {
    id: 'alt-stepping-front-lunge', name: 'Alt Stepping Front Lunge', group: 'hams', weeks: ALL, demo: 'Dumbbell_Lunges',
    cues: ['Step forward into a lunge, back knee toward the floor', 'Push through the front heel to return', 'Alternate legs'],
    mistakes: ['Short steps that load the knee', 'Slamming the back knee down'],
  },
  {
    id: 'bridge-feet-on-bench', name: 'Bridge (feet on bench)', group: 'hams', weeks: [1, 2, 3, 4, 6, 7, 8], demo: 'Butt_Lift_Bridge',
    cues: ['Lie on the floor, heels on the bench, weight on hips', 'Drive hips up until knees-hips-shoulders line up', 'Squeeze glutes at the top'],
    mistakes: ['Pushing through the toes', 'Arching the low back at the top'],
  },
  {
    id: 'benched-hip-thruster', name: 'Benched Hip Thruster (back on bench)', group: 'hams', weeks: ALL, demo: 'Barbell_Hip_Thrust',
    cues: ['Upper back on the bench, weight on the hips', 'Drive hips up to a tabletop position', 'Chin tucked, ribs down'],
    mistakes: ['Feet too far away (all hamstrings)', 'Hyperextending the back'],
  },
  {
    id: 'frog-bridge', name: 'Frog Bridge', group: 'hams', weeks: [1, 2, 3, 4, 5, 7, 8], demo: 'Butt_Lift_Bridge',
    cues: ['Soles of the feet together, knees out', 'Weight on the hips, drive up', 'Squeeze glutes hard at the top'],
    mistakes: ['Letting the knees close', 'Going too fast'],
  },
  // ── Calves ───────────────────────────────────────────────
  {
    id: 'calf-raise', name: 'Calf Raise', group: 'calves', weeks: ALL, demo: 'Standing_Dumbbell_Calf_Raise',
    cues: ['Toes forward, full stretch at the bottom', 'Rise as high as possible on the balls of the feet', 'Pause at the top'],
    mistakes: ['Bouncing', 'Bending the knees'],
  },
  {
    id: 'pigeon-calf-raise', name: 'Pigeon Calf Raise', group: 'calves', weeks: ALL, demo: 'Standing_Dumbbell_Calf_Raise',
    cues: ['Toes turned in, heels out', 'Full range of motion', 'Slow on the way down'],
    mistakes: ['Losing the toe angle as you tire', 'Partial reps'],
  },
  {
    id: 'duck-calf-raise', name: 'Duck Calf Raise', group: 'calves', weeks: ALL, demo: 'Standing_Dumbbell_Calf_Raise',
    cues: ['Toes turned out, heels in', 'Full range of motion', 'Pause at the top'],
    mistakes: ['Rolling onto the outer edges of the feet', 'Rushing'],
  },
  {
    id: 'single-leg-calf-raise', name: 'Single-Leg Calf Raise (R&L)', group: 'calves', unilateral: true, weeks: [1, 2, 3, 4], demo: 'Calf_Raise_On_A_Dumbbell',
    cues: ['Stand on one foot, hold something for balance', 'All the way up, all the way down', 'Switch legs'],
    mistakes: ['Using the balance hand to help push', 'Bent knee'],
  },
]

/** Built-ins merged with the user's edits and own moves (see program/custom.ts). */
export let EXERCISES: Exercise[] = BUILT_IN_EXERCISES
export let EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))

export function setExercises(list: Exercise[]) {
  EXERCISES = list
  EXERCISE_BY_ID = Object.fromEntries(list.map((e) => [e.id, e]))
}

export const isActive = (ex: Exercise, week: number) => ex.weeks.includes(week)

export const demoFrames = (ex: Pick<Exercise, 'demo'>) =>
  ex.demo ? [`${import.meta.env.BASE_URL}exercises/${ex.demo}/0.jpg`, `${import.meta.env.BASE_URL}exercises/${ex.demo}/1.jpg`] : []
