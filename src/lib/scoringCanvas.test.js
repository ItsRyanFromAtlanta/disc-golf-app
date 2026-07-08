import { describe, it, expect } from 'vitest'
import { suggestBackupSwap, stackPips, WIND_SWAP_THRESHOLD_MPH } from './scoringCanvas'

const discs = [
  { id: 'primary', role: 'primary_putter' },
  { id: 'backup', role: 'backup_putter' },
  { id: 'standard', role: 'standard' },
]

describe('suggestBackupSwap', () => {
  it('suggests the backup putter when wind exceeds the threshold', () => {
    expect(
      suggestBackupSwap({ weatherCondition: 'headwind', windMph: WIND_SWAP_THRESHOLD_MPH + 1, discs, activePutterDiscId: 'primary' }),
    ).toEqual(discs[1])
  })

  it('suggests the backup putter in rain regardless of wind speed', () => {
    expect(suggestBackupSwap({ weatherCondition: 'rain', windMph: 0, discs, activePutterDiscId: 'primary' })).toEqual(
      discs[1],
    )
  })

  it('suggests nothing in calm, clear weather', () => {
    expect(suggestBackupSwap({ weatherCondition: 'clear', windMph: 5, discs, activePutterDiscId: 'primary' })).toBeNull()
  })

  it('suggests nothing at or below the wind threshold', () => {
    expect(
      suggestBackupSwap({ weatherCondition: 'crosswind', windMph: WIND_SWAP_THRESHOLD_MPH, discs, activePutterDiscId: 'primary' }),
    ).toBeNull()
  })

  it('suggests nothing when the backup is already active', () => {
    expect(suggestBackupSwap({ weatherCondition: 'rain', windMph: 0, discs, activePutterDiscId: 'backup' })).toBeNull()
  })

  it('suggests nothing when the locker has no backup putter', () => {
    const noBackup = [{ id: 'primary', role: 'primary_putter' }]
    expect(suggestBackupSwap({ weatherCondition: 'rain', windMph: 0, discs: noBackup, activePutterDiscId: 'primary' })).toBeNull()
  })
})

describe('stackPips', () => {
  it('renders gesture-captured events with their real outcome', () => {
    const events = [{ outcome: 'make' }, { outcome: 'miss' }]
    const pips = stackPips(4, events, 2)
    expect(pips.map((p) => p.state)).toEqual(['make', 'miss', 'pending', 'pending'])
  })

  it('renders batch-filled attempts beyond gesture events as filled, not a fabricated outcome', () => {
    const events = [{ outcome: 'make' }]
    const pips = stackPips(4, events, 3) // 1 real event + 2 batch-filled
    expect(pips.map((p) => p.state)).toEqual(['make', 'filled', 'filled', 'pending'])
  })

  it('flags only the last pip as bonus when the stage has a pressure putt', () => {
    const pips = stackPips(3, [], 0, true)
    expect(pips.map((p) => p.bonus)).toEqual([false, false, true])
  })

  it('flags no pips as bonus for a stage with no pressure putt', () => {
    const pips = stackPips(3, [], 0, false)
    expect(pips.every((p) => !p.bonus)).toBe(true)
  })
})
