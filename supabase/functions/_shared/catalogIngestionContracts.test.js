import { describe, expect, it } from 'vitest'
import {
  createStagedIngestionEnvelope,
  normalizeIngestionJobRequest,
  validateFetchEnvelope,
} from './catalogIngestionContracts.js'

const request = {
  jobId: 'job-1',
  adapterKey: 'mvp-catalog',
  adapterVersion: '1.0.0',
  mode: 'stage',
  source: { type: 'manufacturer', name: 'MVP', url: 'https://mvp.example/catalog' },
}

const fetchEnvelope = {
  requestedUrl: request.source.url,
  finalUrl: request.source.url,
  status: 200,
  contentType: 'text/html',
  responseBytes: 42,
  capturedAt: '2026-07-12T23:00:00.000Z',
  rawChecksum: 'a'.repeat(64),
}

describe('catalog ingestion contracts', () => {
  it('normalizes a bounded stage job and rejects dotted adapter keys', () => {
    expect(normalizeIngestionJobRequest(request)).toMatchObject({ adapterKey: 'mvp-catalog', mode: 'stage' })
    expect(() => normalizeIngestionJobRequest({ ...request, adapterKey: 'mvp.catalog' })).toThrow('lowercase slug')
    expect(() => normalizeIngestionJobRequest({ ...request, source: { ...request.source, url: 'http://mvp.example' } })).toThrow(
      'HTTPS',
    )
  })

  it('validates fetch metadata and checksum shape', () => {
    expect(validateFetchEnvelope(fetchEnvelope)).toMatchObject({ status: 200, rawChecksum: 'a'.repeat(64) })
    expect(() => validateFetchEnvelope({ ...fetchEnvelope, rawChecksum: 'bad' })).toThrow('SHA-256')
    expect(() => validateFetchEnvelope({ ...fetchEnvelope, status: 304, notModified: false })).toThrow('match')
  })

  it('wraps adapter output with immutable staged provenance metadata', () => {
    const envelope = createStagedIngestionEnvelope({
      request,
      fetch: fetchEnvelope,
      adapterRun: {
        adapterKey: 'mvp-catalog',
        adapterVersion: '1.0.0',
        source: request.source,
        sourceChecksum: 'a'.repeat(64),
        capturedAt: fetchEnvelope.capturedAt,
        candidates: [{ identityKey: 'mold:manufacturerKey=mvp|moldKey=watt', entityType: 'mold' }],
      },
      rawArtifact: { path: `raw/${'a'.repeat(64)}.raw`, checksum: 'a'.repeat(64) },
    })

    expect(envelope).toMatchObject({
      contractVersion: 1,
      jobId: 'job-1',
      sourceChecksum: 'a'.repeat(64),
      rowCount: 1,
      rawArtifact: { path: `raw/${'a'.repeat(64)}.raw` },
    })
    expect(Object.isFrozen(envelope)).toBe(true)
  })
})
