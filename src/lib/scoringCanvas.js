// Scoring Canvas (Screen 8) pure domain logic — no React, no Supabase.

// "Bag-to-Weather Auto-Suggest Engine": >15mph wind (any direction) or rain
// triggers a backup-putter swap suggestion. Threshold matches the blueprint's
// documented rule (MASTER_PROJECT_BLUEPRINT.md task 4.6).
export const WIND_SWAP_THRESHOLD_MPH = 15

// Returns the disc to suggest swapping to, or null when no suggestion applies
// (calm weather, no eligible backup, or the backup is already active).
export function suggestBackupSwap({ weatherCondition, windMph, discs, activePutterDiscId }) {
  const badWeather = weatherCondition === 'rain' || (windMph != null && windMph > WIND_SWAP_THRESHOLD_MPH)
  if (!badWeather) return null

  const backup = discs.find((d) => d.role === 'backup_putter' && d.id !== activePutterDiscId)
  return backup ?? null
}

// Visual stack tracker (◆/● pips): one entry per planned putt in the stage.
// Gesture-captured events (real per-putt outcomes) render their actual
// make/miss; batch-ribbon fills beyond that only ever contribute to the
// aggregate tally (data-split rule — see BatchRibbon.jsx), so those pips
// render as 'filled' with no make/miss claim. Anything beyond the current
// tally is still 'pending'. The last pip is flagged `bonus` when the stage
// has a pressure putt (blueprint's diamond marker) — the engine has no
// per-stage "first putt" bonus (see routineBuilder.js's scoring-model
// mapping), so only the last slot is ever marked.
export function stackPips(volumePlanned, events, attemptsTotal, hasPressureLast = false) {
  const pips = []
  for (let i = 0; i < volumePlanned; i++) {
    let state
    if (i < events.length) state = events[i].outcome // 'make' | 'miss'
    else if (i < attemptsTotal) state = 'filled'
    else state = 'pending'
    pips.push({ state, bonus: hasPressureLast && i === volumePlanned - 1 })
  }
  return pips
}
