import { test, expect } from './fixtures/app'

// Everything here runs inside an *authenticated* session, which is the gap
// PHASE_A_ARCHITECTURE.md § 9 called out: prior browser checks never got past
// an anonymous one, so the shared shell had never actually been rendered by a
// test.

const TAB_LABELS = ['Play', 'Discs', 'Courses', 'Me']

// Route titles are short words that also appear in page content — "Play" is
// both the header title and part of "Quick Play", and /bag renders its own
// <h1>Discs</h1> below the header's. So header assertions are scoped to the
// banner landmark and matched exactly.
const headerTitle = (page, title) =>
  page.getByRole('banner').getByRole('heading', { name: title, exact: true })

test.describe('shared shell', () => {
  test('renders the tab bar, header, and notification affordance', async ({ signedInPage: page }) => {
    const tabs = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(tabs).toBeVisible()

    for (const label of TAB_LABELS) {
      await expect(tabs.getByRole('link', { name: label })).toBeVisible()
    }

    await expect(headerTitle(page, 'Play')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
    // Play is the section root, so there is nothing to go back to.
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
  })

  test('tab navigation moves between section roots and marks the current tab', async ({ signedInPage: page }) => {
    const tabs = page.getByRole('navigation', { name: 'Primary navigation' })

    await expect(tabs.getByRole('link', { name: 'Play' })).toHaveAttribute('aria-current', 'page')

    await tabs.getByRole('link', { name: 'Discs' }).click()
    await expect(page).toHaveURL(/\/bag$/)
    await expect(headerTitle(page, 'Discs')).toBeVisible()
    await expect(tabs.getByRole('link', { name: 'Discs' })).toHaveAttribute('aria-current', 'page')

    await tabs.getByRole('link', { name: 'Courses' }).click()
    await expect(page).toHaveURL(/\/courses$/)
    await expect(tabs.getByRole('link', { name: 'Courses' })).toHaveAttribute('aria-current', 'page')

    await tabs.getByRole('link', { name: 'Me' }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(tabs.getByRole('link', { name: 'Me' })).toHaveAttribute('aria-current', 'page')
  })

  test('a nested route offers Back to its section root', async ({ page, supabase }) => {
    await supabase.signIn()
    await page.goto('/practice/history')

    await expect(headerTitle(page, 'History')).toBeVisible()

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page).toHaveURL(/\/practice$/)
    await expect(headerTitle(page, 'Play')).toBeVisible()
  })

  test('the notification sheet opens as a modal dialog and closes again', async ({ signedInPage: page }) => {
    await page.getByRole('button', { name: 'Notifications' }).click()

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet).toHaveAttribute('aria-modal', 'true')
    await expect(sheet.getByRole('heading', { name: 'Notifications' })).toBeVisible()

    await sheet.getByRole('button', { name: 'Close Notifications' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    // The shell underneath must be interactive again, not left aria-hidden.
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  })

  // D-09: the header bell opened a sheet, and nothing in the app ever
  // navigated to the `/notifications` route it was paired with — reachable
  // only by typed URL or bookmark. The sheet now offers a real link to it.
  test('the notification sheet has a working link to the full notifications page', async ({ signedInPage: page }) => {
    await page.getByRole('button', { name: 'Notifications' }).click()

    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'See all notifications' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/notifications$/)
    await expect(headerTitle(page, 'Notifications')).toBeVisible()
  })

  test('tapping the active tab scrolls its section back to the top', async ({ page, supabase }) => {
    // The Play hub is only tall enough to scroll once it has routines to list,
    // so the fixture supplies enough to overflow a phone viewport.
    supabase.setTable(
      'putting_regimens',
      Array.from({ length: 12 }, (_, index) => ({
        id: `00000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`,
        user_id: null,
        name: `Fixture Regimen ${index + 1}`,
        description: 'Seeded so the scroll region has something to scroll.',
        difficulty: (index % 5) + 1,
        base_points_per_make: 10,
        streak_step: 0.1,
        no_miss_bonus_pct: 0.2,
        completion_bonus: 50,
      })),
    )
    await supabase.signIn()
    await page.goto('/practice')

    const region = page.locator('main.screen-scroll-region')
    await expect(region).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fixture Regimen 1', exact: true })).toBeVisible()

    await region.evaluate((element) => element.scrollTo({ top: 400, behavior: 'instant' }))
    await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

    // Tapping the tab you are already on is a scroll-to-top gesture, not a
    // navigation — the URL must not change.
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Play' }).click()

    await expect(page).toHaveURL(/\/practice$/)
    await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBe(0)
  })

  test('the tab bar is reachable and operable by keyboard', async ({ signedInPage: page }) => {
    const discsTab = page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Discs' })

    await discsTab.focus()
    await expect(discsTab).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/bag$/)
  })

  test('a reload restores the same authenticated screen rather than the splash', async ({ signedInPage: page }) => {
    await page.goto('/practice/history')
    await expect(headerTitle(page, 'History')).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL(/\/practice\/history$/)
    await expect(headerTitle(page, 'History')).toBeVisible()
  })
})
