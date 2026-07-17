import { describe, expect, it } from 'vitest'
import { buildDiscCopies } from './discLocker'

describe('quantity-first physical disc creation', () => {
  it('creates independent identities while preserving shared configuration', () => {
    const ids = ['a', 'b', 'c']
    const rows = buildDiscCopies('user-1', { mold_id: 'mold-1', plastic: 'Neutron' }, 3, () => ids.shift())
    expect(rows).toEqual([
      { id: 'a', user_id: 'user-1', mold_id: 'mold-1', plastic: 'Neutron' },
      { id: 'b', user_id: 'user-1', mold_id: 'mold-1', plastic: 'Neutron' },
      { id: 'c', user_id: 'user-1', mold_id: 'mold-1', plastic: 'Neutron' },
    ])
  })

  it('rejects quantities outside the bounded entry flow', () => {
    expect(() => buildDiscCopies('user-1', {}, 0)).toThrow('between 1 and 10')
    expect(() => buildDiscCopies('user-1', {}, 11)).toThrow('between 1 and 10')
    expect(() => buildDiscCopies('user-1', {}, 1.5)).toThrow('between 1 and 10')
  })
})
