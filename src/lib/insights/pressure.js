// Pressure differential ("clutch factor"): pressure-putt make % minus
// regular make %. Both sides come from the same regimen sets, so the
// distances compared are inherently comparable — the pressure putt is the
// last attempt of a set thrown from the same range as the rest of that set.
export function pressureDifferential(runSets) {
  let pressureMakes = 0
  let pressureAttempts = 0
  let regularMakes = 0
  let regularAttempts = 0

  for (const s of runSets) {
    if (!s.attempts) continue
    pressureMakes += s.pressurePuttMade ? 1 : 0
    pressureAttempts += 1
    // The remaining attempts in the set are the "regular" putts.
    regularMakes += s.makes - (s.pressurePuttMade ? 1 : 0)
    regularAttempts += s.attempts - 1
  }

  const pressurePct = pressureAttempts > 0 ? pressureMakes / pressureAttempts : null
  const regularPct = regularAttempts > 0 ? regularMakes / regularAttempts : null

  return {
    pressurePct,
    regularPct,
    differential: pressurePct != null && regularPct != null ? pressurePct - regularPct : null,
    pressureN: pressureAttempts,
    regularN: regularAttempts,
  }
}
