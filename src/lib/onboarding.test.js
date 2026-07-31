import { describe, it, expect, vi } from 'vitest'
import {
  pickDefaultMold,
  clampWeight,
  needsOnboarding,
  buildPutterDiscFields,
  buildProvisionArgs,
  isProvisioningRpcMissing,
  provisionPracticeStack,
  provisionPracticeStackFallback,
  isGoalColumnUnavailable,
  persistOnboardingGoal,
  MIN_WEIGHT_GRAMS,
  MAX_WEIGHT_GRAMS,
  DEFAULT_MOLD_NAME,
  PRACTICE_STACK_BAG_NAME,
  GOAL_OPTIONS,
} from './onboarding'

describe('pickDefaultMold', () => {
  it('prefers the named default mold when present', () => {
    const molds = [{ mold_name: 'Proxy' }, { mold_name: DEFAULT_MOLD_NAME }]
    expect(pickDefaultMold(molds).mold_name).toBe(DEFAULT_MOLD_NAME)
  })

  it('falls back to the first mold when the default is absent', () => {
    const molds = [{ mold_name: 'Proxy' }, { mold_name: 'Other' }]
    expect(pickDefaultMold(molds).mold_name).toBe('Proxy')
  })

  it('returns null for an empty or missing list', () => {
    expect(pickDefaultMold([])).toBeNull()
    expect(pickDefaultMold(null)).toBeNull()
  })
})

describe('clampWeight', () => {
  it('clamps below the minimum', () => {
    expect(clampWeight(MIN_WEIGHT_GRAMS - 10)).toBe(MIN_WEIGHT_GRAMS)
  })

  it('clamps above the maximum', () => {
    expect(clampWeight(MAX_WEIGHT_GRAMS + 10)).toBe(MAX_WEIGHT_GRAMS)
  })

  it('passes through an in-range value', () => {
    expect(clampWeight(174)).toBe(174)
  })
})

describe('needsOnboarding', () => {
  it('is true for a fresh account with no bags', () => {
    expect(needsOnboarding([])).toBe(true)
    expect(needsOnboarding(null)).toBe(true)
  })

  it('is false once any bag exists', () => {
    expect(needsOnboarding([{ id: 'a' }])).toBe(false)
  })
})

describe('buildPutterDiscFields', () => {
  it('shapes the provisioning payload with role=primary_putter', () => {
    expect(
      buildPutterDiscFields({ moldId: 'm1', manufacturer: 'Axiom', moldName: 'Envy', weightGrams: 174 }),
    ).toEqual({
      mold_id: 'm1',
      manufacturer: 'Axiom',
      mold: 'Envy',
      weight_grams: 174,
      role: 'primary_putter',
      status: 'in_locker',
    })
  })
})

// --- D-04 -------------------------------------------------------------------

const USER_ID = 'user-1'
const BAG_ID = 'bag-1'
const DISC_ID = 'disc-1'
const PUTTER = buildPutterDiscFields({
  moldId: 'm1',
  manufacturer: 'Axiom',
  moldName: 'Envy',
  weightGrams: 174,
})

const INPUT = { bagId: BAG_ID, bagName: PRACTICE_STACK_BAG_NAME, discId: DISC_ID, disc: PUTTER }

function pgError(code, message = code) {
  return Object.assign(new Error(message), { code })
}

/**
 * A stand-in for the three write helpers, backed by a tiny in-memory model of
 * the constraints that actually bite: `bags_one_default_per_user` and
 * `bag_discs`'s `unique (bag_id, disc_id)`. `failOn` fails the named step once,
 * which is how the partial-failure-then-retry case is staged.
 */
function makeApi({ failOn = null } = {}) {
  const state = { bags: [], discs: [], memberships: [] }
  const failed = new Set()

  function maybeFail(step) {
    if (failOn === step && !failed.has(step)) {
      failed.add(step)
      throw new Error(`network lost during ${step}`)
    }
  }

  const api = {
    state,
    fetchBags: vi.fn(async () => state.bags.map((bag) => ({ ...bag }))),
    createBag: vi.fn(async (userId, fields) => {
      maybeFail('createBag')
      if (fields.is_default && state.bags.some((bag) => bag.user_id === userId && bag.is_default)) {
        throw pgError('23505', 'duplicate key value violates unique constraint "bags_one_default_per_user"')
      }
      const bag = { ...fields, id: fields.id ?? 'generated-bag', user_id: userId }
      state.bags.push(bag)
      return { ...bag }
    }),
    upsertDisc: vi.fn(async (userId, discId, fields) => {
      maybeFail('upsertDisc')
      const existing = state.discs.findIndex((disc) => disc.id === fields.id)
      const row = { ...fields, user_id: userId }
      if (existing >= 0) state.discs[existing] = row
      else state.discs.push(row)
      return { ...row }
    }),
    addDiscToBag: vi.fn(async (bagId, discId) => {
      maybeFail('addDiscToBag')
      if (state.memberships.some((m) => m.bagId === bagId && m.discId === discId)) {
        throw pgError('23505', 'duplicate key value violates unique constraint "bag_discs_bag_id_disc_id_key"')
      }
      state.memberships.push({ bagId, discId })
    }),
  }
  return api
}

describe('buildProvisionArgs', () => {
  it('names the RPC arguments and carries both client-generated ids', () => {
    expect(buildProvisionArgs(INPUT)).toEqual({
      p_bag_id: BAG_ID,
      p_bag_name: PRACTICE_STACK_BAG_NAME,
      p_disc_id: DISC_ID,
      p_disc: PUTTER,
    })
  })

  it('sends no disc id when no disc was chosen, so Skip Setup provisions the bag alone', () => {
    expect(buildProvisionArgs({ bagId: BAG_ID, discId: DISC_ID, disc: null })).toMatchObject({
      p_disc_id: null,
      p_disc: null,
    })
  })
})

describe('isProvisioningRpcMissing', () => {
  it.each(['PGRST202', '42883'])('recognises %s as the function not being deployed', (code) => {
    expect(isProvisioningRpcMissing(pgError(code))).toBe(true)
  })

  it('recognises a bare 404 from either the envelope or the error', () => {
    expect(isProvisioningRpcMissing(new Error('not found'), 404)).toBe(true)
    expect(isProvisioningRpcMissing(Object.assign(new Error('not found'), { status: 404 }))).toBe(true)
  })

  it('does not swallow a real failure — an RLS denial is not a missing function', () => {
    expect(isProvisioningRpcMissing(pgError('42501'), 403)).toBe(false)
    expect(isProvisioningRpcMissing(pgError('23505'), 409)).toBe(false)
    expect(isProvisioningRpcMissing(null)).toBe(false)
  })
})

describe('provisionPracticeStack', () => {
  it('takes the atomic path when the RPC is deployed, writing nothing directly', async () => {
    const api = makeApi()
    const rpc = vi.fn(async () => ({ bagId: BAG_ID, discId: DISC_ID, atomic: true }))
    const fallback = vi.fn(() => provisionPracticeStackFallback(USER_ID, INPUT, api))

    await expect(provisionPracticeStack(USER_ID, INPUT, { rpc, fallback })).resolves.toEqual({
      bagId: BAG_ID,
      discId: DISC_ID,
      atomic: true,
    })
    expect(fallback).not.toHaveBeenCalled()
    expect(api.createBag).not.toHaveBeenCalled()
  })

  it('falls back to the sequential path when the migration has not landed', async () => {
    const api = makeApi()
    const rpc = vi.fn(async () => null)

    const result = await provisionPracticeStack(USER_ID, INPUT, {
      rpc,
      fallback: (userId, input) => provisionPracticeStackFallback(userId, input, api),
    })

    expect(result).toEqual({ bagId: BAG_ID, discId: DISC_ID, atomic: false })
    expect(api.state.bags).toHaveLength(1)
    expect(api.state.memberships).toEqual([{ bagId: BAG_ID, discId: DISC_ID }])
  })
})

describe('provisionPracticeStackFallback', () => {
  it('provisions the bag, the putter and the membership on a clean run', async () => {
    const api = makeApi()
    const result = await provisionPracticeStackFallback(USER_ID, INPUT, api)

    expect(result).toEqual({ bagId: BAG_ID, discId: DISC_ID, atomic: false })
    expect(api.state.bags[0]).toMatchObject({ name: PRACTICE_STACK_BAG_NAME, is_default: true })
    expect(api.state.discs[0]).toMatchObject({ mold: 'Envy', role: 'primary_putter' })
    expect(api.state.memberships).toHaveLength(1)
  })

  it('provisions the bag alone when Skip Setup supplies no disc', async () => {
    const api = makeApi()
    const result = await provisionPracticeStackFallback(USER_ID, { ...INPUT, disc: null }, api)

    expect(result).toEqual({ bagId: BAG_ID, discId: null, atomic: false })
    expect(api.state.bags).toHaveLength(1)
    expect(api.upsertDisc).not.toHaveBeenCalled()
    expect(api.addDiscToBag).not.toHaveBeenCalled()
  })

  // The defect itself. Before D-04 the second attempt re-ran `createBag`
  // unconditionally and died on `bags_one_default_per_user`, leaving the user
  // with no way forward in place.
  it('converges when the disc write failed after the bag was already created', async () => {
    const api = makeApi({ failOn: 'upsertDisc' })

    await expect(provisionPracticeStackFallback(USER_ID, INPUT, api)).rejects.toThrow(/upsertDisc/)
    expect(api.state.bags).toHaveLength(1)
    expect(api.state.discs).toHaveLength(0)

    const result = await provisionPracticeStackFallback(USER_ID, INPUT, api)

    expect(result).toEqual({ bagId: BAG_ID, discId: DISC_ID, atomic: false })
    // The surviving bag was reused, not re-created: one bag, no unique violation.
    expect(api.state.bags).toHaveLength(1)
    expect(api.createBag).toHaveBeenCalledTimes(1)
    expect(api.state.discs).toHaveLength(1)
    expect(api.state.memberships).toEqual([{ bagId: BAG_ID, discId: DISC_ID }])
  })

  it('converges when the membership write failed after the bag and disc landed', async () => {
    const api = makeApi({ failOn: 'addDiscToBag' })

    await expect(provisionPracticeStackFallback(USER_ID, INPUT, api)).rejects.toThrow(/addDiscToBag/)
    expect(api.state.memberships).toHaveLength(0)

    const result = await provisionPracticeStackFallback(USER_ID, INPUT, api)

    expect(result).toEqual({ bagId: BAG_ID, discId: DISC_ID, atomic: false })
    expect(api.createBag).toHaveBeenCalledTimes(1)
    // The stable disc id sent the retry down `upsertDisc`'s onConflict branch
    // instead of minting a second physical putter.
    expect(api.state.discs).toHaveLength(1)
    expect(api.state.memberships).toEqual([{ bagId: BAG_ID, discId: DISC_ID }])
  })

  it('treats an already-present membership as success rather than an error', async () => {
    const api = makeApi()
    await provisionPracticeStackFallback(USER_ID, INPUT, api)

    await expect(provisionPracticeStackFallback(USER_ID, INPUT, api)).resolves.toEqual({
      bagId: BAG_ID,
      discId: DISC_ID,
      atomic: false,
    })
    expect(api.state.memberships).toHaveLength(1)
  })

  // `screens/onboarding.md` § 12 q3: re-entering the wizard after completing it
  // used to die at `Confirm & Continue` on the first run's bag.
  it('reuses the default bag a completed run already left behind', async () => {
    const api = makeApi()
    api.state.bags.push({ id: 'earlier-bag', user_id: USER_ID, name: PRACTICE_STACK_BAG_NAME, is_default: true })

    const result = await provisionPracticeStackFallback(USER_ID, INPUT, api)

    expect(result.bagId).toBe('earlier-bag')
    expect(api.createBag).not.toHaveBeenCalled()
    expect(api.state.memberships).toEqual([{ bagId: 'earlier-bag', discId: DISC_ID }])
  })

  it('still surfaces a membership failure that is not a duplicate', async () => {
    const api = makeApi()
    api.addDiscToBag = vi.fn(async () => {
      throw pgError('23514', 'Bag is at the 35-disc capacity limit')
    })

    await expect(provisionPracticeStackFallback(USER_ID, INPUT, api)).rejects.toThrow(/capacity/)
  })
})

// --- D-15 --------------------------------------------------------------------
// The onboarding Step-1 goal used to be captured, gated on, and discarded: no
// column, no write, anywhere. `persistOnboardingGoal` closes that with a plain
// `profiles.onboarding_goal` write — not a row in the Phase D3 `goals` table,
// whose measurable-target shape (`target_value`, `target_unit`, a
// create/pause/complete/cancel lifecycle) `GOAL_OPTIONS` never collects.

describe('isGoalColumnUnavailable', () => {
  it.each(['PGRST204', '42703', '42501'])(
    'recognises %s as the column or its grant not being deployed yet',
    (code) => {
      expect(isGoalColumnUnavailable(pgError(code))).toBe(true)
    },
  )

  it('does not swallow a real failure', () => {
    expect(isGoalColumnUnavailable(pgError('23505'))).toBe(false)
    expect(isGoalColumnUnavailable(pgError('28000'))).toBe(false)
    expect(isGoalColumnUnavailable(null)).toBe(false)
  })
})

describe('persistOnboardingGoal', () => {
  it('writes the chosen goal onto the profile via the existing upsert path', async () => {
    const upsertProfileFields = vi.fn(async (userId, fields) => ({ id: userId, ...fields }))

    const result = await persistOnboardingGoal(USER_ID, GOAL_OPTIONS[0].id, { upsertProfileFields })

    expect(upsertProfileFields).toHaveBeenCalledWith(USER_ID, { onboarding_goal: GOAL_OPTIONS[0].id })
    expect(result).toEqual({ id: USER_ID, onboarding_goal: GOAL_OPTIONS[0].id })
  })

  it('is a no-op that writes nothing when no goal was chosen', async () => {
    const upsertProfileFields = vi.fn()

    await expect(persistOnboardingGoal(USER_ID, null, { upsertProfileFields })).resolves.toBeNull()
    expect(upsertProfileFields).not.toHaveBeenCalled()
  })

  it('resolves quietly instead of throwing while the migration has not landed', async () => {
    const upsertProfileFields = vi.fn(async () => {
      throw pgError('PGRST204', 'column "onboarding_goal" of relation "profiles" does not exist')
    })

    await expect(
      persistOnboardingGoal(USER_ID, 'consistency', { upsertProfileFields }),
    ).resolves.toBeNull()
  })

  it('resolves quietly when the column exists but its grant has not landed yet', async () => {
    const upsertProfileFields = vi.fn(async () => {
      throw pgError('42501', 'permission denied for table profiles')
    })

    await expect(
      persistOnboardingGoal(USER_ID, 'consistency', { upsertProfileFields }),
    ).resolves.toBeNull()
  })

  it('still surfaces a genuine failure rather than swallowing it', async () => {
    const upsertProfileFields = vi.fn(async () => {
      throw pgError('28000', 'JWT expired')
    })

    await expect(persistOnboardingGoal(USER_ID, 'consistency', { upsertProfileFields })).rejects.toThrow(
      /JWT expired/,
    )
  })
})
