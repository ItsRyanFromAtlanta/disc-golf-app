import { test, expect } from './fixtures/app'

// Group-scorecard groundwork, driven through the summary screen that shows it.
//
// The roster and card logic is covered by `src/lib/roundPlayers.test.js` and
// `src/lib/insights/groupScorecard.test.js`. What only a browser can show is
// that the panel reaches those functions with the round's real data, that a
// companion write carries exactly the columns the migration defines, and — the
// part worth protecting — that the card is not a leaderboard.
//
// One state is deliberately NOT covered here: `available: false`, the deploy
// window in which `round_players` does not exist yet. The fixture backend has
// no per-table error injection (the same limit the bag-verification spec
// records for `unknown`), and an unseeded table answers `[]` rather than
// PGRST205. It is covered at unit level in `roundPlayerRepository.test.js`,
// where both spellings of the missing-table code are asserted to degrade rather
// than fall back to the mirror.

const ROUND_ID = '00000000-0000-4000-8000-0000000000c1'
const COURSE_ID = '00000000-0000-4000-8000-0000000000c2'
const LAYOUT_ID = '00000000-0000-4000-8000-0000000000c3'
const USER_ID = '00000000-0000-4000-8000-000000000001'

const COURSE = { id: COURSE_ID, name: 'Oak Grove', location: 'Atlanta', created_by: null }
const LAYOUT = { id: LAYOUT_ID, course_id: COURSE_ID, name: 'Main', is_default: true }

const HOLES = [1, 2, 3].map((number) => ({
  id: `00000000-0000-4000-8000-00000000c00${number}`,
  layout_id: LAYOUT_ID,
  hole_number: number,
  par: 3,
  distance_feet: 250,
  tee_type: null,
  hazards: null,
  strategy_notes: null,
}))

function buildRound(overrides = {}) {
  return {
    id: ROUND_ID,
    course_id: COURSE_ID,
    layout_id: LAYOUT_ID,
    bag_id: null,
    bag_version_id: null,
    played_at: '2026-07-20T14:00:00.000Z',
    weather_summary: null,
    weather_condition: null,
    wind_mph: null,
    scoring_mode: 'hole_by_hole',
    target_score: null,
    total_score: 9,
    status: 'completed',
    created_at: '2026-07-20T14:00:00.000Z',
    ...overrides,
  }
}

function buildPlayer(position, displayName, totalScore = null) {
  return {
    id: `00000000-0000-4000-8000-0000000000d${position}`,
    round_id: ROUND_ID,
    user_id: USER_ID,
    position,
    display_name: displayName,
    total_score: totalScore,
    created_at: '2026-07-20T18:00:00.000Z',
    updated_at: '2026-07-20T18:00:00.000Z',
  }
}

async function seed(supabase, { round = {}, players = [], holes = HOLES } = {}) {
  supabase.setTable('rounds', [buildRound(round)])
  supabase.setTable('courses', [COURSE])
  supabase.setTable('layouts', [LAYOUT])
  supabase.setTable('holes', holes)
  supabase.setTable('round_holes', [
    { id: 'rh-1', round_id: ROUND_ID, hole_id: HOLES[0].id, score: 3, disc_id: null, notes: null },
    { id: 'rh-2', round_id: ROUND_ID, hole_id: HOLES[1].id, score: 3, disc_id: null, notes: null },
    { id: 'rh-3', round_id: ROUND_ID, hole_id: HOLES[2].id, score: 3, disc_id: null, notes: null },
  ])
  supabase.setTable('round_players', players)
  supabase.setTable('bag_versions', [])
  supabase.stubActivityRpcs()
  await supabase.signIn()
}

function panel(page) {
  return page.getByRole('region', { name: 'Playing partners' })
}

test.describe('who else played', () => {
  test('a solo round says nothing was recorded, rather than claiming you played alone', async ({ page, supabase }) => {
    await seed(supabase)

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await expect(panel(page)).toContainText('No playing partners recorded')
    // No card list at all: an empty roster is not a one-player group.
    await expect(panel(page).getByRole('listitem')).toHaveCount(0)
  })

  test('lists the card in seat order with the owner first, never in score order', async ({ page, supabase }) => {
    await seed(supabase, {
      // Sam shot the lowest round on the card and sits in the last seat. If
      // this ever renders Sam first, something has started ranking.
      players: [buildPlayer(1, 'Dave', 62), buildPlayer(2, 'Sam', 48)],
    })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await expect(panel(page)).toContainText('3 players on this card')
    const names = panel(page).getByRole('listitem').locator('strong')
    await expect(names).toHaveText(['You', 'Dave', 'Sam'])
  })

  test('labels a companion total as entered rather than as a scorecard', async ({ page, supabase }) => {
    await seed(supabase, { players: [buildPlayer(1, 'Dave', 54)] })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    const entries = panel(page).getByRole('listitem')
    await expect(entries.nth(0)).toContainText('From the scorecard')
    await expect(entries.nth(1)).toContainText('Entered by you')
    // 54 against a par of 9 — stated, and shown against par because a layout
    // was recorded.
    await expect(entries.nth(1)).toContainText('+45')
  })

  test('withholds a score to par for a companion when the round has no layout', async ({ page, supabase }) => {
    await seed(supabase, {
      round: { layout_id: null, scoring_mode: 'activity_only', total_score: null },
      players: [buildPlayer(1, 'Dave', 54)],
      holes: [],
    })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    const entry = panel(page).getByRole('listitem').nth(1)
    await expect(entry).toContainText('54')
    await expect(entry).not.toContainText('+45')
  })

  test('records a companion with exactly the columns the migration defines', async ({ page, supabase }) => {
    await seed(supabase)

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await panel(page).getByRole('button', { name: 'Add player' }).click()
    // Stated where the name is typed, not buried in a settings screen.
    await expect(panel(page)).toContainText('Private to your account')
    await panel(page).getByLabel('Name').fill('  Dave   Smith ')
    await panel(page).getByLabel('Their total (optional)').fill('54')
    await panel(page).getByRole('button', { name: 'Add to card' }).click()

    await expect(panel(page)).toContainText('Played with Dave Smith')

    const writes = supabase.writesTo('round_players')
    expect(writes).toHaveLength(1)
    expect(writes[0].method).toBe('POST')
    expect(writes[0].body).toEqual({
      round_id: ROUND_ID,
      user_id: USER_ID,
      position: 1,
      // Whitespace collapsed by the client, so the CHECK never has to reject it.
      display_name: 'Dave Smith',
      total_score: 54,
    })
    // The primary key is deliberately absent: PostgREST's merge-duplicates
    // would rewrite it on the conflict path, and the seat is the natural key.
    expect(writes[0].body).not.toHaveProperty('id')
    expect(writes[0].params.on_conflict).toBe('round_id,position')
  })

  test('removing a companion deletes by seat, and nothing else on the round is written', async ({ page, supabase }) => {
    await seed(supabase, { players: [buildPlayer(1, 'Dave', 54)] })

    await page.goto(`/rounds/${ROUND_ID}/summary`)
    await panel(page).getByRole('button', { name: 'Remove' }).click()

    await expect(panel(page)).toContainText('No playing partners recorded')
    const writes = supabase.writesTo('round_players')
    expect(writes).toHaveLength(1)
    expect(writes[0].method).toBe('DELETE')
    expect(writes[0].params).toMatchObject({ round_id: `eq.${ROUND_ID}`, position: 'eq.1' })
    // The roster is its own table; recording who played never touches the round.
    expect(supabase.writesTo('rounds')).toEqual([])
  })
})
