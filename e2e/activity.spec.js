import { test, expect, buildActivity, buildPuttSession } from './fixtures/app'

// Activity-lifecycle coverage — the increment PHASE_A_ARCHITECTURE.md § 9 was
// waiting on. These flows all need an activity to already exist, which
// table-level seeding alone could not produce for current (active/paused)
// activities: those live only in the Dexie mirror.

const COMPLETED_ID = '00000000-0000-4000-8000-0000000000a1'
const DELETED_ID = '00000000-0000-4000-8000-0000000000a2'

test.describe('history and soft delete', () => {
  test('a completed activity appears in history', async ({ page, supabase }) => {
    supabase.setTable('activities', [buildActivity({ id: COMPLETED_ID })])
    supabase.setTable('putt_sessions', [buildPuttSession(COMPLETED_ID)])
    await supabase.signIn()

    await page.goto('/practice/history')

    const row = page.locator('.history-row').first()
    await expect(row).toBeVisible()
    await expect(row).toContainText('Freeform')
    await expect(row).toContainText('7/10')
  })

  test('a soft-deleted activity is hidden from history and listed under Recently Deleted', async ({
    page,
    supabase,
  }) => {
    // Soft delete is `hidden_at` set, within the 30-day recovery window.
    const hiddenAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    supabase.setTable('activities', [buildActivity({ id: DELETED_ID, hidden_at: hiddenAt })])
    supabase.setTable('putt_sessions', [buildPuttSession(DELETED_ID)])
    await supabase.signIn()

    await page.goto('/practice/history')
    await expect(page.getByText('No sessions yet.')).toBeVisible()

    await page.getByRole('link', { name: 'Recently Deleted' }).click()

    await expect(page).toHaveURL(/\/practice\/history\/deleted$/)
    await expect(page.locator('.history-row-ghost')).toContainText('Freeform')
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
  })

  test('restoring a deleted activity removes it from Recently Deleted', async ({ page, supabase }) => {
    const hiddenAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    supabase.setTable('activities', [buildActivity({ id: DELETED_ID, hidden_at: hiddenAt })])
    supabase.setTable('putt_sessions', [buildPuttSession(DELETED_ID)])
    await supabase.signIn()

    await page.goto('/practice/history/deleted')
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()

    // Restore writes to the local mirror and queues an outbox row; the reload
    // that follows reads the mirror, so the row leaves this list even though
    // the remote fixture still reports it hidden.
    await page.getByRole('button', { name: 'Restore' }).click()

    await expect(page.getByText('Nothing deleted recently.')).toBeVisible()
  })
})

test.describe('editing a finalized activity', () => {
  // § 4: once an activity is finalized, an edit updates the typed record *and*
  // appends an audit event carrying both sides of the change. Only the typed
  // half is on screen, so this reads the local audit row and the outgoing RPC
  // for the rest.
  test('a notes and tags correction appends an audit event and syncs the typed record', async ({
    page,
    supabase,
  }) => {
    supabase.stubActivityRpcs()
    supabase.setTable('activities', [buildActivity({ id: COMPLETED_ID })])
    supabase.setTable('putt_sessions', [buildPuttSession(COMPLETED_ID)])
    // The real `activity_correct_practice_details` writes the corrected values
    // back to the typed practice row; the stub does the same so the reload
    // below reads what a synced correction would actually return.
    supabase.setRpc('activity_correct_practice_details', (body) => {
      const [session] = supabase.getTable('putt_sessions')
      supabase.setTable('putt_sessions', [{ ...session, notes: body.p_notes, tags: body.p_tags }])
      return null
    })
    await supabase.signIn()

    await page.goto(`/practice/history/freeform/${COMPLETED_ID}`)
    await expect(page.getByRole('heading', { name: 'Freeform session' })).toBeVisible()

    await page.getByLabel('Notes').fill('Left everything short into the wind')
    await page.getByRole('button', { name: 'experimenting' }).click()
    await page.getByRole('button', { name: 'Save notes & tags' }).click()
    // The editor's own "Saved" state is not a usable signal here: saving
    // updates the entry, which changes the `key` SessionReport gives the
    // editor, so it remounts with fresh state and the confirmation is lost.
    // The correction reaching the backend is the settled point.
    await expect.poll(() => supabase.writesTo('rpc:activity_correct_practice_details').length).toBe(1)

    const audit = (await supabase.readLocalRows('auditEvents')).filter((row) => row.entity_id === COMPLETED_ID)
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      entity_type: 'activity',
      action: 'correct_practice_details',
      source: 'manual_correction',
      // Both sides are preserved, which is what makes the edit reversible and
      // reviewable rather than just overwritten.
      previous_values: { notes: null, tags: [] },
      new_values: { notes: 'Left everything short into the wind', tags: ['experimenting'] },
    })

    // The correction is version-checked against the activity it was read from,
    // and bumps it — a second edit from a stale copy would be rejected.
    const [activity] = (await supabase.readLocalRows('activities')).filter((row) => row.id === COMPLETED_ID)
    expect(activity.version).toBe(3)
    const [rpc] = supabase.writesTo('rpc:activity_correct_practice_details')
    expect(rpc.body).toMatchObject({
      p_activity_id: COMPLETED_ID,
      p_expected_version: 2,
      p_notes: 'Left everything short into the wind',
      p_tags: ['experimenting'],
      p_audit_event_id: audit[0].id,
    })

    // Reloading proves the edit survived as data rather than as component
    // state: this render comes from the corrected typed record.
    await page.reload()
    await expect(page.getByLabel('Notes')).toHaveValue('Left everything short into the wind')
    // A selected tag is expressed only as a class — `ChipGroup` sets no
    // `aria-pressed` — so there is no role-and-name way to assert it. That is
    // an accessibility gap rather than a selector problem.
    await expect(page.locator('.notes-tags-editor .chip-active')).toHaveText('experimenting')
  })
})

test.describe('current activity and resume', () => {
  test('a paused activity surfaces a resume affordance that returns to its capture route', async ({
    page,
    supabase,
  }) => {
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await supabase.seedLocalActivity({
      id: '00000000-0000-4000-8000-0000000000a3',
      type: 'putting_freeform',
      state: 'paused',
    })
    // liveQuery does not observe raw IndexedDB writes, so the mirror is read
    // fresh on load rather than pushed.
    await page.reload()

    // The PLAY hub renders its own resume hero card as well, so the header
    // pill is addressed through the banner landmark.
    const pill = page.getByRole('banner').getByRole('link', { name: 'Resume active practice' })
    await expect(pill).toBeVisible()

    await pill.click()
    await expect(page).toHaveURL(/\/practice\/freeform$/)
  })

  test('a paused regimen run resumes to that regimen rather than freeform', async ({ page, supabase }) => {
    const regimenId = '00000000-0000-4000-8000-0000000000c1'
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await supabase.seedLocalActivity({
      id: '00000000-0000-4000-8000-0000000000a4',
      type: 'putting_regimen',
      state: 'paused',
      metadata: { regimenId },
    })
    await page.reload()

    await page.getByRole('banner').getByRole('link', { name: 'Resume active practice' }).click()

    await expect(page).toHaveURL(new RegExp(`/practice/regimens/${regimenId}/run$`))
  })

  test('no resume affordance is shown when nothing is in progress', async ({ signedInPage: page }) => {
    await expect(page.getByRole('banner').getByRole('link', { name: 'Resume active practice' })).toHaveCount(0)
  })
})
