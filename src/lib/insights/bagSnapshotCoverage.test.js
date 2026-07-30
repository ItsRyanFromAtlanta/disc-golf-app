import { describe, expect, it } from 'vitest'
import { bagSnapshotLedger } from './bagSnapshotCoverage'

const at = (status) => ({ status })

describe('bagSnapshotLedger', () => {
  it('reports no coverage information for an empty history', () => {
    const ledger = bagSnapshotLedger([])
    expect(ledger.rounds).toBe(0)
    expect(ledger.coverage).toBeNull()
    expect(ledger.verified).toBe(0)
  })

  it('measures coverage over the rounds that claimed a bag and could be checked', () => {
    const ledger = bagSnapshotLedger([
      at('verified'),
      at('verified'),
      at('edited'),
      at('not_snapshotted'),
    ])
    expect(ledger.verified).toBe(2)
    expect(ledger.unverifiable).toBe(2)
    expect(ledger.coverage).toBe(0.5)
  })

  it('excludes rounds that named no bag — nothing was claimed, so nothing is missing', () => {
    const ledger = bagSnapshotLedger([at('verified'), at('no_bag_recorded'), at('no_bag_recorded')])
    expect(ledger.withoutBag).toBe(2)
    expect(ledger.coverage).toBe(1)
    expect(ledger.rounds).toBe(3)
  })

  it('keeps unreadable rounds out of the coverage fraction entirely', () => {
    // A bad connection must not look like bad record-keeping, and coverage has
    // to recover on its own once the reads succeed rather than being
    // permanently poisoned by one offline session.
    const ledger = bagSnapshotLedger([at('verified'), at('unknown'), at('unknown')])
    expect(ledger.unknown).toBe(2)
    expect(ledger.unverifiable).toBe(0)
    expect(ledger.coverage).toBe(1)
  })

  it('reports null coverage when every round was unreadable', () => {
    const ledger = bagSnapshotLedger([at('unknown'), at('unknown')])
    expect(ledger.coverage).toBeNull()
  })

  it('counts each status and ignores anything it does not recognise', () => {
    const ledger = bagSnapshotLedger([
      at('verified'),
      at('bag_mismatch'),
      at('snapshot_missing'),
      at('made_up'),
      null,
      undefined,
    ])
    expect(ledger.byStatus.verified).toBe(1)
    expect(ledger.byStatus.bag_mismatch).toBe(1)
    expect(ledger.byStatus.snapshot_missing).toBe(1)
    expect(ledger.unverifiable).toBe(2)
  })
})
