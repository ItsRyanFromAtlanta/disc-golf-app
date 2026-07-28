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
