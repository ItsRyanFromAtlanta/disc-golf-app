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
