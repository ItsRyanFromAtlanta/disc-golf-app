import { test, expect } from './fixtures/app'

// Bag snapshot verification, driven through the summary screen that shows it.
//
// The timeline logic is covered by `src/lib/roundBagVerification.test.js`. What
// only a browser can show is that the panel reaches those functions with the
// round's real bag history, and — the part that matters — that an unverifiable
// snapshot is *stated* rather than swallowed, hidden, or quietly replaced with
// a plausible-looking one.
//
// One status is deliberately NOT covered here: `unknown`, the case where the
// bag's version history could not be read at all. The fixture backend has no
// per-table error injection, and cutting the whole backend blocks the summary's
// own round load before the panel ever mounts — so the browser cannot isolate
// it. It is covered at unit level instead, in `roundBagRepository.test.js`
// ('reports "unknown" — not "missing" — when the history cannot be read'),
// which is the assertion that matters: the two must never be conflated.

const ROUND_ID = '00000000-0000-4000-8000-0000000000b1'
const COURSE_ID = '00000000-0000-4000-8000-0000000000b2'
const LAYOUT_ID = '00000000-0000-4000-8000-0000000000b3'
const BAG_ID = '00000000-0000-4000-8000-0000000000b4'

const COURSE = { id: COURSE_ID, name: 'Oak Grove', location: 'Atlanta', created_by: null }
const LAYOUT = { id: LAYOUT_ID, course_id: COURSE_ID, name: 'Main', is_default: true }

const HOLES = [1, 2, 3].map((number) => ({
  id: `00000000-0000-4000-8000-00000000b00${number}`,
  layout_id: LAYOUT_ID,
  hole_number: number,
  par: 3,
  distance_feet: 250,
  tee_type: null,
  hazards: null,
  strategy_notes: null,
}))

const ROUND_STARTED = '2026-07-20T14:00:00.000Z'

function buildRound(overrides = {}) {
  return {
    id: ROUND_ID,
    course_id: COURSE_ID,
    layout_id: LAYOUT_ID,
    bag_id: BAG_ID,
    bag_version_id: 'version-1',
    played_at: ROUND_STARTED,
    weather_summary: null,
    weather_condition: null,
    wind_mph: null,
    scoring_mode: 'hole_by_hole',
    target_score: null,
    total_score: 9,
    status: 'completed',
    created_at: ROUND_STARTED,
    ...overrides,
  }
}

function buildVersion(id, createdAt, { version = 1, discs = ['disc-a', 'disc-b'] } = {}) {
  return {
    id,
    user_id: '00000000-0000-4000-8000-000000000001',
    bag_id: BAG_ID,
    version,
    name: 'Tournament bag',
    description: null,
    bag_type: null,
    capacity: 20,
    is_default: true,
    reason: 'grouped_save',
    source: 'manual_entry',
    restored_from_version_id: null,
    created_at: createdAt,
    idempotency_key: `key-${id}`,
    bag_version_discs: discs.map((discId) => ({
      id: `${id}-${discId}`,
      bag_version_id: id,
      disc_id: discId,
    })),
  }
}

async function seed(supabase, { round = {}, versions = [buildVersion('version-1', '2026-07-20T13:59:00.000Z')] } = {}) {
  supabase.setTable('rounds', [buildRound(round)])
  supabase.setTable('courses', [COURSE])
  supabase.setTable('layouts', [LAYOUT])
  supabase.setTable('holes', HOLES)
  supabase.setTable('round_holes', [])
  supabase.setTable('bag_versions', versions)
  supabase.stubActivityRpcs()
  await supabase.signIn()
}

function panel(page) {
  return page.getByRole('region', { name: 'Bag used' })
}

test.describe('bag snapshot verification', () => {
  test('confirms a snapshot with nothing after it, naming the bag as it was called', async ({ page, supabase }) => {
    await seed(supabase)

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await expect(panel(page)).toContainText('Tournament bag')
    await expect(panel(page)).toContainText('Bag confirmed')
    await expect(panel(page)).toContainText('2 discs, unchanged for this round.')
  })

  test('says the bag was edited mid-round rather than showing a confident list', async ({ page, supabase }) => {
    await seed(supabase, {
      versions: [
        buildVersion('version-1', '2026-07-20T13:59:00.000Z', { version: 1 }),
        buildVersion('version-2', '2026-07-20T15:30:00.000Z', { version: 2, discs: ['disc-a', 'disc-c'] }),
      ],
    })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    // The round is still in progress from the app's point of view — no local
    // activity mirror means no known end — so the claim is bounded honestly
    // rather than asserted as "during play".
    await expect(panel(page)).toContainText('Bag cannot be confirmed')
    await expect(panel(page)).toContainText('saved again after this round started')
  })

  test('surfaces a round that recorded a bag but no snapshot, and repairs nothing', async ({ page, supabase }) => {
    // The pre-snapshot round, and the failed-capture round, look the same from
    // here — and both are honestly "cannot be established" rather than a bug.
    await seed(supabase, {
      round: { bag_version_id: null },
      versions: [buildVersion('version-1', '2026-07-01T10:00:00.000Z')],
    })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await expect(panel(page)).toContainText('Bag not snapshotted')
    await expect(panel(page)).toContainText('cannot be established')
    // A version is sitting right there and is deliberately not adopted: no
    // disc count is claimed for a round that recorded none.
    await expect(panel(page)).not.toContainText('discs, unchanged')
    expect(supabase.writesTo('rounds')).toEqual([])
  })

  test('a round with no bag says so, without implying a fault', async ({ page, supabase }) => {
    await seed(supabase, { round: { bag_id: null, bag_version_id: null }, versions: [] })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await expect(panel(page)).toContainText('No bag recorded')
    await expect(panel(page)).toContainText('No bag was selected when this round started.')
  })

  test('a snapshot that no longer resolves is reported, with nothing substituted', async ({ page, supabase }) => {
    await seed(supabase, { versions: [] })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await expect(panel(page)).toContainText('Bag cannot be confirmed')
    await expect(panel(page)).toContainText('no longer resolves')
    await expect(panel(page)).not.toContainText('discs, unchanged')
    // Read-only, and it stays that way: nothing here writes a "corrected"
    // version id back onto the round.
    expect(supabase.writesTo('rounds')).toEqual([])
  })
})
