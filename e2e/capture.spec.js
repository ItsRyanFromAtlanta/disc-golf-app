import { test, expect, buildPuttSession } from './fixtures/app'

// Live-capture lifecycle coverage — the PHASE_A_ARCHITECTURE.md § 9 rows that
// a seeded row could never reach. Auto-close, round confirmation, and outbox
// reconnect only happen when a real start command runs through
// `activityRepository`, so every spec here drives the freeform capture screen
// through its own UI and then reads back what that produced.
//
// The reads are split deliberately:
//   * the Dexie mirror for the parts of the contract that are never rendered —
//     a state event's reason, which activity is current, whether the outbox
//     drained;
//   * `supabase.writes` for what actually left the device, which is the only
//     way to tell a flushed operation from a duplicated one.

const PREVIOUS_PRACTICE_ID = '00000000-0000-4000-8000-0000000000a5'
const ACTIVE_ROUND_ID = '00000000-0000-4000-8000-0000000000d1'

const CURRENT_STATES = ['active', 'paused']

/**
 * Drives the freeform launcher into a live capture session. This is the only
 * way to reach `planActivityStart` from a browser: the start command is issued
 * by `useInstantLaunchSession` → `mirrorInstantLaunchActivity`, never by a
 * route or a seeded row.
 */
async function startFreeformCapture(page) {
  await page.goto('/practice/freeform')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('button', { name: 'Made' })).toBeVisible()
}

async function localActivities(supabase) {
  return supabase.readLocalRows('activities')
}

/**
 * Waits for the start command to settle. The capture screen renders as soon as
 * the FSM flips, while mirroring and the outbox flush run behind it — so
 * without this a spec reads the mirror mid-flight. The create RPC only leaves
 * the device once the whole start decision has been made (the flush awaits the
 * mirror), and an empty outbox means nothing is still in flight.
 */
async function waitForCaptureSync(supabase) {
  await expect.poll(() => supabase.writesTo('rpc:activity_create_draft').length).toBe(1)
  await expect.poll(async () => (await supabase.readLocalRows('outbox')).length).toBe(0)
}

async function stateEventsFor(supabase, activityId) {
  const events = await supabase.readLocalRows('activityStateEvents')
  return events.filter((event) => event.activity_id === activityId)
}

test.describe('single-active auto-close', () => {
  test('starting a practice closes the current one as incomplete', async ({ page, supabase }) => {
    supabase.stubActivityRpcs()
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await supabase.seedLocalActivity({ id: PREVIOUS_PRACTICE_ID, state: 'paused', version: 3 })
    await page.reload()

    await startFreeformCapture(page)
    await waitForCaptureSync(supabase)

    // The invariant `requireSingleCurrent` enforces: whatever else happened,
    // exactly one activity is current afterwards, and it is the new one.
    const activities = await localActivities(supabase)
    expect(activities.filter((row) => CURRENT_STATES.includes(row.state))).toHaveLength(1)
    const previous = activities.find((row) => row.id === PREVIOUS_PRACTICE_ID)
    const started = activities.find((row) => row.id !== PREVIOUS_PRACTICE_ID)

    expect(previous.state).toBe('incomplete')
    expect(started.state).toBe('active')

    // Auto-close is a real lifecycle transition, not a silent field edit: it
    // appends an event carrying why the activity ended and which activity
    // replaced it.
    const [closeEvent] = await stateEventsFor(supabase, PREVIOUS_PRACTICE_ID)
    expect(closeEvent).toMatchObject({
      previous_state: 'paused',
      new_state: 'incomplete',
      reason: 'replaced_by_activity',
    })
    expect(closeEvent.metadata.replacementActivityId).toBe(started.id)

    // ...and the close reaches the backend as its own transition, ordered
    // before the start it made room for.
    const transitions = supabase.writesTo('rpc:activity_transition').map((write) => write.body)
    expect(transitions.map((body) => body.p_command)).toEqual(['mark_incomplete', 'start'])
    expect(transitions[0].p_activity_id).toBe(PREVIOUS_PRACTICE_ID)
    expect(transitions[0].p_reason).toBe('replaced_by_activity')
  })

  test('the auto-closed practice appears in History as incomplete', async ({ page, supabase }) => {
    supabase.stubActivityRpcs()
    // Only the typed practice row is seeded remotely. The activity itself is
    // deliberately absent from the `activities` fixture: the auto-close has not
    // been observed by the backend yet, so History has to render it from the
    // local mirror.
    supabase.setTable('putt_sessions', [buildPuttSession(PREVIOUS_PRACTICE_ID)])
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await supabase.seedLocalActivity({ id: PREVIOUS_PRACTICE_ID, state: 'paused', version: 3 })
    await page.reload()

    await startFreeformCapture(page)
    await waitForCaptureSync(supabase)

    // The session has to be finished before History can be reached by URL:
    // `useCrashRecoveryRedirect` sends any fresh page load back to the capture
    // screen while a capture buffer is live, which is the behaviour a
    // relaunched PWA depends on.
    await page.getByRole('button', { name: 'End session' }).click()
    await expect(page.getByRole('heading', { name: 'Freeform session complete!' })).toBeVisible()
    await page.goto('/practice/history')

    // No toast accompanies the auto-close. `AppShell` renders
    // `<ToastHost toast={null} />` unconditionally, so the "we closed your last
    // session" notice § 9 asks for does not exist yet — History is the only
    // place a replaced activity surfaces.
    const row = page.locator('.history-row').filter({ hasText: '7/10' })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Freeform')
    await expect(row).toContainText('Incomplete')
  })
})

test.describe('round-close confirmation', () => {
  test('starting a practice with a live round asks before closing it', async ({ page, supabase }) => {
    supabase.stubActivityRpcs()
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await supabase.seedLocalActivity({ id: ACTIVE_ROUND_ID, type: 'disc_golf_round', state: 'active', version: 1 })
    await page.reload()

    await page.goto('/practice/freeform')
    await page.getByRole('button', { name: 'Start' }).click()

    // The prompt stands in for the whole guarantee: nothing has moved yet.
    const dialog = page.getByRole('alertdialog', { name: 'Close your round first?' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Made' })).toHaveCount(0)

    // No draft was minted, the round is untouched, and nothing left the device.
    // The old behaviour created a draft here and walked the user into a live
    // capture canvas whose parent could never be finalized.
    const activities = await localActivities(supabase)
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({ id: ACTIVE_ROUND_ID, state: 'active', version: 1 })
    expect(await stateEventsFor(supabase, ACTIVE_ROUND_ID)).toEqual([])
    expect(supabase.writesTo('rpc:activity_transition')).toEqual([])
  })

  test('declining the prompt leaves the round running and starts nothing', async ({ page, supabase }) => {
    supabase.stubActivityRpcs()
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await supabase.seedLocalActivity({ id: ACTIVE_ROUND_ID, type: 'disc_golf_round', state: 'active', version: 1 })
    await page.reload()

    await page.goto('/practice/freeform')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.getByRole('button', { name: 'Keep playing my round' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Made' })).toHaveCount(0)

    const activities = await localActivities(supabase)
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({ id: ACTIVE_ROUND_ID, state: 'active', version: 1 })
  })

  test('confirming closes the round as incomplete and starts the practice', async ({ page, supabase }) => {
    // The branch that had no browser path at all before this: nothing in the
    // app ever passed `confirmRoundReplacement: true`, so the confirmed half of
    // the § 1 contract was unreachable and untested.
    supabase.stubActivityRpcs()
    await supabase.signIn()
    await page.goto('/practice')
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await supabase.seedLocalActivity({ id: ACTIVE_ROUND_ID, type: 'disc_golf_round', state: 'active', version: 1 })
    await page.reload()

    await page.goto('/practice/freeform')
    await page.getByRole('button', { name: 'Start' }).click()
    await page.getByRole('button', { name: 'Close round & start practice' }).click()

    await expect(page.getByRole('button', { name: 'Made' })).toBeVisible()
    await waitForCaptureSync(supabase)

    const activities = await localActivities(supabase)
    expect(activities).toHaveLength(2)
    const round = activities.find((row) => row.id === ACTIVE_ROUND_ID)
    const practice = activities.find((row) => row.id !== ACTIVE_ROUND_ID)

    // The round is closed as incomplete — kept and visible, not discarded —
    // and the practice is genuinely current rather than a stranded draft.
    expect(round).toMatchObject({ state: 'incomplete' })
    expect(practice).toMatchObject({ type: 'putting_freeform', state: 'active' })

    const roundEvents = await stateEventsFor(supabase, ACTIVE_ROUND_ID)
    expect(roundEvents.map((event) => event.reason)).toContain('round_replacement_confirmed')
  })
})

test.describe('pause and resume across navigation', () => {
  test('leaving the capture screen pauses the live activity and the pill resumes it', async ({
    page,
    supabase,
  }) => {
    supabase.stubActivityRpcs()
    await supabase.signIn()

    await startFreeformCapture(page)
    await page.getByRole('button', { name: 'Made' }).click()

    await page.getByRole('link', { name: 'Practice menu' }).click()
    await expect(page).toHaveURL(/\/practice$/)

    await expect
      .poll(async () => (await localActivities(supabase))[0]?.state)
      .toBe('paused')
    const [activity] = await localActivities(supabase)
    expect((await stateEventsFor(supabase, activity.id)).map((event) => event.reason)).toContain('navigation_away')

    await page.getByRole('banner').getByRole('link', { name: 'Resume active practice' }).click()
    await expect(page).toHaveURL(/\/practice\/freeform$/)

    await expect
      .poll(async () => (await localActivities(supabase))[0]?.state)
      .toBe('active')
    expect((await stateEventsFor(supabase, activity.id)).map((event) => event.reason)).toContain('user_resume')
  })
})

test.describe('offline outbox and reconnect', () => {
  // Real exponential backoff runs between the failed flush and the successful
  // one (2s for the first retry), so this test waits on wall clock rather than
  // on a mocked timer.
  test.slow()

  test('a capture session started offline reaches the backend exactly once', async ({
    page,
    supabase,
  }) => {
    supabase.stubActivityRpcs()
    await supabase.signIn()
    await page.goto('/practice/freeform')
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

    // The disconnect is route-level rather than `context.setOffline`, for two
    // reasons. An intercepted route is fulfilled in-process and never reaches
    // the network stack, so browser offline mode alone leaves every Supabase
    // call succeeding — aborting in the handler is what actually fails a write.
    // This spec reconnects by clearing the abort and letting the app's own
    // backoff retry drive, which is the shape a server-side outage has from the
    // client. The `online`-event path is a different reconnect shape and gets
    // its own spec below — it used to double-send every queued operation, and
    // that spec is what holds the fix in place.
    supabase.setOffline(true)

    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Made' })).toBeVisible()
    await page.getByRole('button', { name: 'Made' }).click()

    // The lifecycle operations queue locally and nothing escapes the device.
    // Waiting for a recorded failure rather than just for the rows keeps the
    // disconnect real: a flush has to have been attempted and lost, otherwise
    // the reconnect below would merely be the first successful attempt.
    await expect
      .poll(async () => {
        const rows = await supabase.readLocalRows('outbox')
        return { ops: rows.map((row) => row.op), attempted: (rows[0]?.attemptCount ?? 0) > 0 }
      })
      .toEqual({ ops: ['create_draft', 'transition'], attempted: true })
    expect(supabase.writes).toEqual([])

    supabase.setOffline(false)

    // Both queues drain on reconnect: the lifecycle outbox in Dexie first,
    // then the InstantLaunch capture queue that was held behind it.
    await expect
      .poll(async () => (await supabase.readLocalRows('outbox')).length, { timeout: 25_000 })
      .toBe(0)
    await expect
      .poll(async () => {
        const outbox = await supabase.readCaptureOutbox()
        return outbox.parentWrites.length + outbox.summaryWrites.length + outbox.puttEvents.length
      }, { timeout: 25_000 })
      .toBe(0)

    const [activity] = await localActivities(supabase)
    const puttEvents = supabase.writesTo('putt_events')
    expect(puttEvents).toHaveLength(1)

    // Every write that crossed the reconnect, counted by the identity it would
    // replay under. One entry each is the whole point: a retry loop that
    // re-sent an acknowledged row, or a scheduler that ran two flushes over
    // the same queue snapshot, would show up here as a 2.
    const expected = {
      [`rpc:activity_create_draft:instant-launch:${activity.id}:create`]: 1,
      [`rpc:activity_transition:instant-launch:${activity.id}:start`]: 1,
      // The capture queues are held behind the lifecycle drain (the A6 parent
      // foreign key), so they cross the reconnect too — each row upserting
      // under its own client-generated id.
      [`putt_sessions:${activity.id}`]: 1,
      [`putt_events:${puttEvents[0].body.id}`]: 1,
    }
    expect(supabase.writeCounts()).toEqual(expected)

    // A reload is the second chance to double-write: the page boots fresh, the
    // crash-recovery buffer still holds a live session, and the mirror
    // bootstrap re-runs against it. Nothing acknowledged may come back.
    //
    // Both queues are quiet before this point on purpose. Reloading with a
    // capture write still in flight legitimately resends it — that queue
    // acknowledges only after the round trip, and its protection is the
    // `on_conflict=id` upsert rather than an idempotency key — so a restart
    // mid-flight would be testing the wrong thing.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Made' })).toBeVisible()

    // One more putt after the restart forces a full flush cycle, so the counts
    // below describe a queue that was genuinely visited again rather than one
    // nobody looked at. Only that new row may appear.
    await page.getByRole('button', { name: 'Made' }).click()
    await expect.poll(() => supabase.writesTo('putt_events').length).toBe(2)

    const resumedEvent = supabase.writesTo('putt_events')[1].body
    expect(resumedEvent.id).not.toBe(puttEvents[0].body.id)
    expect(supabase.writeCounts()).toEqual({ ...expected, [`putt_events:${resumedEvent.id}`]: 1 })
  })

  test('an online-event reconnect does not double-send the queue', async ({ page, context, supabase }) => {
    // The regression this locks down: `handleOnline` used to call the flush
    // with no in-flight guard, so the browser's `online` event started a second
    // pass alongside the backoff retry already running. Both read the same
    // outbox snapshot and every queued operation went out twice — reproduced at
    // roughly one run in three before the fix in syncScheduler.js.
    //
    // Both layers of disconnect are needed to reproduce it. The route abort is
    // what actually fails a write (an intercepted route never reaches the
    // network stack, so browser offline mode alone leaves every call
    // succeeding), and browser offline mode is what makes restoring it fire the
    // `online` event at all.
    supabase.stubActivityRpcs()
    await supabase.signIn()
    await page.goto('/practice/freeform')
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

    supabase.setOffline(true)
    await context.setOffline(true)

    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Made' })).toBeVisible()
    await page.getByRole('button', { name: 'Made' }).click()

    await expect
      .poll(async () => {
        const rows = await supabase.readLocalRows('outbox')
        return { ops: rows.map((row) => row.op), attempted: (rows[0]?.attemptCount ?? 0) > 0 }
      })
      .toEqual({ ops: ['create_draft', 'transition'], attempted: true })
    expect(supabase.writes).toEqual([])

    // Order matters: clearing the route abort first means the `online` event
    // lands on a queue that can actually drain, which is exactly the race —
    // event-triggered flush and backoff retry live at the same moment.
    supabase.setOffline(false)
    await context.setOffline(false)

    await expect
      .poll(async () => (await supabase.readLocalRows('outbox')).length, { timeout: 25_000 })
      .toBe(0)
    await expect
      .poll(async () => {
        const outbox = await supabase.readCaptureOutbox()
        return outbox.parentWrites.length + outbox.summaryWrites.length + outbox.puttEvents.length
      }, { timeout: 25_000 })
      .toBe(0)

    const [activity] = await localActivities(supabase)
    const puttEvents = supabase.writesTo('putt_events')
    expect(puttEvents).toHaveLength(1)

    // Counted by replay identity. Before the fix these came back as 2s.
    expect(supabase.writeCounts()).toEqual({
      [`rpc:activity_create_draft:instant-launch:${activity.id}:create`]: 1,
      [`rpc:activity_transition:instant-launch:${activity.id}:start`]: 1,
      [`putt_sessions:${activity.id}`]: 1,
      [`putt_events:${puttEvents[0].body.id}`]: 1,
    })
  })
})
