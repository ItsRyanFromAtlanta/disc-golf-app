import { describe, expect, it } from 'vitest'
import {
  createArtifactPersistenceRow,
  createCandidatePersistenceRows,
  createStagePersistencePayload,
  normalizeStagedCandidates,
  rawArtifactPathForChecksum,
} from './catalogIngestionPersistence.js'

const sourceChecksum = 'a'.repeat(64)

function candidate(overrides = {}) {
  return {
    entityType: 'mold',
    identity: { manufacturerKey: 'MVP', moldKey: 'Watt' },
    identityKey: 'mold:manufacturerKey=mvp|moldKey=watt',
    fields: { mold_name: 'Watt', speed: 8 },
    supportedFields: ['mold_name', 'speed'],
    sourceReference: 'https://mvp.example/catalog/watt',
    evidenceSnapshot: { title: 'Watt' },
    confidence: 'manufacturer_verified',
    ...overrides,
  }
}

async function envelope(overrides = {}) {
  const candidates = await normalizeStagedCandidates([candidate()])
  return {
    sourceChecksum,
    rowCount: candidates.length,
    fetch: {
      requestedUrl: 'https://mvp.example/catalog',
      finalUrl: 'https://mvp.example/catalog',
      status: 200,
      contentType: 'application/json',
      responseBytes: 42,
      etag: 'etag-1',
      lastModified: 'Sat, 12 Jul 2026 20:00:00 GMT',
      redirectCount: 0,
      capturedAt: '2026-07-12T20:00:00.000Z',
      rawChecksum: sourceChecksum,
      notModified: false,
    },
    rawArtifact: {
      path: rawArtifactPathForChecksum(sourceChecksum),
      checksum: sourceChecksum,
    },
    candidates,
    ...overrides,
  }
}

describe('catalog ingestion persistence contracts', () => {
  it('normalizes candidates, verifies identity, and computes a stable checksum', async () => {
    const [first] = await normalizeStagedCandidates([candidate()])
    const [equivalent] = await normalizeStagedCandidates([
      candidate({
        identity: { moldKey: 'Watt', manufacturerKey: 'MVP' },
        supportedFields: ['speed', 'mold_name'],
      }),
    ])

    expect(first).toMatchObject({
      rowNumber: 1,
      identityKey: 'mold:manufacturerKey=mvp|moldKey=watt',
      candidateChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(equivalent.candidateChecksum).toBe(first.candidateChecksum)
  })

  it('rejects identity drift, duplicate fields, duplicate identities, and incomplete provenance', async () => {
    await expect(normalizeStagedCandidates([candidate({ identityKey: 'mold:manufacturerKey=mvp|moldKey:wrong' })])).rejects.toThrow(
      'identityKey does not match identity',
    )
    await expect(normalizeStagedCandidates([candidate({ supportedFields: ['speed', 'speed'] })])).rejects.toThrow(
      'must not contain duplicates',
    )
    await expect(normalizeStagedCandidates([candidate(), candidate()])).rejects.toThrow('Duplicate staged identity')
    await expect(normalizeStagedCandidates([candidate({ evidenceSnapshot: null })])).rejects.toThrow(
      'evidenceSnapshot must be an object',
    )
  })

  it('maps one batch envelope to checksum-addressed artifact and candidate rows', async () => {
    const staged = await envelope()
    const payload = createStagePersistencePayload({
      batchId: 'batch-1',
      batch: { sourceChecksum, status: 'staged', rowCount: 1 },
      envelope: staged,
    })

    expect(payload.artifact).toMatchObject({
      import_batch_id: 'batch-1',
      source_checksum: sourceChecksum,
      storage_bucket: 'catalog-import-raw',
      storage_path: `raw/${sourceChecksum}.raw`,
      http_status: 200,
      response_bytes: 42,
    })
    expect(payload.candidates[0]).toMatchObject({
      import_batch_id: 'batch-1',
      row_number: 1,
      entity_type: 'mold',
      identity_key: 'mold:manufacturerKey=mvp|moldKey=watt',
      validation_status: 'valid',
      dedup_status: 'new',
      review_status: 'pending',
    })
  })

  it('rejects missing artifacts, checksum mismatches, and inconsistent batch envelopes', async () => {
    const staged = await envelope()
    expect(() => createArtifactPersistenceRow({ batchId: 'batch-1', envelope: { ...staged, rawArtifact: null } })).toThrow(
      'raw artifact is required',
    )
    expect(() => createArtifactPersistenceRow({
      batchId: 'batch-1',
      envelope: { ...staged, rawArtifact: { path: 'raw/not-checksum-addressed.raw', checksum: sourceChecksum } },
    })).toThrow('checksum-addressed')
    expect(() => createCandidatePersistenceRows({
      batchId: 'batch-1',
      envelope: { ...staged, candidates: [{ ...staged.candidates[0], candidateChecksum: 'bad' }] },
    })).toThrow('candidate checksum is required')
    expect(() => createStagePersistencePayload({
      batchId: 'batch-1',
      batch: { sourceChecksum: 'b'.repeat(64), status: 'staged', rowCount: 1 },
      envelope: staged,
    })).toThrow('Batch checksum must match')
    expect(() => createStagePersistencePayload({
      batchId: 'batch-1',
      batch: { sourceChecksum, status: 'staged', rowCount: 2 },
      envelope: staged,
    })).toThrow('Batch row count must match')
  })

  it('does not create a new artifact row for a 304 replay', async () => {
    const staged = await envelope({ fetch: { ...(await envelope()).fetch, status: 304, notModified: true, responseBytes: 0 } })
    expect(() => createArtifactPersistenceRow({ batchId: 'batch-1', envelope: staged })).toThrow(
      'not-modified response cannot create a new artifact row',
    )
  })
})
