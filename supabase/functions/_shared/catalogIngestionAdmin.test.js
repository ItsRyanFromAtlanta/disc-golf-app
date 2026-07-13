import { describe, expect, it } from 'vitest'
import {
  adminPrincipalForUser,
  catalogAdminErrorResponse,
  createCatalogAdminRpcCall,
} from './catalogIngestionAdmin.js'

const userId = '35b59d46-c58d-4193-9de2-f09238c0d009'
const candidateId = '0f7c3d89-6f4e-4e73-9f5e-6dd7f159f1c1'
const batchId = 'd1e7c3a1-6c3e-4d91-9e4c-8a3ab4a3c1d2'

describe('catalog admin request contract', () => {
  it('derives a stable principal and builds a review RPC call', () => {
    expect(adminPrincipalForUser(userId)).toBe(`admin:${userId}`)
    expect(createCatalogAdminRpcCall({
      userId,
      body: { operation: 'review', candidateId, decision: 'approved', reason: 'Verified against manufacturer source.' },
    })).toEqual({
      functionName: 'catalog_review_candidate',
      params: {
        p_candidate_id: candidateId,
        p_decision: 'approved',
        p_reviewer_user_id: userId,
        p_reviewer_principal: `admin:${userId}`,
        p_reason: 'Verified against manufacturer source.',
      },
    })
  })

  it('builds a promotion call without accepting client actor fields', () => {
    expect(createCatalogAdminRpcCall({
      userId,
      body: {
        operation: 'promote',
        batchId,
        p_promoter_user_id: '00000000-0000-4000-8000-000000000000',
      },
    })).toEqual({
      functionName: 'catalog_promote_import_batch',
      params: {
        p_import_batch_id: batchId,
        p_promoter_user_id: userId,
        p_promoter_principal: `admin:${userId}`,
      },
    })
  })

  it('rejects malformed or incomplete requests', () => {
    expect(() => createCatalogAdminRpcCall({ userId, body: { operation: 'review', candidateId } })).toThrow(
      'catalog_admin_request_invalid',
    )
    expect(() => createCatalogAdminRpcCall({
      userId,
      body: { operation: 'review', candidateId, decision: 'approve', reason: 'x' },
    })).toThrow('catalog_review_decision_invalid')
    expect(() => createCatalogAdminRpcCall({ userId, body: { operation: 'promote', batchId: 'not-a-uuid' } })).toThrow(
      'catalog_admin_request_invalid',
    )
  })

  it('redacts unknown database errors and exposes only safe catalog codes', () => {
    expect(catalogAdminErrorResponse(new Error('relation private.secret does not exist'))).toEqual({
      status: 500,
      body: { error: 'catalog_admin_operation_failed' },
    })
    expect(catalogAdminErrorResponse(new Error('catalog_canonical_conflict'))).toEqual({
      status: 409,
      body: { error: 'catalog_canonical_conflict' },
    })
    expect(catalogAdminErrorResponse(new Error('catalog_admin_required'))).toEqual({
      status: 403,
      body: { error: 'catalog_admin_required' },
    })
    expect(catalogAdminErrorResponse(new Error('catalog_artifact_missing'))).toEqual({
      status: 409,
      body: { error: 'catalog_artifact_missing' },
    })
  })
})
