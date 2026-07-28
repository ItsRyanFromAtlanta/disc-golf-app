import { test, expect } from './fixtures/app'

// The PWA half of the Phase A gate. The manifest tokens in particular were
// corrected by hand (commit af9a44e) after they had drifted to non-palette
// values; nothing was stopping them from drifting back.

// Sun-Drenched Topo: warm sand. The design system bans pure #FFF/#000, and
// background_color is the standalone splash backdrop, so a wrong value here
// flashes on every cold start of an installed app.
const WARM_SAND = '#F4F1EA'

test.describe('PWA shell', () => {
  test('serves a manifest carrying the design-system tokens', async ({ page, request }) => {
    await page.goto('/')

    const href = await page.getAttribute('link[rel="manifest"]', 'href')
    expect(href, 'index.html must link a web app manifest').toBeTruthy()

    const manifest = await (await request.get(href)).json()

    expect(manifest.theme_color).toBe(WARM_SAND)
    expect(manifest.background_color).toBe(WARM_SAND)
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    // A maskable icon is what keeps the installed icon from being letterboxed
    // inside a platform shape.
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })

  test('declares the theme color and safe-area viewport in the document head', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', WARM_SAND)
    // viewport-fit=cover is what makes env(safe-area-inset-*) report non-zero
    // on notched phones; the bottom tab bar's padding depends on it.
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
  })

  test('registers a service worker and boots the shell from precache while offline', async ({
    page,
    context,
    supabase,
  }) => {
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    // The worker registers on mount but deliberately does NOT call
    // clientsClaim (see vite.config.js — claiming mid-session could swap the
    // app out from under an active capture screen). So the first load is never
    // controlled: wait for activation, then reload once to come under control,
    // and only then cut the network.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
    await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 })

    await context.setOffline(true)
    try {
      await page.reload()

      // The document, JS, and CSS all have to come from the precache for this
      // to render at all with the network down.
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Play', exact: true, level: 1 })).toBeVisible()
    } finally {
      await context.setOffline(false)
    }
  })
})
