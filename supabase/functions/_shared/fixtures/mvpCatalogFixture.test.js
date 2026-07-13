import { describe, expect, it } from 'vitest'
import { runManufacturerAdapter } from '../../../../src/lib/catalog/manufacturerAdapter.js'
import {
  MVP_FIXTURE_ADAPTER_KEY,
  MVP_FIXTURE_ADAPTER_VERSION,
  MVP_FIXTURE_PAYLOAD,
  MVP_FIXTURE_REVIEW_RECORD,
  MVP_FIXTURE_SOURCE,
  mvpFixtureAdapter,
  mvpFixtureAdapterRegistry,
} from './mvpCatalogFixture.js'

describe('bounded MVP manufacturer fixture', () => {
  it('is registered under the production-shaped slug and emits reviewable candidates', async () => {
    expect(mvpFixtureAdapterRegistry.get(MVP_FIXTURE_ADAPTER_KEY)).toBe(mvpFixtureAdapter)

    const result = await runManufacturerAdapter(mvpFixtureAdapter, {
      payload: MVP_FIXTURE_PAYLOAD,
      source: MVP_FIXTURE_SOURCE,
      capturedAt: '2026-07-13T00:00:00.000Z',
    })

    expect(result).toMatchObject({
      adapterKey: MVP_FIXTURE_ADAPTER_KEY,
      adapterVersion: MVP_FIXTURE_ADAPTER_VERSION,
      rowCount: 2,
      source: MVP_FIXTURE_SOURCE,
    })
    expect(result.candidates.map(({ identityKey }) => identityKey).sort()).toEqual(
      MVP_FIXTURE_REVIEW_RECORD.candidateIdentityKeys,
    )
    expect(result.candidates.every(({ evidenceSnapshot, confidence }) =>
      evidenceSnapshot.fixture === true && confidence === 'manufacturer_verified')).toBe(true)
  })

  it('keeps the fixture review explicit and non-production', () => {
    expect(MVP_FIXTURE_REVIEW_RECORD).toEqual({
      reviewerPrincipal: 'fixture-reviewer:non-production',
      decision: 'approved',
      reason: 'Deterministic fixture payload reviewed against the bounded MVP adapter contract.',
      candidateIdentityKeys: [
        'mold:manufacturerKey=mvp|moldKey=terra',
        'mold:manufacturerKey=mvp|moldKey=watt',
      ],
    })
    expect(MVP_FIXTURE_SOURCE.url).toContain('fixture.example')
  })
})
