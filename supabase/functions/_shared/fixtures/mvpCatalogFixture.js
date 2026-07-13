import {
  createManufacturerAdapterRegistry,
  defineManufacturerAdapter,
} from '../../../../src/lib/catalog/manufacturerAdapter.js'
import { catalogIdentityKey } from '../../../../src/lib/catalog/catalogContracts.js'

export const MVP_FIXTURE_ADAPTER_KEY = 'mvp-catalog'
export const MVP_FIXTURE_ADAPTER_VERSION = '1.0.0-fixture'
export const MVP_FIXTURE_SOURCE = Object.freeze({
  type: 'manufacturer',
  name: 'MVP (non-production fixture)',
  url: 'https://fixture.example/mvp/catalog.json',
})

export const MVP_FIXTURE_PAYLOAD = Object.freeze({
  manufacturer: { name: 'MVP', legalName: 'MVP Disc Sports' },
  molds: [
    { name: 'Watt', speed: 2, glide: 5, turn: -0.5, fade: 0 },
    { name: 'Terra', speed: 8, glide: 5, turn: -0.5, fade: 2 },
  ],
})

function moldCandidate(mold) {
  const identity = { manufacturerKey: 'mvp', moldKey: mold.name }
  return {
    entityType: 'mold',
    identity,
    identityKey: catalogIdentityKey('mold', identity),
    fields: {
      mold_name: mold.name,
      speed: mold.speed,
      glide: mold.glide,
      turn: mold.turn,
      fade: mold.fade,
    },
    supportedFields: ['mold_name', 'speed', 'glide', 'turn', 'fade'],
    sourceReference: `${MVP_FIXTURE_SOURCE.url}#${mold.name.toLowerCase()}`,
    evidenceSnapshot: { fixture: true, manufacturer: 'MVP', mold: mold.name },
    confidence: 'manufacturer_verified',
  }
}

export const mvpFixtureAdapter = defineManufacturerAdapter({
  adapterKey: MVP_FIXTURE_ADAPTER_KEY,
  adapterVersion: MVP_FIXTURE_ADAPTER_VERSION,
  manufacturerName: 'MVP',
  normalize: async (payload) => payload.molds.map(moldCandidate),
})

export const mvpFixtureAdapterRegistry = createManufacturerAdapterRegistry([mvpFixtureAdapter])

export const MVP_FIXTURE_REVIEW_RECORD = Object.freeze({
  reviewerPrincipal: 'fixture-reviewer:non-production',
  decision: 'approved',
  reason: 'Deterministic fixture payload reviewed against the bounded MVP adapter contract.',
  candidateIdentityKeys: Object.freeze([
    'mold:manufacturerKey=mvp|moldKey=terra',
    'mold:manufacturerKey=mvp|moldKey=watt',
  ]),
})
