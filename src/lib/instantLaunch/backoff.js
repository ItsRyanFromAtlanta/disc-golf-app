// Exponential backoff for sync retries: 2s, 4s, 8s, ... capped at 60s.
// `attempt` is 0-based (first retry after a failure is attempt 0).
export function nextBackoffDelayMs(attempt, { baseMs = 2000, capMs = 60000 } = {}) {
  return Math.min(baseMs * 2 ** attempt, capMs)
}
