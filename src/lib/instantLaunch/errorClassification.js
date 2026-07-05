// Distinguishes "retrying the exact same payload will never succeed"
// (permanent — a Postgres constraint violation, or an HTTP 4xx) from
// "this will probably work if we try again" (transient — network failure,
// 5xx). Feeds the sync scheduler's FAILED-vs-ERROR_RETRYING split.
const PERMANENT_POSTGRES_CODES = new Set([
  '23505', // unique_violation
  '23514', // check_violation
  '23503', // foreign_key_violation
  '22P02', // invalid_text_representation
])

export function isPermanentError(error) {
  if (!error) return false
  if (error.code && PERMANENT_POSTGRES_CODES.has(error.code)) return true
  if (typeof error.status === 'number' && error.status >= 400 && error.status < 500) return true
  return false
}
