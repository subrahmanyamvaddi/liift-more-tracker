import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LiiftDB, type SetLog } from '../db/db'
import { bestOutside, isPR, prSets, previousSets, suggestHeavier } from './progression'
import { exportWorkbook, importWorkbook } from './spreadsheet'
import { removeExtra } from '../db/store'

const set = (week: number, n: number, weightLb: number | null, reps: number | null): SetLog => ({
  id: `r:w${week}d1:ex:${n}`, sessionId: `r:w${week}d1`, runId: 'r', exerciseId: 'ex',
  week, day: 1, setNumber: n, weightLb, reps, date: '2026-10-05',
})

describe('progression', () => {
  const history = [set(1, 1, 20, 12), set(1, 2, 25, 10), set(1, 3, 25, 8), set(3, 1, 20, 12), set(3, 2, 25, 10), set(3, 3, 25, 9)]

  it('finds last session values', () => {
    const prev = previousSets(history, (5 - 1) * 5)
    expect(prev.get(3)?.reps).toBe(9)
    expect(previousSets(history, 0).size).toBe(0)
  })

  it('detects PRs against other sessions only', () => {
    const best = bestOutside(history, 'r:w5d1')
    expect(best).toBe(25)
    expect(isPR(30, best)).toBe(true)
    expect(isPR(25, best)).toBe(false)
    expect(isPR(30, null)).toBe(false) // first time isn't a PR
  })

  it('counts one PR per session that beats earlier weeks', () => {
    expect(prSets([...history, set(5, 1, 30, 8), set(5, 2, 30, 6)], 'r').map((s) => s.id)).toEqual(['r:w5d1:ex:1'])
    expect(prSets(history, 'r')).toEqual([])
  })

  it('suggests going heavier after two sessions at the same top weight', () => {
    expect(suggestHeavier(history, 20, 5)).toBe(30)
    expect(suggestHeavier([...history.slice(0, 3), set(3, 1, 20, 12), set(3, 2, 25, 6), set(3, 3, 25, 6)], 20, 5)).toBeNull()
    expect(suggestHeavier(history.slice(0, 3), 20, 5)).toBeNull()
  })
})

describe('data from before burnout lists', () => {
  it('reads an old single-burnout backup as a one-move list', async () => {
    const a = new LiiftDB('old-a')
    await a.plans.add({ workoutKey: 'shoulders', burnout: 'bo-lateral-raise', core: ['core-plank', ''] })
    const b = new LiiftDB('old-b')
    await importWorkbook(b, await exportWorkbook(a), 'replace')
    expect(await b.plans.get('shoulders')).toEqual({ workoutKey: 'shoulders', burnouts: ['bo-lateral-raise'], core: ['core-plank', ''] })
  })

  it('removing a burnout or core move moves the later logs up and leaves the rest alone', async () => {
    const db = new LiiftDB('remove')
    const log = (slot: string, moveId: string) => ({ id: `s:${slot}`, sessionId: 's', runId: 'r', week: 1, day: 1, slot, moveId, weightLb: null, reps: 10, date: '' })
    await db.extras.bulkAdd([log('burnout', 'a'), log('burnout2', 'b'), log('burnout3', 'c'), log('core1', 'x'), log('core2', 'y')])
    await removeExtra('s', 'burnout', 1, db)
    const rows = await db.extras.toArray()
    expect(rows.map((r) => [r.id, r.slot, r.moveId]).sort()).toEqual([
      ['s:burnout', 'burnout', 'a'], ['s:burnout2', 'burnout2', 'c'], ['s:core1', 'core1', 'x'], ['s:core2', 'core2', 'y'],
    ])
  })
})

describe('spreadsheet round trip', () => {
  it('exports and re-imports identical data', async () => {
    const a = new LiiftDB('a')
    await a.runs.add({ id: 'r', name: 'LIIFT MORE', startDate: '2026-10-05', archived: false, createdAt: 1, restDays: [2, 6, 12, 13] })
    await a.runs.add({ id: 'old', name: 'LIIFT MORE', startDate: '2026-06-01', archived: true, createdAt: 0 })
    await a.settings.bulkPut([{ key: 'activeRunId', value: 'r' }, { key: 'unit', value: 'lb' }])
    await a.sessions.add({ id: 'r:w1d1', runId: 'r', week: 1, day: 1, date: '2026-10-05', completed: true, hiitDone: false, notes: 'felt strong, 3x' })
    await a.sessions.add({ id: 'r:w1d2', runId: 'r', week: 1, day: 2, date: '2026-10-06', completed: false, hiitDone: false, finisher: 'burnout', order: ['back-pullover', 'bent-over-row'], notes: '' })
    await a.extras.bulkAdd([
      { id: 'r:w1d1:burnout', sessionId: 'r:w1d1', runId: 'r', week: 1, day: 1, slot: 'burnout', moveId: 'bo-push-up', weightLb: null, reps: 22, date: '2026-10-05' },
      { id: 'r:w1d1:core2', sessionId: 'r:w1d1', runId: 'r', week: 1, day: 1, slot: 'core2', moveId: 'core-plank', weightLb: null, reps: 60, date: '2026-10-05' },
      { id: 'r:w1d1:burnout2', sessionId: 'r:w1d1', runId: 'r', week: 1, day: 1, slot: 'burnout2', moveId: 'my-1', weightLb: 10, reps: 15, date: '2026-10-05' },
      { id: 'r:w1d1:core3', sessionId: 'r:w1d1', runId: 'r', week: 1, day: 1, slot: 'core3', moveId: 'core-v-up', weightLb: null, reps: 12, date: '2026-10-05' },
    ])
    await a.sets.bulkAdd([set(1, 1, 20, 12), set(1, 2, 25, null)])
    await a.body.add({ id: 'b', runId: 'r', date: '2026-10-05', weightLb: 180.5, chestIn: 40, waistIn: null, hipsIn: null, armIn: 14.5, thighIn: null, bodyFatPct: null, notes: '' })
    await a.overrides.add({ id: 'r:legs', runId: 'r', workoutKey: 'legs', added: ['calf-raise', 'sumo-squat'], removed: [] })

    await a.moves.bulkAdd([
      { id: 'my-1', kind: 'hiit', name: 'Speed Skaters', cues: ['Leap side to side', 'Touch the floor'], mistakes: [], videoUrl: 'https://youtu.be/x?t=12', notes: 'Joel: 30 s on, 15 s off' },
      { id: 'calf-raise', kind: 'lift', name: 'Calf Raise (Joel: slow tempo)', group: 'calves', weeks: [1, 2, 3, 4, 5, 6, 7, 8], perSide: true, cues: ['3 s down'], mistakes: ['Bouncing'], demo: 'Standing_Dumbbell_Calf_Raise' },
    ])
    await a.plans.bulkAdd([
      { workoutKey: 'chest-biceps', name: 'Chest + Bis', burnouts: ['bo-chair-dip', 'my-1'], core: ['core-plank', '', 'core-v-up'], hiit: ['my-1', 'hiit-burpee'], orders: [['flat-bench-fly', 'iso-curl'], ['flat-bench-press', 'hammer-curl']] },
      { workoutKey: 'arms' },
      { workoutKey: 'legs', burnouts: [], core: [] },
    ])

    const file = await exportWorkbook(a)
    const b = new LiiftDB('b')
    const result = await importWorkbook(b, file, 'replace')
    expect(result).toEqual({ runs: 2, sessions: 2, sets: 2, body: 1, extras: 4, moves: 2 })

    for (const table of ['runs', 'sessions', 'sets', 'body', 'overrides', 'extras', 'moves', 'plans', 'settings'] as const) {
      expect(await b[table].toArray()).toEqual(await a[table].toArray())
    }
  })
})
