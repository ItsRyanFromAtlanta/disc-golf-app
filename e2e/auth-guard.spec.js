import { test, expect } from './fixtures/app'

// The route guard is the cheapest thing to get wrong and the most expensive to
// get wrong: a regression here either dead-ends a signed-in user on the splash
// screen or leaks a protected screen to an anonymous one.

test.describe('authentication routing', () => {
  test('an unauthenticated visitor lands on the splash screen', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Disc Golf App' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Play instantly as guest/ })).toBeVisible()
  })

  test('an unauthenticated visitor is redirected away from a protected route', async ({ page }) => {
    await page.goto('/practice')

    await expect(page).toHaveURL(/\/login$/)
    // The shell must not have rendered even briefly behind the redirect.
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0)
  })

  test('a signed-in user is redirected from the splash route into the app', async ({ page, supabase }) => {
    await supabase.signIn()

    await page.goto('/')

    await expect(page).toHaveURL(/\/practice$/)
  })

  test('a signed-in user with no bags is routed to onboarding before the shell', async ({ page, supabase }) => {
    // useOnboardingGate treats zero bags as "never finished Screen 3".
    await supabase.signIn()
    supabase.setTable('bags', [])

    await page.goto('/practice')

    await expect(page).toHaveURL(/\/onboarding$/)
  })
})
