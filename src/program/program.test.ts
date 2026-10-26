import { describe, expect, it } from 'vitest'
import { allSlots, isHiit, workoutFor } from './calendar'
import { EXERCISES } from './exercises'
import { applyOrder, bestOrder, dateForSlot, withOrder, defaultRestDays, exercisesFor, moveRestDay, planDays, scheduledOn, toggleRestDay, toISODate, workoutOffsets } from './schedule'
import { DEFAULT_BURNOUT, defaultCore, finisherFor, MOVE_BY_ID, moveInfo } from './finishers'
import { isRepPR } from '../components/finisher'
import { applyCustom } from './custom'
import { EXERCISE_BY_ID } from './exercises'
import { planFor } from './finishers'

const ids = (week: number, day: number) => exercisesFor(week, day).map((e) => e.id)

describe('calendar', () => {
  it('matches the printed calendar', () => {
    expect(workoutFor(1, 1).name).toBe('Chest & Biceps')
    expect(workoutFor(4, 4).name).toBe('Hamstrings & Glutes')
    expect(workoutFor(5, 1).name).toBe('Legs')
    expect(workoutFor(8, 5).name).toBe('Arms')
    expect(allSlots()).toHaveLength(40)
  })

  it('alternates LIFT and LIFT/HIIT, flipping each week', () => {
    expect([1, 2, 3, 4, 5].map((d) => isHiit(1, d))).toEqual([false, true, false, true, false])
    expect([1, 2, 3, 4, 5].map((d) => isHiit(2, d))).toEqual([true, false, true, false, true])
    expect([1, 2, 3, 4, 5].map((d) => isHiit(5, d))).toEqual([false, true, false, true, false])
  })
})

describe('tracker rotation', () => {
  it('has 50 exercises in tracker groups', () => {
    expect(EXERCISES).toHaveLength(50)
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(50)
  })

  it('rotates chest moves odd/even weeks (4 each)', () => {
    const chest = (w: number) => exercisesFor(w, 1).filter((e) => e.group === 'chest').map((e) => e.id)
    expect(chest(1)).toEqual(['flat-bench-press', 'flat-bench-neutral-press', 'incline-bench-press', 'incline-bench-fly'])
    expect(chest(2)).toEqual(['flat-bench-fly', 'flat-bench-rotating-press', 'incline-bench-rotating-press', 'incline-bench-neutral-press'])
  })

  it('keeps bent over row and pullover every back day', () => {
    for (const w of [1, 2, 3, 4]) {
      const back = ids(w, 3)
      expect(back).toContain('bent-over-row')
      expect(back).toContain('flat-bench-pullover')
      expect(back.filter((id) => EXERCISES.find((e) => e.id === id)!.group === 'back')).toHaveLength(4)
    }
  })

  it('only does Bulgarian split squats in weeks 5, 6 and 8', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].filter((w) => ids(w, w <= 4 ? 2 : 1).includes('bulgarian-split-squat'))).toEqual([5, 6, 8])
  })

  it('alternates the two muscle groups, and applies a saved order without losing the other moves', () => {
    const groups = exercisesFor(1, 1).map((e) => e.group)
    expect(groups.slice(0, 4)).toEqual(['chest', 'biceps', 'chest', 'biceps'])
    const def = ids(1, 1)
    const order = [def[3], def[0]]
    const reordered = exercisesFor(1, 1, undefined, order).map((e) => e.id)
    expect(reordered[0]).toBe(def[3])
    expect(reordered[3]).toBe(def[0])
    expect(reordered.slice(1, 3)).toEqual(def.slice(1, 3))
    expect(applyOrder([{ id: 'a' }, { id: 'b' }, { id: 'c' }], ['c', 'x', 'a']).map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('keeps a separate saved order per rotation of moves', () => {
    const odd = ids(1, 1)
    const even = ids(2, 1)
    let orders = withOrder(undefined, [...even].reverse())
    orders = withOrder(orders, [...odd].reverse())
    expect(orders).toHaveLength(2)
    expect(bestOrder(orders, even)).toEqual([...even].reverse())
    expect(bestOrder(orders, odd)).toEqual([...odd].reverse())
    expect(withOrder(orders, odd)).toHaveLength(2) // re-saving the same moves replaces, not appends
  })

  it('applies user overrides', () => {
    const list = exercisesFor(5, 4, { workoutKey: 'more-legs', added: ['calf-raise'], removed: ['frog-bridge'] }).map((e) => e.id)
    expect(list).toContain('calf-raise')
    expect(list).not.toContain('frog-bridge')
    expect(list.at(-1)).toBe('calf-raise')
  })
})

describe('schedule', () => {
  const plan = { startDate: '2026-10-05' } // a Monday, printed calendar

  it('maps dates to week/day and rest days', () => {
    expect(scheduledOn(plan, new Date(2026, 9, 4))).toEqual({ kind: 'before' })
    expect(scheduledOn(plan, new Date(2026, 9, 5))).toEqual({ kind: 'workout', week: 1, day: 1 })
    expect(scheduledOn(plan, new Date(2026, 9, 10))).toEqual({ kind: 'rest', nextIndex: 5 })
    expect(scheduledOn(plan, new Date(2026, 9, 19, 23, 30))).toEqual({ kind: 'workout', week: 3, day: 1 })
    expect(scheduledOn(plan, new Date(2026, 10, 27))).toEqual({ kind: 'workout', week: 8, day: 5 })
    expect(scheduledOn(plan, new Date(2026, 10, 28))).toEqual({ kind: 'after' })
    expect(scheduledOn(plan, new Date(2026, 10, 30))).toEqual({ kind: 'after' })
  })

  it('maps slots back to dates', () => {
    expect(toISODate(dateForSlot(plan, { week: 2, day: 3 }))).toBe('2026-10-14')
  })

  it('reflows workouts around moved rest days, keeping program order', () => {
    // Rest Wednesday instead of Saturday in week 1.
    const rest = moveRestDay(plan, 5, 2)
    const moved = { ...plan, restDays: rest }
    expect(rest.slice(0, 3)).toEqual([2, 6, 12])
    expect(scheduledOn(moved, new Date(2026, 9, 7))).toEqual({ kind: 'rest', nextIndex: 2 })
    expect(scheduledOn(moved, new Date(2026, 9, 8))).toEqual({ kind: 'workout', week: 1, day: 3 })
    expect(scheduledOn(moved, new Date(2026, 9, 10))).toEqual({ kind: 'workout', week: 1, day: 5 })
    expect(toISODate(dateForSlot(moved, { week: 2, day: 1 }))).toBe('2026-10-12')
    expect(workoutOffsets(moved)).toHaveLength(40)
  })

  it('adds and removes rest days, shifting later workouts', () => {
    const extra = { ...plan, restDays: toggleRestDay(plan, 1) } // an extra day off on Tuesday
    expect(scheduledOn(extra, new Date(2026, 9, 7))).toEqual({ kind: 'workout', week: 1, day: 2 })
    expect(toISODate(dateForSlot(extra, { week: 8, day: 5 }))).toBe('2026-11-30')
    expect(planDays(extra).filter((d) => d.kind === 'workout')).toHaveLength(40)
    expect(toggleRestDay(extra, 1)).toEqual(defaultRestDays())
  })
})

describe('finishers', () => {
  it('follows the calendar: burnout on LIFT days, HIIT on LIFT/HIIT days, unless switched', () => {
    expect(finisherFor({ week: 1, day: 1 })).toBe('burnout')
    expect(finisherFor({ week: 1, day: 2 })).toBe('hiit')
    expect(finisherFor({ week: 2, day: 1 })).toBe('hiit')
    expect(finisherFor({ week: 1, day: 2 }, 'burnout')).toBe('burnout')
  })

  it('gives two different core moves every day, rotating', () => {
    for (const s of allSlots()) {
      const [a, b] = defaultCore(s)
      expect(MOVE_BY_ID[a].kind).toBe('core')
      expect(MOVE_BY_ID[b].kind).toBe('core')
      expect(a).not.toBe(b)
    }
    expect(defaultCore({ week: 1, day: 1 })).not.toEqual(defaultCore({ week: 1, day: 2 }))
  })

  it('has a default burnout for every workout and resolves lifts used as burnouts', () => {
    for (const s of allSlots()) expect(MOVE_BY_ID[DEFAULT_BURNOUT[workoutFor(s.week, s.day).key]].kind).toBe('burnout')
    expect(moveInfo('flat-bench-press')?.name).toBe('Flat Bench Press')
  })

  it('counts a rep PR only against same-or-heavier earlier logs', () => {
    const log = (weightLb: number | null, reps: number) => ({ id: '', sessionId: '', runId: 'r', week: 1, day: 1, slot: 'burnout' as const, moveId: 'm', weightLb, reps, date: '' })
    expect(isRepPR({ weightLb: null, reps: 20 }, [log(null, 18)])).toBe(true)
    expect(isRepPR({ weightLb: null, reps: 20 }, [])).toBe(false)
    expect(isRepPR({ weightLb: 10, reps: 20 }, [log(5, 30)])).toBe(false)
    expect(isRepPR({ weightLb: 5, reps: 20 }, [log(10, 15)])).toBe(true)
  })
})

describe('your own moves and plans', () => {
  it('overrides built-ins, adds new moves, renames workouts and sets defaults; resetting restores', () => {
    applyCustom(
      [
        { id: 'calf-raise', kind: 'lift', name: 'Slow Calf Raise', group: 'calves', cues: ['3 s down'], mistakes: [] },
        { id: 'my-row', kind: 'lift', name: 'Renegade Row', group: 'back', weeks: [1], cues: [], mistakes: [] },
        { id: 'my-hiit', kind: 'hiit', name: 'Speed Skaters', cues: [], mistakes: [] },
      ],
      [{ workoutKey: 'chest-biceps', name: 'Chest + Bis', core: ['core-v-up', ''], hiit: ['my-hiit'] }],
    )
    expect(EXERCISE_BY_ID['calf-raise']).toMatchObject({ name: 'Slow Calf Raise', origin: 'edited', demo: 'Standing_Dumbbell_Calf_Raise', weeks: [1, 2, 3, 4, 5, 6, 7, 8] })
    expect(ids(1, 3)).toContain('my-row')
    expect(ids(2, 3)).not.toContain('my-row')
    expect(moveInfo('my-hiit')).toMatchObject({ kind: 'hiit', origin: 'custom' })
    expect(workoutFor(1, 1).name).toBe('Chest + Bis')
    expect(defaultCore({ week: 1, day: 1 })[0]).toBe('core-v-up')
    expect(planFor('chest-biceps').hiit).toEqual(['my-hiit'])

    applyCustom([], [])
    expect(EXERCISE_BY_ID['calf-raise'].name).toBe('Calf Raise')
    expect(EXERCISE_BY_ID['my-row']).toBeUndefined()
    expect(workoutFor(1, 1).name).toBe('Chest & Biceps')
    expect(moveInfo('my-hiit').name).toBe('Deleted move')
  })
})
