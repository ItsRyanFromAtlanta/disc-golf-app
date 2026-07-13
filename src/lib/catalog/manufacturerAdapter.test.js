import { describe, expect, it } from 'vitest'
import {
  checksumPayload,
  createManufacturerAdapterRegistry,
  defineManufacturerAdapter,
  runManufacturerAdapter,
} from './manufacturerAdapter'

const source = { type: 'manufacturer', name: 'MVP', url: 'https://mvp.example/discs' }

function moldCandidate(overrides = {}) {
  return {
    entityType: 'mold',
    identity: { manufacturerKey: 'MVP', moldKey: 'Watt' },
    fields: { mold_name: 'Watt', speed: 8, glide: 5, turn: -0.5, fade: 1 },
    supportedFields: ['mold_name', 'speed', 'glide', 'turn', 'fade'],
    sourceReference: 'https://mvp.example/discs/watt',
    evidenceSnapshot: { title: 'Watt' },
    confidence: 'manufacturer_verified',
    ...overrides,
  }
}

function adapter(normalize = async () => [moldCandidate()]) {
  return defineManufacturerAdapter({
    adapterKey: 'mvp-catalog',
    adapterVersion: '1.0.0',
    manufacturerName: 'MVP',
    normalize,
  })
}

describe('manufacturer adapter contract', () => {
  it('normalizes candidates into a checksum-bearing staged envelope', async () => {
    const result = await runManufacturerAdapter(adapter(), {
      payload: { mold: 'Watt', flight: { speed: 8, glide: 5, turn: -0.5, fade: 1 } },
      source,
      capturedAt: '2026-07-12T20:00:00.000Z',
    })

    expect(result).toMatchObject({
      adapterKey: 'mvp-catalog',
      adapterVersion: '1.0.0',
      sourceChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      rowCount: 1,
    })
    expect(result.candidates[0].identityKey).toBe('mold:manufacturerKey=mvp|moldKey=watt')
  })

  it('produces the same checksum for equivalent object key order', async () => {
    await expect(checksumPayload({ b: 2, a: 1 })).resolves.toBe(await checksumPayload({ a: 1, b: 2 }))
  })

  it('rejects duplicate identities and candidates from another manufacturer', async () => {
    await expect(
      runManufacturerAdapter(
        adapter(async () => [moldCandidate(), moldCandidate({ fields: { ...moldCandidate().fields, mold_name: 'Watt 2' } })]),
        { payload: {}, source, capturedAt: '2026-07-12T20:00:00.000Z' },
      ),
    ).rejects.toThrow('duplicate identity')

    await expect(
      runManufacturerAdapter(
        adapter(async () => [moldCandidate({ identity: { manufacturerKey: 'Axiom', moldKey: 'Watt' } })]),
        { payload: {}, source, capturedAt: '2026-07-12T20:00:00.000Z' },
      ),
    ).rejects.toThrow('does not match the adapter')
  })

  it('keeps the adapter pure and rejects a non-SHA checksum', async () => {
    const normalize = async () => [moldCandidate()]
    const defined = adapter(normalize)
    expect(defined.normalize).toBe(normalize)
    await expect(
      runManufacturerAdapter(defined, {
        payload: {},
        source,
        sourceChecksum: 'not-a-checksum',
        capturedAt: '2026-07-12T20:00:00.000Z',
      }),
    ).rejects.toThrow('sourceChecksum must be a SHA-256 hex string')
  })

  it('registers adapters by stable key and rejects duplicates', () => {
    const registry = createManufacturerAdapterRegistry()
    const defined = adapter()
    expect(registry.register(defined)).toBe(defined)
    expect(registry.get('mvp-catalog')).toBe(defined)
    expect(registry.list()).toEqual([defined])
    expect(() => registry.register(defined)).toThrow('already registered')
  })

  it('requires persisted adapter keys to be lowercase slugs', () => {
    expect(() =>
      defineManufacturerAdapter({
        adapterKey: 'mvp.catalog',
        adapterVersion: '1.0.0',
        manufacturerName: 'MVP',
        normalize: async () => [],
      }),
    ).toThrow('lowercase slug')
  })
})
