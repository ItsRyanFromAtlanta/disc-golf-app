import { describe, expect, it } from 'vitest'
import { runManufacturerAdapter } from '../../../../src/lib/catalog/manufacturerAdapter.js'
import {
  MVP_OFFICIAL_ADAPTER_KEY,
  MVP_OFFICIAL_ADAPTER_VERSION,
  MVP_OFFICIAL_PAYLOAD,
  MVP_OFFICIAL_SOURCE,
  mvpOfficialAdapter,
  mvpOfficialAdapterRegistry,
} from './mvpCatalogAdapter.js'

const CAPTURED_AT = '2026-07-12T23:30:00.000Z'

describe('bounded official MVP manufacturer adapter', () => {
  it('is server-registered and emits deterministic, reviewable mold candidates', async () => {
    expect(mvpOfficialAdapterRegistry.get(MVP_OFFICIAL_ADAPTER_KEY)).toBe(mvpOfficialAdapter)

    const result = await runManufacturerAdapter(mvpOfficialAdapter, {
      payload: MVP_OFFICIAL_PAYLOAD,
      source: MVP_OFFICIAL_SOURCE,
      capturedAt: CAPTURED_AT,
    })

    expect(result).toMatchObject({
      adapterKey: MVP_OFFICIAL_ADAPTER_KEY,
      adapterVersion: MVP_OFFICIAL_ADAPTER_VERSION,
      source: MVP_OFFICIAL_SOURCE,
      rowCount: 4,
    })
    expect(result.candidates.map(({ identityKey }) => identityKey)).toEqual([
      'mold:manufacturerKey=mvp|moldKey=photon',
      'mold:manufacturerKey=mvp|moldKey=terra',
      'mold:manufacturerKey=mvp|moldKey=volt',
      'mold:manufacturerKey=mvp|moldKey=watt',
    ])
    expect(result.candidates.every(({ confidence }) => confidence === 'manufacturer_verified')).toBe(true)
    expect(result.candidates.every(({ sourceReference, evidenceSnapshot }) =>
      sourceReference.startsWith('https://mvpdiscsports.com/discs/')
      && evidenceSnapshot.sourcePage === sourceReference)).toBe(true)
    expect(result.candidates.find(({ identityKey }) => identityKey.endsWith('moldKey=photon')).fields).toEqual({
      mold_name: 'Photon',
      speed: 11,
      glide: 5,
      turn: -1,
      fade: 2.5,
      category: 'distance driver',
    })
  })

  it('rejects a non-official source before normalizing payload rows', async () => {
    await expect(
      runManufacturerAdapter(mvpOfficialAdapter, {
        payload: MVP_OFFICIAL_PAYLOAD,
        source: { ...MVP_OFFICIAL_SOURCE, url: 'https://example.com/mvp/catalog' },
        capturedAt: CAPTURED_AT,
      }),
    ).rejects.toThrow('official MVP Disc Sports host')
  })

  it('rejects a payload whose manufacturer or flight facts are malformed', async () => {
    const wrongManufacturer = {
      ...MVP_OFFICIAL_PAYLOAD,
      manufacturer: { ...MVP_OFFICIAL_PAYLOAD.manufacturer, name: 'Axiom' },
    }
    await expect(
      runManufacturerAdapter(mvpOfficialAdapter, {
        payload: wrongManufacturer,
        source: MVP_OFFICIAL_SOURCE,
        capturedAt: CAPTURED_AT,
      }),
    ).rejects.toThrow('manufacturer must be MVP')

    const malformedMold = {
      ...MVP_OFFICIAL_PAYLOAD,
      molds: MVP_OFFICIAL_PAYLOAD.molds.map((mold, index) => index === 0
        ? { ...mold, speed: '2' }
        : mold),
    }
    await expect(
      runManufacturerAdapter(mvpOfficialAdapter, {
        payload: malformedMold,
        source: MVP_OFFICIAL_SOURCE,
        capturedAt: CAPTURED_AT,
      }),
    ).rejects.toThrow('Watt.speed must be a finite number')
  })
})
