import { describe, expect, it } from 'vitest'
import { catalogIdentityKey, stableStringify, validateCatalogCandidate } from './catalogContracts'

describe('catalog contract primitives', () => {
  it('creates an order-independent normalized identity key', () => {
    expect(catalogIdentityKey('mold', { moldKey: ' Watt ', manufacturerKey: 'MVP' })).toBe(
      'mold:manufacturerKey=mvp|moldKey=watt',
    )
    expect(catalogIdentityKey('mold', { manufacturerKey: 'mvp', moldKey: 'watt' })).toBe(
      'mold:manufacturerKey=mvp|moldKey=watt',
    )
  })

  it('stable-stringifies nested JSON without depending on object key order', () => {
    expect(stableStringify({ z: 1, nested: { b: true, a: ['x', 2] }, a: null })).toBe(
      '{"a":null,"nested":{"a":["x",2],"b":true},"z":1}',
    )
  })

  it('rejects provenance that does not enumerate the fields it supports', () => {
    expect(() =>
      validateCatalogCandidate({
        entityType: 'mold',
        identity: { manufacturerKey: 'mvp', moldKey: 'watt' },
        fields: { speed: 8 },
        supportedFields: [],
        sourceReference: 'https://example.test/watt',
        evidenceSnapshot: {},
        confidence: 'manufacturer_verified',
      }),
    ).toThrow('supportedFields must exactly describe fields')
  })
})
