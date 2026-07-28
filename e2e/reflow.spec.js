import { test, expect } from './fixtures/app'

// Runs only in the `narrow-320` project (see playwright.config.js). 320px is
// the narrowest width the design system commits to, and horizontal scroll on a
// field screen is a real defect: it moves primary controls off-thumb.

const ROUTES = [
  { path: '/', name: 'splash', authenticated: false },
  { path: '/practice', name: 'play hub', authenticated: true },
  { path: '/bag', name: 'discs hub', authenticated: true },
  { path: '/courses', name: 'courses hub', authenticated: true },
  { path: '/profile', name: 'me hub', authenticated: true },
]

for (const route of ROUTES) {
  test(`${route.name} reflows at 320px without horizontal scroll`, async ({ page, supabase }) => {
    if (route.authenticated) await supabase.signIn()

    await page.goto(route.path)
    // Wait for real content rather than a bare navigation, so the measurement
    // is not taken against an empty document.
    await expect(page.locator('body')).not.toBeEmpty()

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        // Any single element wider than the viewport is the usual culprit, and
        // naming it makes the failure diagnosable without a screenshot.
        widest: [...document.querySelectorAll('*')]
          .map((element) => ({
            selector: element.tagName.toLowerCase() + (element.className ? `.${String(element.className).split(' ')[0]}` : ''),
            width: Math.round(element.getBoundingClientRect().width),
          }))
          .filter((entry) => entry.width > doc.clientWidth)
          .slice(0, 5),
      }
    })

    expect(
      overflow.scrollWidth,
      `${route.name} overflows 320px. Widest offenders: ${JSON.stringify(overflow.widest)}`,
    ).toBeLessThanOrEqual(overflow.clientWidth)
  })
}
