import { describe, expect, it } from 'vitest'
import { applyCustom } from './custom'
import { burnoutsOf, coreFor, defaultCore, parseSlot, slotName } from './finishers'

describe('burnout and core lists', () => {
  it('names list slots so the first burnout keeps its old name', () => {
    expect([slotName('burnout', 0), slotName('burnout', 1), slotName('core', 0), slotName('core', 2)]).toEqual(['burnout', 'burnout2', 'core1', 'core3'])
    expect(['burnout', 'burnout2', 'core1', 'core3'].map(parseSlot)).toEqual([['burnout', 0], ['burnout', 1], ['core', 0], ['core', 2]])
  })

  it('reads old single-burnout plans and core lists of any length', () => {
    expect(burnoutsOf({ workoutKey: 'arms', burnout: 'bo-hammer-curl' })).toEqual(['bo-hammer-curl'])
    expect(burnoutsOf({ workoutKey: 'arms', burnout: 'bo-hammer-curl', burnouts: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(burnoutsOf({ workoutKey: 'arms' })).toBeUndefined()
    applyCustom([], [{ workoutKey: 'chest-biceps', core: ['', 'core-v-up', 'core-plank'] }, { workoutKey: 'arms', core: [] }])
    const [rot] = defaultCore({ week: 1, day: 3 }) // back-triceps keeps the rotating pair
    expect(coreFor({ week: 1, day: 1 }).slice(1)).toEqual(['core-v-up', 'core-plank'])
    expect(coreFor({ week: 1, day: 1 })[0]).not.toBe('')
    expect(coreFor({ week: 5, day: 5 })).toEqual([])
    expect(coreFor({ week: 1, day: 3 })).toHaveLength(2)
    expect(coreFor({ week: 1, day: 3 })[0]).toBe(rot)
    applyCustom([], [])
  })
})
