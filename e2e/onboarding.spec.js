import { test, expect, TEST_BAG } from './fixtures/app'

// PHASE_A_ARCHITECTURE.md § 9, "Onboarding / Quick Play".
//
// The redirect *into* the wizard was already covered by `auth-guard.spec.js`;
// what had never been exercised is the wizard itself and the Quick Play launch
// on the other side of it. Both are first-run paths, which is exactly the class
// of screen that rots unnoticed — nobody on the team ever sees them again.
//
// The wizard is asserted through what it *provisions*, not just what it draws.
// Its whole job is to leave the account in a state the onboarding gate accepts:
// a Practice Stack bag plus (unless skipped) a primary putter in it. A wizard
// that rendered three pretty steps and wrote nothing would satisfy every
// text assertion and still trap the user in a redirect loop on next launch.

const AXIOM_PUTTERS = [
  {
    id: '00000000-0000-4000-8000-0000000000m1',
    manufacturer_id: null,
    manufacturer: 'Axiom',
    mold_name: 'Envy',
    category: 'putter',
    speed: 3,
    glide: 3,
    turn: 0,
    fade: 2,
    catalog_status: 'approved',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000000m2',
    manufacturer_id: null,
    manufacturer: 'Axiom',
    mold_name: 'Proxy',
    category: 'putter',
    speed: 3,
    glide: 3,
    turn: 0,
    fade: 1,
    catalog_status: 'approved',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

/**
 * A never-onboarded account: zero bags is the signal `needsOnboarding` reads,
 * and the catalog has to answer or Step 2 has no mold to select.
 *
 * `capture_bag_version` is stubbed because `addDiscToBag` calls it — an
 * unstubbed RPC answers 404 on purpose, which would surface as the step's error
 * message instead of advancing.
 */
async function startWizard(page, supabase) {
  supabase.setTable('bags', [])
  supabase.setTable('disc_molds', AXIOM_PUTTERS)
  supabase.setRpc('capture_bag_version', () => null)
  await supabase.signIn()
  await page.goto('/practice')
  await expect(page).toHaveURL(/\/onboarding$/)
}

/**
 * Reflects the bag the wizard just created back into the backend fixture.
 *
 * The route handler echoes writes rather than storing them, and `/onboarding`
 * lives outside `AppShell` — so finishing the wizard mounts the shell fresh and
 * re-runs `useOnboardingGate`, which would bounce the just-onboarded user
 * straight back to Step 1 against a `bags` table still reading empty.
 */
function backendNowHasTheBag(supabase) {
  supabase.setTable('bags', [TEST_BAG])
}

test.describe('onboarding wizard', () => {
  test('walks all three steps and provisions the bag, putter, and units', async ({ page, supabase }) => {
    await startWizard(page, supabase)

    // --- Step 1: goal -------------------------------------------------------
    await expect(page.getByRole('heading', { name: "What's your main focus?" })).toBeVisible()
    await expect(page.getByText('Step 1 of 3')).toBeVisible()

    // Continue is gated on a choice: the step has nothing to carry forward
    // until one is made, and a disabled button says so better than a no-op.
    const continueButton = page.getByRole('button', { name: 'Continue' })
    await expect(continueButton).toBeDisabled()

    await page.getByRole('button', { name: /Dial In Consistency/ }).click()
    await expect(continueButton).toBeEnabled()
    await continueButton.click()

    // --- Step 2: putter -----------------------------------------------------
    await expect(page.getByRole('heading', { name: 'Select your primary putter' })).toBeVisible()
    await expect(page.getByText('Step 2 of 3')).toBeVisible()

    // The catalog drives the mold list, and `pickDefaultMold` preselects Envy
    // (DEFAULT_MOLD_NAME) rather than leaving the stepper with nothing chosen.
    await expect(page.getByRole('button', { name: /Envy/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Proxy/ })).toBeVisible()
    await expect(page.getByText('174g')).toBeVisible()

    await page.getByRole('button', { name: '+', exact: true }).click()
    await expect(page.getByText('175g')).toBeVisible()

    await page.getByRole('button', { name: 'Confirm & Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Sensory calibration' })).toBeVisible()
    backendNowHasTheBag(supabase)

    // What Step 2 actually did. `is_default` matters as much as the name: the
    // gate only needs a bag to exist, but everything downstream (Quick Play,
    // round start) reaches for the default one.
    const [bagWrite] = supabase.writesTo('bags')
    expect(bagWrite.body).toMatchObject({ name: 'Practice Stack', is_default: true })

    const [discWrite] = supabase.writesTo('discs')
    expect(discWrite.body).toMatchObject({
      mold: 'Envy',
      manufacturer: 'Axiom',
      weight_grams: 175,
      role: 'primary_putter',
      status: 'in_locker',
    })
    expect(supabase.writesTo('bag_discs')).toHaveLength(1)

    // --- Step 3: calibration ------------------------------------------------
    await expect(page.getByText('Step 3 of 3')).toBeVisible()
    // The haptic pad is a real control, not decoration: a browser without
    // vibration still has to be able to press it and be told so honestly.
    await page.getByRole('button', { name: /Tap to test scoring pulse/ }).click()

    const meters = page.getByRole('button', { name: 'Meters' })
    await meters.click()
    await expect(meters).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Finish' }).click()

    // Finishing lands in the app rather than looping back through the gate.
    await expect(page).toHaveURL(/\/practice$/)
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    const [profileWrite] = supabase.writesTo('profiles')
    expect(profileWrite.body).toMatchObject({ units: 'meters' })
  })

  test('skipping the putter still provisions the bag the gate reads', async ({ page, supabase }) => {
    // The loop-forever case. "Skip setup" is allowed to skip the *putter*, but
    // it may not skip the Practice Stack bag — that bag's existence is the only
    // record that this user was ever onboarded, so skipping it would send them
    // back through the wizard on every launch.
    await startWizard(page, supabase)

    await page.getByRole('button', { name: /Bag Management/ }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByRole('heading', { name: 'Select your primary putter' })).toBeVisible()
    await page.getByRole('button', { name: /Skip setup/ }).click()

    await expect(page.getByRole('heading', { name: 'Sensory calibration' })).toBeVisible()
    backendNowHasTheBag(supabase)

    const [bagWrite] = supabase.writesTo('bags')
    expect(bagWrite.body).toMatchObject({ name: 'Practice Stack', is_default: true })
    // ...and nothing else: skipping means no disc was invented on the user's
    // behalf, which is the difference between "skip" and "accept the default".
    expect(supabase.writesTo('discs')).toEqual([])
    expect(supabase.writesTo('bag_discs')).toEqual([])

    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page).toHaveURL(/\/practice$/)
  })
})

// --- Quick Play --------------------------------------------------------------
//
// Quick Play is the Play hub's one-tap launch. `resolveQuickPlayRegimen` is
// unit-tested in `src/lib/playLaunch.test.js`; what only a browser shows is that
// the card the athlete sees, the device-local default they pick, and the route
// the button actually goes to are all the same regimen.

const REGIMEN_IDS = {
  levelOne: '00000000-0000-4000-8000-0000000000r1',
  levelThree: '00000000-0000-4000-8000-0000000000r3',
}

// Ordered with the Level 1 regimen first on purpose: the fixture backend does
// not evaluate PostgREST filters, so `.eq('id', …).single()` returns the first
// seeded row. Any assertion about *which* regimen was launched therefore has to
// be made on the URL, which is genuinely resolved by the app.
const REGIMENS = [
  {
    id: REGIMEN_IDS.levelOne,
    user_id: null,
    name: 'Foundation Ladder',
    description: 'Warm-up ladder from 10 to 20 feet.',
    difficulty: 1,
    base_points_per_make: 10,
    streak_step: 0.1,
    no_miss_bonus_pct: 0.2,
    completion_bonus: 50,
    archived: false,
  },
  {
    id: REGIMEN_IDS.levelThree,
    user_id: null,
    name: 'Circle Two Grind',
    description: 'Long-range volume.',
    difficulty: 3,
    base_points_per_make: 10,
    streak_step: 0.1,
    no_miss_bonus_pct: 0.2,
    completion_bonus: 50,
    archived: false,
  },
]

const REGIMEN_SETS = [
  {
    id: '00000000-0000-4000-8000-0000000000s1',
    regimen_id: REGIMEN_IDS.levelOne,
    set_order: 1,
    distance_feet_min: 10,
    distance_feet_max: 10,
    reps_required: 10,
    pressure_multiplier: 1,
  },
]

async function openPlayHub(page, supabase) {
  supabase.setTable('putting_regimens', REGIMENS)
  supabase.setTable('putting_regimen_sets', REGIMEN_SETS)
  await supabase.signIn()
  await page.goto('/practice')
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
}

const quickPlayCard = (page) => page.locator('.quick-play-card')

test.describe('Quick Play', () => {
  test('launches the Level 1 system regimen with no configuration', async ({ page, supabase }) => {
    await openPlayHub(page, supabase)

    // Zero-configuration is the contract: a user who has never chosen anything
    // gets the Level 1 system regimen, named on the card so the one-tap launch
    // is not a surprise.
    const card = quickPlayCard(page)
    await expect(card.getByRole('heading', { name: 'Quick Play' })).toBeVisible()
    await expect(card).toContainText('Foundation Ladder')

    await card.getByRole('link', { name: 'Start Quick Play' }).click()

    await expect(page).toHaveURL(new RegExp(`/practice/regimens/${REGIMEN_IDS.levelOne}/run$`))
    // ...and it lands on a run screen that is ready to start, not an error or a
    // spinner: the launch is only worth anything if the next tap is Start.
    await expect(page.getByRole('heading', { name: 'Foundation Ladder' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  })

  test('the device-local default changes what the one tap launches, and survives a reload', async ({
    page,
    supabase,
  }) => {
    await openPlayHub(page, supabase)

    const card = quickPlayCard(page)
    await card.getByLabel('Default on this device').selectOption(REGIMEN_IDS.levelThree)
    await expect(card).toContainText('Circle Two Grind')

    // The preference lives in the InstantLaunch profile defaults, which is
    // localStorage — so it has to outlive a page load without a network read.
    await page.reload()
    await expect(quickPlayCard(page)).toContainText('Circle Two Grind')

    await quickPlayCard(page).getByRole('link', { name: 'Start Quick Play' }).click()
    await expect(page).toHaveURL(new RegExp(`/practice/regimens/${REGIMEN_IDS.levelThree}/run$`))
  })

  test('offers no launch at all when there is no routine to launch', async ({ page, supabase }) => {
    // The honest empty state. The button used to be a link either way, which
    // would have routed to `/practice/regimens/undefined/run`.
    supabase.setTable('putting_regimens', [])
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    const card = quickPlayCard(page)
    await expect(card).toContainText('No routine available')
    await expect(card.getByRole('link', { name: 'Start Quick Play' })).toHaveCount(0)
    await expect(card.getByText('Quick Play unavailable')).toHaveAttribute('aria-disabled', 'true')
  })
})
