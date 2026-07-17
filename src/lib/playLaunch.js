export const DEFAULT_QUICK_PLAY_DIFFICULTY = 1

function launchable(regimen) {
  return Boolean(regimen?.id) && regimen.archived !== true
}

function difficulty(regimen) {
  const value = Number(regimen?.difficulty)
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

export function resolveQuickPlayRegimen(regimens = [], preferredRegimenId = null) {
  const available = regimens.filter(launchable)
  const preferred = preferredRegimenId
    ? available.find((regimen) => String(regimen.id) === String(preferredRegimenId))
    : null
  if (preferred) return { regimen: preferred, reason: 'profile-default' }

  const systemRegimens = available
    .filter((regimen) => regimen.user_id == null)
    .sort((left, right) => difficulty(left) - difficulty(right) || String(left.id).localeCompare(String(right.id)))
  const levelOne = systemRegimens.find((regimen) => difficulty(regimen) === DEFAULT_QUICK_PLAY_DIFFICULTY)
  if (levelOne) return { regimen: levelOne, reason: 'level-1' }
  if (systemRegimens[0]) return { regimen: systemRegimens[0], reason: 'lowest-system-level' }

  const fallback = [...available].sort(
    (left, right) => difficulty(left) - difficulty(right) || String(left.id).localeCompare(String(right.id)),
  )[0]
  return fallback ? { regimen: fallback, reason: 'first-available' } : { regimen: null, reason: 'unavailable' }
}

export function quickPlayOptions(regimens = []) {
  return regimens
    .filter(launchable)
    .sort((left, right) => {
      const systemOrder = Number(left.user_id != null) - Number(right.user_id != null)
      return systemOrder || difficulty(left) - difficulty(right) || String(left.name).localeCompare(String(right.name))
    })
}
