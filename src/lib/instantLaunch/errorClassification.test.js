import { describe, it, expect } from 'vitest'
import { isPermanentError } from './errorClassification'

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
})
