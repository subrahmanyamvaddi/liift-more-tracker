import * as XLSX from 'xlsx'
import type { BodyEntry, ExtraLog, LiiftDB, Override, Run, Session, SetLog, Setting } from '../db/db'
import { workoutFor, WEEKS } from '../program/calendar'
import { EXERCISES, EXERCISE_BY_ID, GROUP_LABELS, isActive } from '../program/exercises'
import { burnoutsOf, moveInfo, type Finisher, type WorkoutPlan } from '../program/finishers'
import type { CustomKind, CustomMove } from '../program/custom'
import type { MuscleGroup } from '../program/exercises'
import { fromLb, type Unit } from './units'

const num = (v: unknown): number | null => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))
const str = (v: unknown): string => (v == null ? '' : String(v))
const bool = (v: unknown): boolean => v === true || v === 'TRUE' || v === 'true' || v === 1
// An emptied list is saved as "none" so it doesn't come back as the defaults.
const NONE = 'none'
const joinList = (l: string[] | undefined) => (l == null ? '' : l.length ? l.join(',') : NONE)
const list = (v: unknown): string[] => str(v).split(',').map((s) => s.trim()).filter(Boolean)

/** Paper-style grid for one run: exercise rows × (week, set) columns, "–" for weeks the move is off. */
function trackerSheet(sets: SetLog[], runId: string | undefined, unit: Unit) {
  const header = ['Group', 'Exercise']
  for (let w = 1; w <= WEEKS; w++) for (let s = 1; s <= 3; s++) header.push(`W${w} S${s}`)
  const byKey = new Map(sets.filter((s) => s.runId === runId).map((s) => [`${s.exerciseId}:${s.week}:${s.setNumber}`, s]))
  const rows: (string | number)[][] = [header]
  for (const ex of EXERCISES) {
    const row: (string | number)[] = [GROUP_LABELS[ex.group], ex.name]
    for (let w = 1; w <= WEEKS; w++)
      for (let s = 1; s <= 3; s++) {
        const log = byKey.get(`${ex.id}:${w}:${s}`)
        if (log?.weightLb != null) row.push(fromLb(log.weightLb, unit))
        else row.push(isActive(ex, w) ? '' : '–')
      }
    rows.push(row)
  }
  return XLSX.utils.aoa_to_sheet(rows)
}

export async function exportWorkbook(db: LiiftDB): Promise<ArrayBuffer> {
  const [runs, settings, sessions, sets, body, overrides, extras, moves, plans] = await Promise.all([
    db.runs.toArray(),
    db.settings.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.body.toArray(),
    db.overrides.toArray(),
    db.extras.toArray(),
    db.moves.toArray(),
    db.plans.toArray(),
  ])
  const unit = (settings.find((s) => s.key === 'unit')?.value as Unit) ?? 'lb'
  const activeRun = settings.find((s) => s.key === 'activeRunId')?.value

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, trackerSheet(sets, activeRun, unit), `Tracker (${unit})`)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      sets
        .sort((a, b) => a.runId.localeCompare(b.runId) || a.week - b.week || a.day - b.day || a.id.localeCompare(b.id))
        .map((s) => ({
          id: s.id, sessionId: s.sessionId, runId: s.runId, week: s.week, day: s.day,
          workout: workoutFor(s.week, s.day).name, date: s.date, exerciseId: s.exerciseId,
          exercise: EXERCISE_BY_ID[s.exerciseId]?.name ?? s.exerciseId, setNumber: s.setNumber,
          weightLb: s.weightLb ?? '', reps: s.reps ?? '',
        })),
    ),
    'Sets',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(sessions.map((s) => ({ ...s, order: s.order?.join(',') ?? '', workout: workoutFor(s.week, s.day).name }))),
    'Sessions',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      extras
        .sort((a, b) => a.runId.localeCompare(b.runId) || a.week - b.week || a.day - b.day || a.slot.localeCompare(b.slot))
        .map((e) => ({
          id: e.id, sessionId: e.sessionId, runId: e.runId, week: e.week, day: e.day, workout: workoutFor(e.week, e.day).name,
          date: e.date, slot: e.slot, moveId: e.moveId, move: moveInfo(e.moveId)?.name ?? e.moveId,
          weightLb: e.weightLb ?? '', reps: e.reps ?? '',
        })),
    ),
    'Burnout & Core',
  )
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(body), 'Body')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(runs.map((r) => ({ ...r, restDays: r.restDays?.join(',') ?? '' }))), 'Runs')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(overrides.map((o) => ({ ...o, added: o.added.join(','), removed: o.removed.join(',') }))),
    'Overrides',
  )
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settings), 'Settings')
  // Your moves: one cue / mistake per line inside the cell, so it stays readable in Excel or Numbers.
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(moves.map((m) => ({
      id: m.id, kind: m.kind, name: m.name, group: m.group ?? '', weeks: m.weeks?.join(',') ?? '',
      perSide: !!m.perSide, timed: !!m.timed, weighted: !!m.weighted, cues: m.cues.join('\n'), mistakes: m.mistakes.join('\n'),
      demo: m.demo ?? '', videoUrl: m.videoUrl ?? '', notes: m.notes ?? '',
    })), { header: ['id', 'kind', 'name', 'group', 'weeks', 'perSide', 'timed', 'weighted', 'cues', 'mistakes', 'demo', 'videoUrl', 'notes'] }),
    'My moves',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(plans.map((p) => ({
      workoutKey: p.workoutKey, name: p.name ?? '', burnout: joinList(burnoutsOf(p)), core: joinList(p.core), hiit: p.hiit?.join(',') ?? '',
      orders: p.orders?.map((o) => o.join(',')).join(';') ?? '',
    })), { header: ['workoutKey', 'name', 'burnout', 'core', 'hiit', 'orders'] }),
    'Workout plans',
  )
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

function rowsOf(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const sheet = wb.Sheets[name]
  return sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }) : []
}

export interface ImportResult {
  runs: number
  sessions: number
  sets: number
  body: number
  extras: number
  moves: number
}

/** Read a workbook made by exportWorkbook. "replace" wipes logged data first (photos are kept). */
export async function importWorkbook(db: LiiftDB, data: ArrayBuffer, mode: 'replace' | 'merge'): Promise<ImportResult> {
  const wb = XLSX.read(data, { type: 'array' })
  if (!wb.Sheets['Sets'] || !wb.Sheets['Runs']) throw new Error('This file is not a LIIFT MORE backup (missing Sets/Runs sheets).')

  const runs: Run[] = rowsOf(wb, 'Runs').map((r) => ({
    id: str(r.id), name: str(r.name), startDate: str(r.startDate), archived: bool(r.archived), createdAt: num(r.createdAt) ?? Date.now(),
    ...(str(r.restDays) ? { restDays: list(r.restDays).map(Number) } : {}),
  }))
  const sessions: Session[] = rowsOf(wb, 'Sessions').map((r) => ({
    id: str(r.id), runId: str(r.runId), week: num(r.week)!, day: num(r.day)!, date: str(r.date),
    completed: bool(r.completed), hiitDone: bool(r.hiitDone), notes: str(r.notes),
    ...(str(r.finisher) ? { finisher: str(r.finisher) as Finisher } : {}),
    ...(str(r.order) ? { order: list(r.order) } : {}),
  }))
  const sets: SetLog[] = rowsOf(wb, 'Sets').map((r) => ({
    id: str(r.id), sessionId: str(r.sessionId), runId: str(r.runId), exerciseId: str(r.exerciseId),
    week: num(r.week)!, day: num(r.day)!, setNumber: num(r.setNumber)!, weightLb: num(r.weightLb), reps: num(r.reps), date: str(r.date),
  }))
  const extras: ExtraLog[] = rowsOf(wb, 'Burnout & Core').map((r) => ({
    id: str(r.id), sessionId: str(r.sessionId), runId: str(r.runId), week: num(r.week)!, day: num(r.day)!,
    slot: str(r.slot), moveId: str(r.moveId), weightLb: num(r.weightLb), reps: num(r.reps), date: str(r.date),
  }))
  const body: BodyEntry[] = rowsOf(wb, 'Body').map((r) => ({
    id: str(r.id), runId: str(r.runId), date: str(r.date), weightLb: num(r.weightLb), chestIn: num(r.chestIn),
    waistIn: num(r.waistIn), hipsIn: num(r.hipsIn), armIn: num(r.armIn), thighIn: num(r.thighIn),
    bodyFatPct: num(r.bodyFatPct), notes: str(r.notes),
  }))
  const overrides: Override[] = rowsOf(wb, 'Overrides').map((r) => ({
    id: str(r.id), runId: str(r.runId), workoutKey: str(r.workoutKey) as Override['workoutKey'], added: list(r.added), removed: list(r.removed),
  }))
  const opt = (v: unknown) => str(v).trim() || undefined
  const moves: CustomMove[] = rowsOf(wb, 'My moves').map((r) => {
    const m: CustomMove = {
      id: str(r.id), kind: str(r.kind) as CustomKind, name: str(r.name),
      cues: str(r.cues).split('\n').filter(Boolean), mistakes: str(r.mistakes).split('\n').filter(Boolean),
    }
    if (opt(r.group)) m.group = str(r.group) as MuscleGroup
    if (opt(r.weeks)) m.weeks = list(r.weeks).map(Number)
    if (bool(r.perSide)) m.perSide = true
    if (bool(r.timed)) m.timed = true
    if (bool(r.weighted)) m.weighted = true
    if (opt(r.demo)) m.demo = str(r.demo)
    if (opt(r.videoUrl)) m.videoUrl = str(r.videoUrl)
    if (opt(r.notes)) m.notes = str(r.notes)
    return m
  })
  const plans: WorkoutPlan[] = rowsOf(wb, 'Workout plans').map((r) => {
    const p: WorkoutPlan = { workoutKey: str(r.workoutKey) as WorkoutPlan['workoutKey'] }
    if (opt(r.name)) p.name = str(r.name)
    // One id in older backups, a comma list now.
    if (opt(r.burnout)) p.burnouts = str(r.burnout) === NONE ? [] : list(r.burnout)
    if (str(r.core)) p.core = str(r.core) === NONE ? [] : str(r.core).split(',')
    if (str(r.hiit)) p.hiit = list(r.hiit)
    if (str(r.orders)) p.orders = str(r.orders).split(';').map(list)
    return p
  })
  const settings: Setting[] = rowsOf(wb, 'Settings')
    .map((r) => ({ key: str(r.key), value: str(r.value) }))
    .filter((s) => s.key)

  await db.transaction('rw', [db.runs, db.sessions, db.sets, db.body, db.overrides, db.extras, db.moves, db.plans, db.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([db.runs.clear(), db.sessions.clear(), db.sets.clear(), db.body.clear(), db.overrides.clear(), db.extras.clear(), db.moves.clear(), db.plans.clear()])
    }
    await db.moves.bulkPut(moves)
    await db.plans.bulkPut(plans)
    await db.runs.bulkPut(runs)
    await db.sessions.bulkPut(sessions)
    await db.sets.bulkPut(sets)
    await db.body.bulkPut(body)
    await db.overrides.bulkPut(overrides)
    await db.extras.bulkPut(extras)
    // Merging keeps this device's active run and unit; replacing adopts the file's.
    const keep = mode === 'merge' ? new Set((await db.settings.toArray()).map((s) => s.key)) : new Set<string>()
    await db.settings.bulkPut(settings.filter((s) => !keep.has(s.key)))
  })
  return { runs: runs.length, sessions: sessions.length, sets: sets.length, body: body.length, extras: extras.length, moves: moves.length }
}

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
