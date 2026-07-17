import { describe, expect, it } from 'vitest'
import { quickPlayOptions, resolveQuickPlayRegimen } from './playLaunch'

const regimen = (id, difficulty, fields = {}) => ({ id, name: id, difficulty, user_id: null, ...fields })

describe('Quick Play resolution', () => {
  it('uses a valid saved default before the Level-1 system fallback', () => {
    const result = resolveQuickPlayRegimen([regimen('level-1', 1), regimen('custom', null, { user_id: 'user-1' })], 'custom')
    expect(result).toMatchObject({ regimen: { id: 'custom' }, reason: 'profile-default' })
  })

  it('defaults to the system Level-1 regimen', () => {
    const result = resolveQuickPlayRegimen([regimen('level-3', 3), regimen('level-1', 1)])
    expect(result).toMatchObject({ regimen: { id: 'level-1' }, reason: 'level-1' })
  })

  it('falls back deterministically when a saved regimen is missing or archived', () => {
    const result = resolveQuickPlayRegimen([
      regimen('level-4', 4),
      regimen('level-2', 2),
      regimen('archived', 1, { archived: true }),
    ], 'missing')
    expect(result).toMatchObject({ regimen: { id: 'level-2' }, reason: 'lowest-system-level' })
  })

  it('returns an honest unavailable state for an empty catalog', () => {
    expect(resolveQuickPlayRegimen([], 'missing')).toEqual({ regimen: null, reason: 'unavailable' })
  })

  it('orders system choices before custom choices without mutating the input', () => {
    const input = [regimen('custom', 1, { user_id: 'user-1' }), regimen('level-2', 2), regimen('level-1', 1)]
    expect(quickPlayOptions(input).map((entry) => entry.id)).toEqual(['level-1', 'level-2', 'custom'])
    expect(input.map((entry) => entry.id)).toEqual(['custom', 'level-2', 'level-1'])
  })
})
