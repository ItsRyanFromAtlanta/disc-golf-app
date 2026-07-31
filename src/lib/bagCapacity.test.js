import { describe, it, expect } from 'vitest'
import { BAG_HARD_CAPACITY, bagCapacityMessage, isBagCapacityError } from './bagCapacity'

// D-19: bag membership can be added from two surfaces (`BagLockerPage`,
// `DiscDetailPage`) with no capacity guard, so the 35-disc trigger surfaces as
// a raw Postgres string. These are the pure pieces the guard on both pages
// shares; the pages themselves are exercised end-to-end by `e2e/`.

describe('BAG_HARD_CAPACITY', () => {
  it('matches the enforce_bag_capacity() trigger (layer1_foundation_schema.sql:230-253)', () => {
    expect(BAG_HARD_CAPACITY).toBe(35)
  })
})

describe('bagCapacityMessage', () => {
  it('is readable prose, not a raw Postgres string', () => {
    expect(bagCapacityMessage()).toBe(
      'This bag is at the 35-disc capacity limit. Remove a disc before adding another.',
    )
  })

  it('reflects a non-default limit', () => {
    expect(bagCapacityMessage(10)).toBe('This bag is at the 10-disc capacity limit. Remove a disc before adding another.')
  })
})

describe('isBagCapacityError', () => {
  it("recognises the trigger's check_violation code", () => {
    const error = Object.assign(new Error('Bag b1 is at the 35-disc capacity limit'), { code: '23514' })
    expect(isBagCapacityError(error)).toBe(true)
  })

  it('does not misclassify an unrelated error', () => {
    expect(isBagCapacityError(Object.assign(new Error('duplicate'), { code: '23505' }))).toBe(false)
    expect(isBagCapacityError(null)).toBe(false)
    expect(isBagCapacityError(undefined)).toBe(false)
  })
})
