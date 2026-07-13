import { describe, expect, it } from 'vitest'
import {
  assertAllowedRemoteHost,
  validateFetchResponseMetadata,
  validateRemoteUrl,
} from './catalogFetchPolicy.js'

describe('catalog fetch policy', () => {
  it('normalizes an allowlisted HTTPS source and strips fragments', () => {
    expect(validateRemoteUrl('https://MVP.example/catalog#flight')).toBe('https://mvp.example/catalog')
    expect(assertAllowedRemoteHost('mvp.example', ['mvp.example'])).toBe('mvp.example')
    expect(assertAllowedRemoteHost('catalog.mvp.example', ['*.mvp.example'])).toBe('catalog.mvp.example')
  })

  it('rejects insecure, credentialed, non-default-port, literal-IP, and disallowed hosts', () => {
    expect(() => validateRemoteUrl('http://mvp.example/catalog')).toThrow('HTTPS')
    expect(() => validateRemoteUrl('https://user:secret@mvp.example/catalog')).toThrow('credentials')
    expect(() => validateRemoteUrl('https://mvp.example:8443/catalog')).toThrow('default HTTPS port')
    expect(() => validateRemoteUrl('https://127.0.0.1/catalog')).toThrow('not fetchable')
    expect(() => validateRemoteUrl('https://catalog.local/catalog')).toThrow('not fetchable')
    expect(() => assertAllowedRemoteHost('other.example', ['mvp.example'])).toThrow('not allowlisted')
  })

  it('accepts bounded HTML/JSON responses and cache-not-modified responses', () => {
    expect(
      validateFetchResponseMetadata({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        responseBytes: 128,
        contentLength: '128',
      }),
    ).toMatchObject({ status: 200, contentType: 'text/html', notModified: false })
    expect(validateFetchResponseMetadata({ status: 304, responseBytes: 0 })).toMatchObject({
      status: 304,
      notModified: true,
    })
  })

  it('rejects bad status, content type, and size metadata', () => {
    expect(() => validateFetchResponseMetadata({ status: 500, responseBytes: 0 })).toThrow('not ingestible')
    expect(() => validateFetchResponseMetadata({ status: 200, contentType: 'image/png', responseBytes: 1 })).toThrow(
      'content type',
    )
    expect(() =>
      validateFetchResponseMetadata({ status: 200, contentType: 'text/plain', responseBytes: 6 * 1024 * 1024 }),
    ).toThrow('exceeds the limit')
    expect(() =>
      validateFetchResponseMetadata({ status: 200, contentType: 'text/plain', responseBytes: 1, redirectCount: 4 }),
    ).toThrow('redirect limit')
  })
})
