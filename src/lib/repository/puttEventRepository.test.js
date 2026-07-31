import { describe, expect, it } from 'vitest'
import { buildPuttEventRow } from './puttEventRepository'

const BASE = {
  id: 'putt-1',
  userId: 'user-1',
  sequence: 3,
  outcome: 'make',
  distanceFt: 20,
  occurredAt: '2026-07-31T12:00:00.000Z',
}

describe('buildPuttEventRow', () => {
  it('shapes a regimen-parented row and nulls the other two arms', () => {
    const row = buildPuttEventRow({
      ...BASE,
      parent: { type: 'regimen', regimenRunId: 'run-1' },
      setOrder: 2,
    })
    expect(row.regimen_run_id).toBe('run-1')
    expect(row.freeform_session_id).toBeNull()
    expect(row.round_hole_id).toBeNull()
    expect(row.set_order).toBe(2)
    expect(row._op).toBe('insert')
  })

  it('shapes a freeform-parented row and nulls the other two arms, including set_order', () => {
    const row = buildPuttEventRow({
      ...BASE,
      parent: { type: 'freeform', freeformSessionId: 'session-1' },
      // A stray setOrder must not leak onto a non-regimen row.
      setOrder: 5,
    })
    expect(row.freeform_session_id).toBe('session-1')
    expect(row.regimen_run_id).toBeNull()
    expect(row.round_hole_id).toBeNull()
    expect(row.set_order).toBeNull()
  })

  // The null case: a round-parented putt has no regimen or freeform session,
  // and that is not missing data — the exclusive arc requires it to be a real
  // `null` in the payload, not an omitted key.
  it('shapes a round-parented row, nulling regimen/freeform and set_order', () => {
    const row = buildPuttEventRow({
      ...BASE,
      parent: { type: 'round', roundHoleId: 'hole-1' },
    })
    expect(row.round_hole_id).toBe('hole-1')
    expect(row.regimen_run_id).toBeNull()
    expect(row.freeform_session_id).toBeNull()
    expect(row.set_order).toBeNull()
  })

  it('defaults missZone, putterDiscId and setOrder to null and isPressure to false', () => {
    const row = buildPuttEventRow({ ...BASE, parent: { type: 'freeform', freeformSessionId: 's-1' } })
    expect(row.miss_zone).toBeNull()
    expect(row.putter_disc_id).toBeNull()
    expect(row.is_pressure).toBe(false)
  })

  it('carries a miss outcome, miss_zone, putter disc and pressure flag through unchanged', () => {
    const row = buildPuttEventRow({
      ...BASE,
      outcome: 'miss',
      missZone: 4,
      parent: { type: 'round', roundHoleId: 'hole-2' },
      putterDiscId: 'disc-1',
      isPressure: true,
    })
    expect(row.outcome).toBe('miss')
    expect(row.miss_zone).toBe(4)
    expect(row.putter_disc_id).toBe('disc-1')
    expect(row.is_pressure).toBe(true)
  })

  it('coerces a non-boolean isPressure to false rather than passing it through truthy', () => {
    const row = buildPuttEventRow({ ...BASE, parent: { type: 'freeform', freeformSessionId: 's-1' }, isPressure: 'yes' })
    expect(row.is_pressure).toBe(false)
  })

  it('nulls out a missing id on the selected parent arm rather than passing undefined through', () => {
    const row = buildPuttEventRow({ ...BASE, parent: { type: 'round' } })
    expect(row.round_hole_id).toBeNull()
  })

  it('throws on an unrecognized parent type instead of silently writing an all-null exclusive arc', () => {
    expect(() => buildPuttEventRow({ ...BASE, parent: { type: 'bogus' } })).toThrow(/parent\.type/)
  })

  it('throws when parent is missing entirely', () => {
    expect(() => buildPuttEventRow({ ...BASE, parent: null })).toThrow(/parent\.type/)
  })
})
