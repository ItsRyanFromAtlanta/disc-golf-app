import { test, expect } from './fixtures/app'

// PHASE_A_ARCHITECTURE.md § 9, "Keyboard / gesture alternatives".
//
// The tab bar half of that row was already covered (`shell.spec.js`). This is
// the gesture half, and it starts from an inventory rather than a guess: the
// only pointer-event surfaces in the app are
//
//   1. `GestureZone`   — swipe up = make, swipe down = miss, swipe left = undo,
//                        press-and-hold = rapid-fire makes  (input mode Gesture)
//   2. `PanicZone`     — tap = made, press-and-hold = missed (input mode Panic)
//   3. sheet backdrops — `onPointerDown` to dismiss
//
// (3) is a plain tap rather than a path gesture, and both instances already have
// an explicit button: `SheetHost`'s "Close …" is asserted in `shell.spec.js` and
// the round-replacement dialog's "Keep playing my round" in `capture.spec.js`.
// So this file covers (1) and (2), and does it the only way that means
// anything: it never performs a gesture. Every putt logged below is logged
// through a control, and the tally in the context bar is read back to prove the
// alternative did the same work the gesture would have.
//
// Capture mode itself is the outermost alternative — Tap is the default and the
// mode switch is reachable from inside every mode — so the switch is exercised
// by keyboard, not by click, because a mode picker that needed a pointer would
// strand a keyboard user in whichever mode they landed in.

/** The context bar's `makes/attempts of volume` readout — the shared oracle. */
const tally = (page) => page.locator('.canvas-volume')

const modeChip = (page, label) => page.getByRole('button', { name: label, exact: true })

async function startFreeformCapture(page, supabase) {
  supabase.stubActivityRpcs()
  await supabase.signIn()
  await page.goto('/practice/freeform')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('button', { name: 'Made' })).toBeVisible()
  await expect(tally(page)).toHaveText('0/0 of 10')
}

/** Moves to an input mode using only the keyboard. */
async function switchModeByKeyboard(page, label) {
  const chip = modeChip(page, label)
  await chip.focus()
  await expect(chip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
}

test.describe('gesture alternatives', () => {
  test('every capture mode is reachable from every other, by keyboard alone', async ({ page, supabase }) => {
    // The escape hatch the other tests lean on. Gesture and Panic are opt-in
    // modes; the thing that keeps them from being a trap is that the picker
    // stays on screen inside them and is operable without a pointer.
    await startFreeformCapture(page, supabase)

    await expect(modeChip(page, 'Tap')).toHaveAttribute('aria-pressed', 'true')

    await switchModeByKeyboard(page, 'Gesture')
    await expect(page.getByRole('button', { name: 'Made' })).toHaveCount(0)

    await switchModeByKeyboard(page, 'Panic')
    await switchModeByKeyboard(page, 'Tap')
    await expect(page.getByRole('button', { name: 'Made' })).toBeVisible()
  })

  test('tap mode logs a make and a miss without any gesture', async ({ page, supabase }) => {
    // The default mode, and the alternative that swipe-up/swipe-down resolve to.
    await startFreeformCapture(page, supabase)

    await page.getByRole('button', { name: 'Made' }).click()
    await expect(tally(page)).toHaveText('1/1 of 10')

    await page.getByRole('button', { name: 'Missed' }).click()
    await expect(tally(page)).toHaveText('1/2 of 10')
  })

  test('gesture mode keeps an explicit Undo button beside the swipe', async ({ page, supabase }) => {
    // Swipe-left = undo is the one gesture with a button twin in the zone
    // itself. Both activations are asserted because they used to disagree: the
    // button worked by keyboard and did nothing at all under a thumb, since the
    // zone captured the pointer and the browser dispatched the click to the
    // zone instead. Tapping it is the activation the field actually uses, so a
    // keyboard-only check would have declared this row covered while the button
    // was dead. Fixed in `useGesturePointer.js`.
    await startFreeformCapture(page, supabase)
    await page.getByRole('button', { name: 'Made' }).click()
    await page.getByRole('button', { name: 'Made' }).click()
    await expect(tally(page)).toHaveText('2/2 of 10')

    await switchModeByKeyboard(page, 'Gesture')

    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    await expect(undo).toBeVisible()

    await undo.click()
    await expect(tally(page)).toHaveText('1/1 of 10')

    await undo.focus()
    await page.keyboard.press('Enter')
    await expect(tally(page)).toHaveText('0/0 of 10')
  })

  test('the swipe surface still classifies a real gesture', async ({ page, supabase }) => {
    // The guard that revived the Undo button skips any press starting on a
    // control inside the zone. This is what keeps that from having quietly
    // disabled the swipe surface it sits on: a genuine swipe-up on the zone
    // itself must still log a make. Thresholds are GESTURE_CONFIG's —
    // TRAVEL_PX 120 within VELOCITY_MS 350, inside a 45-degree cone.
    await startFreeformCapture(page, supabase)
    await switchModeByKeyboard(page, 'Gesture')

    const zone = page.locator('.gesture-zone')
    const box = await zone.boundingBox()
    const x = box.x + box.width / 2

    await page.mouse.move(x, box.y + box.height - 10)
    await page.mouse.down()
    await page.mouse.move(x, box.y + box.height - 90, { steps: 4 })
    await page.mouse.move(x, box.y + 10, { steps: 4 })
    await page.mouse.up()

    await expect(tally(page)).toHaveText('1/1 of 10')
  })

  test('gesture mode has a working non-gesture path back to logging putts', async ({ page, supabase }) => {
    // Swipe-up and swipe-down have no in-zone button — the Make/Miss areas are
    // `aria-hidden` visual territory, not targets. Their alternative is the mode
    // switch, so this asserts the whole round trip: leave Gesture by keyboard,
    // land on controls that actually record.
    await startFreeformCapture(page, supabase)
    await switchModeByKeyboard(page, 'Gesture')

    await switchModeByKeyboard(page, 'Tap')
    await page.getByRole('button', { name: 'Made' }).click()

    await expect(tally(page)).toHaveText('1/1 of 10')
  })

  test('panic mode logs a make by keyboard and a miss without a timed hold', async ({ page, supabase }) => {
    // Both halves of this used to be unreachable without a pointer: the zone
    // was a bare <div>, so nothing here was focusable, and "hold = missed" had
    // no equivalent control anywhere. Fixed in `PanicZone.jsx`.
    await startFreeformCapture(page, supabase)
    await switchModeByKeyboard(page, 'Panic')

    const surface = page.getByRole('button', { name: /Tap = Made/ })
    await surface.focus()
    await expect(surface).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(tally(page)).toHaveText('1/1 of 10')

    // ...and the miss, from a single activation rather than a half-second press.
    const missed = page.getByRole('button', { name: 'Missed', exact: true })
    await expect(missed).toBeVisible()
    await missed.click()
    await expect(tally(page)).toHaveText('1/2 of 10')
  })

  test('a panic-mode hold still logs exactly one miss and no make', async ({ page, supabase }) => {
    // The gesture itself has to keep working, and the click that follows a
    // completed hold must not also register as a tap. That suppression is the
    // one behavioural risk in making the surface a real button.
    await startFreeformCapture(page, supabase)
    await switchModeByKeyboard(page, 'Panic')

    const surface = page.getByRole('button', { name: /Tap = Made/ })
    const box = await surface.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    // LONG_PRESS_MS is 500; hold past it, then release.
    await page.waitForTimeout(900)
    await page.mouse.up()

    await expect(tally(page)).toHaveText('0/1 of 10')
  })
})
