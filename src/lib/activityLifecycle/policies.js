export const BACKGROUND_AUTO_PAUSE_GRACE_MS = 60_000
export const MEANINGFUL_DRAFT_RETENTION_DAYS = 7
export const RECENTLY_DELETED_VISIBILITY_DAYS = 30

export function shouldAutoPause({ backgroundedAtMs, nowMs }) {
  if (!Number.isFinite(backgroundedAtMs) || !Number.isFinite(nowMs)) return false
  return nowMs - backgroundedAtMs >= BACKGROUND_AUTO_PAUSE_GRACE_MS
}

export function canUndoReplacement({ replacementHasMeaningfulFact }) {
  return replacementHasMeaningfulFact === false
}
