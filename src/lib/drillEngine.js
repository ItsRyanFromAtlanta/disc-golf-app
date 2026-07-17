export const DRILL_TYPES = Object.freeze({
  FIXED_SET: 'fixed_set',
  CUSTOM: 'custom',
  JYLY: 'jyly',
  AROUND_THE_WORLD: 'around_the_world',
})

const SUPPORTED_VERSION = 1

export function drillKind(regimen) {
  return regimen?.drill_type || DRILL_TYPES.FIXED_SET
}

export function validateDrillConfig(regimen, sets) {
  const kind = drillKind(regimen)
  if (!Array.isArray(sets) || sets.length === 0) return { valid: false, reason: 'A drill needs at least one station.' }
  if (![DRILL_TYPES.JYLY, DRILL_TYPES.AROUND_THE_WORLD].includes(kind)) return { valid: true, kind }

  const config = regimen?.rules_config
  if (!config || config.version !== SUPPORTED_VERSION || config.kind !== kind) {
    return { valid: false, reason: 'This drill uses an unsupported rules version.' }
  }
  if (kind === DRILL_TYPES.JYLY && sets.reduce((sum, set) => sum + set.reps_required, 0) !== 100) {
    return { valid: false, reason: 'JYLY must contain exactly 100 planned putts.' }
  }
  if (kind === DRILL_TYPES.AROUND_THE_WORLD) {
    if (!sets.every((set) => set.reps_required === 1)) {
      return { valid: false, reason: 'Around the World stations must contain one putt each.' }
    }
    if (!Number.isInteger(config.max_attempts) || config.max_attempts < sets.length || config.max_attempts > 100) {
      return { valid: false, reason: 'Around the World needs a maximum of 10–100 attempts.' }
    }
  }
  return { valid: true, kind }
}

export function scoreDrillStage(regimen, stageResult, fallbackScore) {
  const kind = drillKind(regimen)
  if ([DRILL_TYPES.JYLY, DRILL_TYPES.AROUND_THE_WORLD].includes(kind)) {
    return { points: stageResult.makes, cleanSet: stageResult.attempts > 0 && stageResult.makes === stageResult.attempts }
  }
  return fallbackScore()
}

export function nextDrillStage({ regimen, currentIndex, setCount, makes, attemptsSoFar }) {
  const kind = drillKind(regimen)
  if (kind !== DRILL_TYPES.AROUND_THE_WORLD) {
    return currentIndex >= setCount - 1
      ? { completed: true, exhausted: false, nextIndex: null }
      : { completed: false, exhausted: false, nextIndex: currentIndex + 1 }
  }

  const maxAttempts = regimen.rules_config.max_attempts
  if (makes > 0 && currentIndex === setCount - 1) {
    return { completed: true, exhausted: false, nextIndex: null }
  }
  if (attemptsSoFar >= maxAttempts) {
    return { completed: false, exhausted: true, nextIndex: null }
  }
  return {
    completed: false,
    exhausted: false,
    nextIndex: makes > 0 ? currentIndex + 1 : Math.max(0, currentIndex - 1),
  }
}

export function drillGroupLabel(regimen) {
  switch (drillKind(regimen)) {
    case DRILL_TYPES.JYLY:
    case DRILL_TYPES.AROUND_THE_WORLD:
      return 'Classic drills'
    case DRILL_TYPES.CUSTOM:
      return 'Custom routines'
    default:
      return 'Scored regimens'
  }
}
