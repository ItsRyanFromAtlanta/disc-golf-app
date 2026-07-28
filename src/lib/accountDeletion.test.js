import { describe, expect, it } from 'vitest'
import {
  DELETE_ACCOUNT_MESSAGES,
  describeDeleteAccountError,
  isDeleteAccountUnavailable,
} from './accountDeletion'

describe('describeDeleteAccountError', () => {
  it('maps a missing RPC to the unavailable message', () => {
    // The exact shape PostgREST returns when the migration has not landed.
    const error = {
      code: 'PGRST202',
      message:
        'Could not find the function public.delete_own_account without parameters in the schema cache',
    }

    expect(describeDeleteAccountError(error)).toBe(DELETE_ACCOUNT_MESSAGES.UNAVAILABLE)
  })

  it('maps a Postgres undefined_function the same way', () => {
    expect(describeDeleteAccountError({ code: '42883', message: 'function does not exist' })).toBe(
      DELETE_ACCOUNT_MESSAGES.UNAVAILABLE,
    )
  })

  it('maps permission and missing-session failures to a session message', () => {
    expect(describeDeleteAccountError({ code: '42501', message: 'permission denied' })).toBe(
      DELETE_ACCOUNT_MESSAGES.SESSION,
    )
    // The function raises 28000 itself when auth.uid() is null.
    expect(describeDeleteAccountError({ code: '28000', message: 'no authenticated user' })).toBe(
      DELETE_ACCOUNT_MESSAGES.SESSION,
    )
  })

  it('recognises a transport failure, which arrives with no code', () => {
    expect(describeDeleteAccountError({ message: 'Failed to fetch' })).toBe(
      DELETE_ACCOUNT_MESSAGES.OFFLINE,
    )
    expect(describeDeleteAccountError({ message: 'Load failed' })).toBe(
      DELETE_ACCOUNT_MESSAGES.OFFLINE,
    )
  })

  it('passes an unrecognised failure through with its original message', () => {
    expect(describeDeleteAccountError({ code: 'P0001', message: 'storage purge failed' })).toBe(
      'storage purge failed',
    )
  })

  it('falls back to the unavailable message when there is nothing to report', () => {
    expect(describeDeleteAccountError(null)).toBe(DELETE_ACCOUNT_MESSAGES.UNAVAILABLE)
    expect(describeDeleteAccountError({})).toBe(DELETE_ACCOUNT_MESSAGES.UNAVAILABLE)
  })

  it('does not mistake a network-sounding server error for a transport failure', () => {
    // Has a code, so the message text must not be consulted.
    expect(
      describeDeleteAccountError({ code: 'P0001', message: 'failed to fetch storage objects' }),
    ).toBe('failed to fetch storage objects')
  })
})

describe('isDeleteAccountUnavailable', () => {
  it('is true only when the function itself is absent', () => {
    expect(isDeleteAccountUnavailable({ code: 'PGRST202' })).toBe(true)
    expect(isDeleteAccountUnavailable({ code: '42883' })).toBe(true)

    expect(isDeleteAccountUnavailable({ code: '42501' })).toBe(false)
    expect(isDeleteAccountUnavailable({ message: 'Failed to fetch' })).toBe(false)
    expect(isDeleteAccountUnavailable(null)).toBe(false)
  })
})
