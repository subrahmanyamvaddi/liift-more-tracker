import { describe, expect, it } from 'vitest'
import type { ExtraLog, Session, SetLog } from '../db/db'
import { allSlots } from '../program/calendar'
import { applyCustom } from '../program/custom'
import { DEMO_ALIASES, matchDemo, searchDemos } from '../program/demos'
import { moveInfo } from '../program/finishers'
import { defaultRestDays, planDays, restDaysOf, scheduledOn, toggleRestDay, toISODate } from '../program/schedule'
import demoIndex from '../generated/demoIndex.json'
import { intensityLevel, regionLoads, weeklyRegionSets } from './muscles'
import { best1RM, estimate1RM, strengthGains } from './progression'

const set = (exerciseId: string, week: number, n: number, weightLb: number | null, reps: number | null, date = '2026-10-26'): SetLog => ({
  id: `${exerciseId}:${week}:${n}`, sessionId: `r:w${week}d1`, runId: 'r', exerciseId, week, day: 1, setNumber: n, weightLb, reps, date,
})
const extra = (slot: string, moveId: string, reps: number | null): ExtraLog => ({
  id: slot, sessionId: 'r:w1d1', runId: 'r', week: 1, day: 1, slot, moveId, weightLb: null, reps, date: '2026-10-26',
})
const session = (date: string): Session => ({ id: 'r:w1d1', runId: 'r', week: 1, day: 1, date, completed: true, hiitDone: false, notes: '' })

describe('muscle work', () => {
  const input = {
    runId: 'r',
    sets: [set('flat-bench-press', 1, 1, 40, 10), set('flat-bench-press', 1, 2, 40, 8), set('flat-bench-press', 1, 3, null, null), { ...set('flat-bench-press', 1, 1, 90, 5), id: 'other', runId: 'x' }],
    extras: [extra('burnout', 'bo-push-up', 20), extra('core1', 'core-crunch', 15), extra('core2', 'core-plank', null), extra('burnout2', 'my-own', 10)],
    sessions: [session('2026-10-27')],
  }

  it('counts logged sets for the right muscle and ignores empty sets and other runs', () => {
    const loads = regionLoads(input)
    // 2 bench sets + the push-up burnout + half of the custom burnout shared with biceps.
    expect(loads.chest.sets).toBe(3.5)
    expect(loads.biceps.sets).toBe(0.5)
    expect(loads.core.sets).toBe(1)
    expect(loads.chest.volumeLb).toBe(720)
    expect(loads.back.sets).toBe(0)
  })

  it('uses the date the workout was moved to', () => {
    expect(regionLoads(input).chest.lastDate).toBe('2026-10-27')
    expect(regionLoads(input, '2026-10-28').chest.sets).toBe(0)
  })

  it('splits sets by program week and grades intensity by sets per week', () => {
    expect(weeklyRegionSets(input).chest[0]).toBe(3.5)
    expect([0, 3, 6, 12, 20].map(intensityLevel)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('strength', () => {
  it('estimates 1RM and caps reps at 12', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33)
    expect(estimate1RM(100, 20)).toBe(estimate1RM(100, 12))
    expect(best1RM([set('a', 1, 1, 100, 10), set('a', 1, 2, 110, 2)])).toBeCloseTo(133.33)
    expect(best1RM([set('a', 1, 1, 100, null)])).toBeNull()
  })

  it('lists exercises that went up between first and latest session', () => {
    const gains = strengthGains([set('a', 1, 1, 40, 10), set('a', 3, 1, 50, 10), set('b', 1, 1, 30, 10), set('b', 3, 1, 30, 10), set('c', 1, 1, 20, 10)], 'r')
    expect(gains).toEqual([{ exerciseId: 'a', fromLb: 40, toLb: 50, percent: 25 }])
  })
})

describe('extra rest days', () => {
  const plan = { startDate: '2026-10-26' }

  it('inserts a rest day and pushes that workout and later ones back, keeping program order', () => {
    const rest = toggleRestDay(plan, 2) // Wed of week 1
    const next = { ...plan, restDays: rest }
    expect(restDaysOf(next).size).toBe(defaultRestDays().length + 1)
    expect(scheduledOn(next, new Date(2026, 9, 28))).toMatchObject({ kind: 'rest' })
    expect(scheduledOn(next, new Date(2026, 9, 29))).toMatchObject({ kind: 'workout', week: 1, day: 3 })
    const workouts = planDays(next).flatMap((d) => (d.kind === 'workout' ? [d.slot] : []))
    expect(workouts).toEqual(allSlots())
    // Friday Dec 18 becomes Monday Dec 21: the workout it pushes also has to skip that weekend.
    expect(toISODate(planDays(next).at(-1)!.date)).toBe('2026-12-21')
  })

  it('removing it again restores the calendar', () => {
    const next = { ...plan, restDays: toggleRestDay(plan, 2) }
    expect(toggleRestDay(next, 2)).toEqual(defaultRestDays())
  })
})

describe('demo matching', () => {
  it('finds the demo for names people actually type', () => {
    expect(matchDemo('Reverse Crunches')).toBe('Reverse_Crunch')
    expect(matchDemo('Russian Twists')).toBe('Russian_Twist')
    expect(matchDemo('Jumping Jacks')).toBe('Star_Jump')
    expect(matchDemo('Speed Skaters (Joel)')).toBe('Lateral_Bound')
    expect(matchDemo('Bicycle Crunch')).toBe('Air_Bike')
    expect(matchDemo('Mountain Climbers HIIT')).toBe('Mountain_Climbers')
    expect(matchDemo('Tricep Pushups')).toBe('Pushups')
  })

  it('shows nothing rather than a wrong demo', () => {
    expect(matchDemo('Burpees')).toBeUndefined()
    expect(matchDemo('Floor Sweepers')).toBeUndefined()
    expect(matchDemo('')).toBeUndefined()
  })

  it('points every alias at a real demo and searches by name', () => {
    const ids = new Set(demoIndex.map((d) => d.id))
    for (const [, id] of DEMO_ALIASES) expect(ids.has(id), id).toBe(true)
    expect(searchDemos('crunch').map((d) => d.id)).toContain('Crunches')
    expect(searchDemos('')).toEqual([])
  })

  it('applies to moves you added, unless you chose a demo or none', () => {
    applyCustom([
      { id: 'my-1', kind: 'core', name: 'Flutter Kicks', cues: [], mistakes: [] },
      { id: 'my-2', kind: 'core', name: 'Flutter Kicks', demo: 'Plank', cues: [], mistakes: [] },
      { id: 'my-3', kind: 'hiit', name: 'Flutter Kicks', demo: 'none', cues: [], mistakes: [] },
    ], [])
    expect(moveInfo('my-1').demo).toBe('Flutter_Kicks')
    expect(moveInfo('my-2').demo).toBe('Plank')
    expect(moveInfo('my-3').demo).toBe('none')
    expect(moveInfo('hiit-high-knees').demo).toBe('Fast_Skipping')
    applyCustom([], [])
  })
})
