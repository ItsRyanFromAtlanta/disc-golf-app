// A disc copy's effective flight numbers: a per-copy override wins on each
// axis, otherwise the mold's stock number. Mirrors the DB model exactly
// (discs.override_{speed,glide,turn,fade} over disc_molds.{...}).
//
// Uses `??` (not `||`) deliberately: turn and fade of 0 are valid flight
// numbers, so a 0 override must win over the mold's stock rather than be
// treated as absent.
const AXES = ['speed', 'glide', 'turn', 'fade']

export function effectiveFlightNumbers(disc, mold) {
  const result = {}
  for (const axis of AXES) {
    const override = disc?.[`override_${axis}`]
    const stock = mold?.[axis]
    result[axis] = override ?? stock ?? null
  }
  return result
}

// discs.role enforces "one primary_putter per user" via a partial unique
// index (mirrors bags' one-default-per-user rule), so promoting a new primary
// requires unsetting the old one first. Pure selection logic, same shape as
// bagIdsToUnsetForNewDefault.
export function discIdsToUnsetForNewPrimary(discs, targetDiscId) {
  return discs.filter((d) => d.role === 'primary_putter' && d.id !== targetDiscId).map((d) => d.id)
}

// situational_weather has no DB constraint (unlike primary_putter) -- capped
// app-side at 3 per the Screen 6 blueprint's swimlane limit.
export const SITUATIONAL_ROLE_CAP = 3

export function situationalRoleCount(discs, excludeDiscId = null) {
  return discs.filter((d) => d.role === 'situational_weather' && d.id !== excludeDiscId).length
}
