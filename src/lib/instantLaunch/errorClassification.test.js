import { describe, it, expect } from 'vitest'
import { attachResponseStatus, isPermanentError } from './errorClassification'

describe('isPermanentError', () => {
  it('treats known constraint-violation Postgres codes as permanent', () => {
    expect(isPermanentError({ code: '23505' })).toBe(true) // unique_violation
    expect(isPermanentError({ code: '23514' })).toBe(true) // check_violation
    expect(isPermanentError({ code: '23503' })).toBe(true) // foreign_key_violation
  })

  it('treats 4xx status codes as permanent', () => {
    expect(isPermanentError({ status: 400 })).toBe(true)
    expect(isPermanentError({ status: 404 })).toBe(true)
    expect(isPermanentError({ status: 499 })).toBe(true)
  })

  it('treats 5xx and network-style errors as transient', () => {
    expect(isPermanentError({ status: 500 })).toBe(false)
    expect(isPermanentError({ status: 503 })).toBe(false)
    expect(isPermanentError({ message: 'Failed to fetch' })).toBe(false)
  })

  it('treats null/undefined as not permanent', () => {
    expect(isPermanentError(null)).toBe(false)
    expect(isPermanentError(undefined)).toBe(false)
  })

  // This is the gap `attachResponseStatus` exists to close, asserted on the
  // classifier itself so the reason the helper is needed stays visible here.
  it('reads a statusless PostgrestError as transient, whatever the code', () => {
    // A `PostgrestError` carries code/message/details/hint and no status, so
    // every one of these retries forever until a send site attaches the status.
    expect(isPermanentError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isPermanentError({ code: '22023', message: 'invalid parameter' })).toBe(false)
    expect(isPermanentError({ code: '28000', message: 'no authenticated user' })).toBe(false)
  })
})

describe('attachResponseStatus', () => {
  it('makes an RLS denial permanent, which is the whole point', () => {
    const error = { code: '42501', message: 'permission denied for table rounds' }
    expect(isPermanentError(error)).toBe(false)

    expect(isPermanentError(attachResponseStatus(error, 403))).toBe(true)
  })

  it('makes an RPC validation error permanent', () => {
    expect(isPermanentError(attachResponseStatus({ code: '22023' }, 400))).toBe(true)
  })

  it('leaves a 5xx transient', () => {
    expect(isPermanentError(attachResponseStatus({ code: 'XX000' }, 503))).toBe(false)
  })

  // The deploy-ordering window: `main` ships the client before the migration
  // lands, so PostgREST answers with a 4xx for a function that is about to
  // exist. Attaching that status would poison a write that was going to work.
  it('does not attach a status to a not-yet-deployed function or table', () => {
    for (const code of ['PGRST202', 'PGRST205', '42883', '42P01']) {
      const error = { code, message: 'not found' }
      expect(attachResponseStatus(error, 404).status).toBeUndefined()
      expect(isPermanentError(error)).toBe(false)
    }
  })

  // Same window, additive-column shape — and the one this project hits most,
  // because absorbing a concept as new columns is the schema convention. A
  // client that writes `rounds.weather_condition` before its migration lands
  // gets 400/PGRST204 on every attempt; poisoning would throw the round away
  // over a deploy ordering that fixes itself minutes later.
  it('does not attach a status to a column the migration has not added yet', () => {
    for (const code of ['PGRST204', '42703']) {
      const error = { code, message: "Could not find the 'weather_condition' column of 'rounds'" }
      expect(attachResponseStatus(error, 400).status).toBeUndefined()
      expect(isPermanentError(error)).toBe(false)
    }
  })

  it('does not overwrite a status a send site already attached', () => {
    expect(attachResponseStatus({ code: '42501', status: 403 }, 500).status).toBe(403)
  })

  it('ignores a missing or non-numeric status', () => {
    expect(attachResponseStatus({ code: '42501' }, undefined).status).toBeUndefined()
    expect(attachResponseStatus({ code: '42501' }, null).status).toBeUndefined()
  })

  it('passes null and undefined errors straight through', () => {
    expect(attachResponseStatus(null, 400)).toBeNull()
    expect(attachResponseStatus(undefined, 400)).toBeUndefined()
  })

  // Copying an Error to avoid mutation would silently drop both of these, since
  // they are own non-enumerable properties that spread and Object.assign skip.
  it('preserves the message and stack of a real Error', () => {
    const error = attachResponseStatus(new Error('boom'), 400)

    expect(error.message).toBe('boom')
    expect(error.stack).toBeTruthy()
    expect(error).toBeInstanceOf(Error)
  })
})
