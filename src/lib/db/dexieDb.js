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

    // J1: round logging mirrors private round parents and scorecard children
    // locally so a field session can survive a reload without a network. The
    // shared course/layout/hole reference data remains remote-only in v1; a
    // successfully loaded round cache carries the hole snapshot needed by an
    // active scorecard.
    this.version(5).stores({
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
      rounds: 'id, user_id, course_id, status, [user_id+status]',
      roundHoles: 'id, round_id, hole_id',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })

    // Phase B B2: shared canonical catalog reference data is read-only in
    // the client, but mirrored locally so mold selection still works when a
    // player loses signal. The normalized stores match the server tables;
    // callers hydrate plastics/runs/stamps at the repository boundary.
    this.version(6).stores({
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
      rounds: 'id, user_id, course_id, status, [user_id+status]',
      roundHoles: 'id, round_id, hole_id',
      catalogManufacturers: 'id, name, status',
      catalogMolds: 'id, manufacturer_id, manufacturer, mold_name, category, catalog_status',
      catalogPlastics: 'id, manufacturer_id, name, catalog_status',
      catalogMoldPlastics: 'id, mold_id, plastic_id, availability_status',
      catalogRuns: 'id, mold_plastic_id, catalog_status',
      catalogStamps: 'id, run_id, catalog_status',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })

    // Phase B 2A: append-only physical-disc events and immutable bag
    // snapshots. Rounds retain the exact bag version selected at start.
    this.version(7).stores({
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
      rounds: 'id, user_id, course_id, status, bag_version_id, [user_id+status]',
      roundHoles: 'id, round_id, hole_id',
      catalogManufacturers: 'id, name, status',
      catalogMolds: 'id, manufacturer_id, manufacturer, mold_name, category, catalog_status',
      catalogPlastics: 'id, manufacturer_id, name, catalog_status',
      catalogMoldPlastics: 'id, mold_id, plastic_id, availability_status',
      catalogRuns: 'id, mold_plastic_id, catalog_status',
      catalogStamps: 'id, run_id, catalog_status',
      discStateEvents: 'id, user_id, disc_id, event_type, idempotency_key, [disc_id+occurred_at]',
      bagVersions: 'id, user_id, bag_id, version, restored_from_version_id, idempotency_key, [bag_id+version]',
      bagVersionDiscs: 'id, user_id, bag_version_id, disc_id, [bag_version_id+disc_id]',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })

    // Phase B 2B: capacity-neutral ghost slots and reversible shot-tag
    // assignments. Removed rows remain cached as tombstones for history.
    this.version(8).stores({
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
      rounds: 'id, user_id, course_id, status, bag_version_id, [user_id+status]',
      roundHoles: 'id, round_id, hole_id',
      catalogManufacturers: 'id, name, status',
      catalogMolds: 'id, manufacturer_id, manufacturer, mold_name, category, catalog_status',
      catalogPlastics: 'id, manufacturer_id, name, catalog_status',
      catalogMoldPlastics: 'id, mold_id, plastic_id, availability_status',
      catalogRuns: 'id, mold_plastic_id, catalog_status',
      catalogStamps: 'id, run_id, catalog_status',
      discStateEvents: 'id, user_id, disc_id, event_type, idempotency_key, [disc_id+occurred_at]',
      bagVersions: 'id, user_id, bag_id, version, restored_from_version_id, idempotency_key, [bag_id+version]',
      bagVersionDiscs: 'id, user_id, bag_version_id, disc_id, [bag_version_id+disc_id]',
      bagGhostSlots: 'id, user_id, bag_id, speed_class, stability_class, removed_at, [bag_id+removed_at]',
      shotTags: 'id, user_id, slug, category, retired_at',
      discShotTagAssignments: 'id, user_id, disc_id, shot_tag_id, removed_at, idempotency_key, [disc_id+removed_at]',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })

    // Phase B item 3: private photo metadata plus a dedicated Blob-capable
    // upload queue. Generic JSON outbox rows remain unchanged.
    this.version(9).stores({
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
      rounds: 'id, user_id, course_id, status, bag_version_id, [user_id+status]',
      roundHoles: 'id, round_id, hole_id',
      catalogManufacturers: 'id, name, status',
      catalogMolds: 'id, manufacturer_id, manufacturer, mold_name, category, catalog_status',
      catalogPlastics: 'id, manufacturer_id, name, catalog_status',
      catalogMoldPlastics: 'id, mold_id, plastic_id, availability_status',
      catalogRuns: 'id, mold_plastic_id, catalog_status',
      catalogStamps: 'id, run_id, catalog_status',
      discStateEvents: 'id, user_id, disc_id, event_type, idempotency_key, [disc_id+occurred_at]',
      bagVersions: 'id, user_id, bag_id, version, restored_from_version_id, idempotency_key, [bag_id+version]',
      bagVersionDiscs: 'id, user_id, bag_version_id, disc_id, [bag_version_id+disc_id]',
      bagGhostSlots: 'id, user_id, bag_id, speed_class, stability_class, removed_at, [bag_id+removed_at]',
      shotTags: 'id, user_id, slug, category, retired_at',
      discShotTagAssignments: 'id, user_id, disc_id, shot_tag_id, removed_at, idempotency_key, [disc_id+removed_at]',
      discPhotos: 'id, user_id, disc_id, slot, deleted_at, superseded_at, [disc_id+slot]',
      discPhotoUploads: 'id, userId, discId, slot, status, createdAt, [discId+slot]',
      outbox:
        '++id, table, op, createdAt, idempotencyKey, dependencyKey, nextRetryAt, [table+idempotencyKey]',
    })

    // Phase B item 4: owner-private Lost & Found state, immutable timeline
    // cache, and an idempotent operation queue for offline case updates.
    this.version(10).stores({
      lostFoundCases: 'id, user_id, disc_id, status, latest_update_at, [user_id+status]',
      lostFoundUpdates: 'id, user_id, case_id, event_type, occurred_at, [case_id+occurred_at]',
      lostFoundOutbox: 'id, userId, caseId, discId, op, status, createdAt, idempotencyKey',
    })

    // Phase B item 5: immutable odometer/unlock mirrors plus replayable
    // client-generated telemetry envelopes.
    this.version(11).stores({
      discOdometerEvents: 'id, user_id, disc_id, metric, occurred_at, [disc_id+occurred_at]',
      discCosmeticUnlocks: 'id, user_id, disc_id, tier, threshold, [disc_id+tier]',
      discOdometerOutbox: 'id, userId, discId, metric, status, createdAt, idempotencyKey',
    })

    // Phase D D1: the existing regimen metadata cache gains ordered set rows
    // so Quick Play and regimen setup can resolve from IndexedDB after a
    // successful online load instead of gating a cold PWA launch on network.
    this.version(12).stores({
      regimenSets: 'id, regimen_id, set_order, [regimen_id+set_order]',
    })

    // Phase D D2: immutable fatigue observations are mirrored locally; parent
    // session context remains on the existing regimenRuns/puttSessions rows.
    this.version(13).stores({
      practiceFatigueCheckins: 'id, user_id, putt_session_id, regimen_run_id, recorded_at',
    })
  }
}

export function createAppDatabase(name) {
  return new AppDatabase(name)
}

export const db = createAppDatabase()
