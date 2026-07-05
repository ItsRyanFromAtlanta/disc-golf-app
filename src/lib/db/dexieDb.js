import Dexie from 'dexie'

// Local-first mirror of the entities read through the repository layer (see
// src/lib/repository/). Cache tables hold the latest known row per id, keyed
// to match Supabase's uuid `id`. `outbox` holds mutations that haven't
// reached Supabase yet, so a write survives an offline page reload and can
// be replayed later (see offlineFirstRepository.js's flushOutbox).
//
// This is the shipped-app repository layer, separate from the InstantLaunch
// localStorage buffer (src/lib/instantLaunch/) that already handles real-time
// putt capture — per CLAUDE.md's staged-adoption plan, InstantLaunch folds
// into this subsystem last, not first.
class AppDatabase extends Dexie {
  constructor() {
    super('DiscGolfAppDB')
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
  }
}

export const db = new AppDatabase()
