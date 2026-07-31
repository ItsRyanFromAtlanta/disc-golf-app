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

// "The migration behind this write has not landed yet."
//
// `main` auto-deploys, and a migration cannot ride in the same atomic step as
// the client that calls it, so there is always a window where the code is live
// and the schema is not. PostgREST answers these with a 4xx, which
// `isPermanentError` would otherwise read as permanent and poison a write that
// was about to start working. These must stay transient: the queued write should
// wait for the migration rather than give up on it.
const DEPLOY_LAG_CODES = new Set([
  'PGRST202', // function not found in the schema cache
  // Column not found in the schema cache. The additive-column half of the same
  // window the other four cover, and the one this project hits most: a client
  // that writes a column its migration has not added yet (E2 round weather is
  // the current example) answers 400/PGRST204 on every write until the
  // migration lands. Poisoning there would discard a round for a deploy
  // ordering that resolves itself.
  'PGRST204',
  'PGRST205', // table not found in the schema cache
  '42883', // undefined_function
  '42P01', // undefined_table
  '42703', // undefined_column — the Postgres-side spelling of PGRST204
])

// The two deploy-lag codes that specifically mean "this TABLE is not deployed
// yet", as opposed to a column or a function.
//
// Exported as a predicate rather than exporting the set, so the rule stays in
// one place: a read path that wants to degrade — render "not available on this
// deployment" instead of an error — asks this, and a write path that wants to
// keep waiting gets the same answer from `isPermanentError` returning false for
// the same codes. Callers must not re-spell the codes; the E2 audit's finding 9
// is what happens when a classification rule exists in more than one copy.
const MISSING_RELATION_CODES = new Set([
  'PGRST205', // table not found in the schema cache
  '42P01', // undefined_table
])

export function isMissingRelationError(error) {
  return Boolean(error?.code && MISSING_RELATION_CODES.has(String(error.code)))
}

// The two deploy-lag codes that specifically mean "this FUNCTION is not
// deployed yet", as opposed to a table or a column. `create_course_with_layout`
// and `provision_practice_stack` are both RPCs guarded this way: the button
// ships on `main` before the migration that defines the function lands, and
// PostgREST/Postgres answer with one of these two codes for that exact gap.
//
// Exported as a predicate for the same reason as `isMissingRelationError`: so
// the rule stays in one place instead of being re-spelled at every RPC call
// site that needs to detect "the function itself doesn't exist yet."
const MISSING_FUNCTION_CODES = new Set([
  'PGRST202', // function not found in the schema cache
  '42883', // undefined_function
])

export function isMissingFunctionError(error) {
  return Boolean(error?.code && MISSING_FUNCTION_CODES.has(String(error.code)))
}

// Attaches the HTTP status from a supabase-js response envelope onto the error
// it carried.
//
// supabase-js returns `{ data, error, status }`, but a `PostgrestError` itself
// carries only `message`, `details`, `hint` and `code` — never `status`. Since
// `isPermanentError` keys off `status` for everything outside its four known
// codes, an error that arrives without one classifies as transient and retries
// forever. That silently covers every RLS denial (`42501`), every validation
// error an RPC raises itself (`22023`), and every `28000` — the exact class of
// permanently-failing write the outbox contract exists to surface.
//
// Called at the send sites that feed a queue, which is where the envelope is
// still in scope. Widening `PERMANENT_POSTGRES_CODES` instead would be wrong:
// `28000` is genuinely ambiguous, because an expired JWT that then gets
// refreshed makes the identical payload succeed on retry.
export function attachResponseStatus(error, status) {
  if (!error) return error
  if (typeof status !== 'number') return error
  // Already attached — trust the send site that knew more than we do.
  if (typeof error.status === 'number') return error
  if (error.code && DEPLOY_LAG_CODES.has(error.code)) return error

  // Mutates rather than copies, deliberately. supabase-js mints a fresh error
  // per response and hands it to exactly one caller, so there is nothing to
  // race — and copying an `Error` silently drops `stack` and `message`, which
  // are own non-enumerable properties that spread and `Object.assign` skip.
  // Losing the stack to gain immutability nobody needed is the worse trade.
  error.status = status
  return error
}
