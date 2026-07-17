import Dexie from 'dexie'

// Local-first mirror of the entities read through the repository layer (see
// src/lib/repository/). Cache tables hold the latest known row per id, keyed
// to match Supabase's uuid `id`. `outbox` holds mutations that haven't
// reached Supabase yet, so a write survives an offline page reload and can
// be replayed later (see offlineFirstRepository.js's flushOutbox).
//
// InstantLaunch's real-time capture buffer and putt outbox remain separate.
// Phase A A4 mirrors only their parent activity identity/lifecycle into this
// database; capture entities migrate later only after equivalence tests.
export class AppDatabase extends Dexie {
  constructor(name = 'DiscGolfAppDB') {
    super(name)
    this.version(1).stores({
      discs: 'id, user_id, mold_id, status',
      bags: 'id, user_id',
      bagDiscs: 'id, bag_id, disc_id',
      regimens: 'id, user_id, difficulty',
      regimenRuns: 'id, user_id, regimen_id',
      puttSessions: 'id, user_id',
      profile: 'id',
      outbox: '++id, table, op, createdAt',
    })

    // Phase A A4: lifecycle state is local-first and transactionally coupled
    // to its append-only event plus an idempotent remote-operation envelope.
    // Existing entity caches and generic outbox rows remain valid; the new
    // indexes are additive and fields may be absent on pre-A4 rows.
    this.version(2).stores({
      discs: 'id, user_id, mold_id, status',
      bags: 'id, user_id',
      bagDiscs: 'id, bag_id, disc_id',
      regimens: 'id, user_id, difficulty',
      regimenRuns: 'id, user_id, regimen_id',
      puttSessions: 'id, user_id',
      profile: 'id',
      activities: 'id, user_id, type, state, [user_id+state], hidden_at, updated_at',
      activityStateEvents: 'id, activity_id, user_id, idempotency_key, [activity_id+recorded_at]',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })

    // Phase A A8: user-facing hide/restore and finalized practice metadata
    // corrections append a local audit row in the same transaction as the
    // optimistic activity version update and diagnostic outbox operation.
    this.version(3).stores({
      discs: 'id, user_id, mold_id, status',
      bags: 'id, user_id',
      bagDiscs: 'id, bag_id, disc_id',
      regimens: 'id, user_id, difficulty',
      regimenRuns: 'id, user_id, regimen_id',
      puttSessions: 'id, user_id',
      profile: 'id',
      activities: 'id, user_id, type, state, [user_id+state], hidden_at, updated_at',
      activityStateEvents: 'id, activity_id, user_id, idempotency_key, [activity_id+recorded_at]',
      auditEvents: 'id, user_id, entity_type, entity_id, action, idempotency_key, [entity_id+recorded_at]',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })

    // Phase A A9: durable, actionable notification mirror. Notification
    // producers dedupe before they surface through the bell; the remote
    // notification RPCs remain the cross-device source of truth.
    this.version(4).stores({
      discs: 'id, user_id, mold_id, status',
      bags: 'id, user_id',
      bagDiscs: 'id, bag_id, disc_id',
      regimens: 'id, user_id, difficulty',
      regimenRuns: 'id, user_id, regimen_id',
      puttSessions: 'id, user_id',
      profile: 'id',
      activities: 'id, user_id, type, state, [user_id+state], hidden_at, updated_at',
      activityStateEvents: 'id, activity_id, user_id, idempotency_key, [activity_id+recorded_at]',
      auditEvents: 'id, user_id, entity_type, entity_id, action, idempotency_key, [entity_id+recorded_at]',
      notifications: 'id, user_id, category, priority, read_at, resolved_at, expires_at, dedupe_key, [user_id+resolved_at], [user_id+read_at], [user_id+dedupe_key]',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })
  }
}

export function createAppDatabase(name) {
  return new AppDatabase(name)
}

export const db = createAppDatabase()
