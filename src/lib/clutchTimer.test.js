import { describe, expect, it, vi } from 'vitest'
import {
  CLUTCH_MAX_REST_MS,
  CLUTCH_MIN_REST_MS,
  clutchTimerState,
  createClutchDeadline,
  formatClutchCountdown,
  requestClutchNotificationPermission,
} from './clutchTimer'

describe('clutchTimer', () => {
  it('freezes a bounded 2–8 minute deadline', () => {
    expect(createClutchDeadline(0, 0).durationMs).toBe(CLUTCH_MIN_REST_MS)
    expect(createClutchDeadline(0, 1).durationMs).toBe(CLUTCH_MAX_REST_MS)
  })

  it('derives resting and overdue states from the persisted deadline', () => {
    const dueAt = new Date(300_000).toISOString()
    expect(clutchTimerState(dueAt, 120_000)).toEqual({ status: 'resting', remainingMs: 180_000 })
    expect(clutchTimerState(dueAt, 300_001)).toEqual({ status: 'putt_now', remainingMs: 0 })
  })

  it('formats a ceiling countdown', () => {
    expect(formatClutchCountdown(120_001)).toBe('2:01')
    expect(formatClutchCountdown(0)).toBe('0:00')
  })

  it('requests permission only through the explicit caller', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    await expect(requestClutchNotificationPermission({ permission: 'default', requestPermission })).resolves.toBe('granted')
    expect(requestPermission).toHaveBeenCalledOnce()
  })
})
