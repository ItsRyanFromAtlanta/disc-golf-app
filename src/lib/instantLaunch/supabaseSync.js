import { supabase } from '../supabaseClient'
import { isPermanentError } from './errorClassification'

// Generic per-row upsert-or-update executor shared by every page's write
// adapter — each outbox row carries { id, _op: 'insert' | 'update', ...fields }.
// 'insert' rows use upsert-with-ignoreDuplicates so a retried row (same
// client-generated id) is a true no-op on replay; 'update' rows use a plain
// update, which is naturally idempotent (re-applying the same fields twice
// has no different effect) with no special upsert trick needed.
export async function syncRows(table, rows) {
  const succeededIds = []
  const permanentFailureIds = []

  for (const row of rows) {
    // `_table` is a routing tag (added at enqueue so a standalone flush can
    // find each row's target table); it is never a real column, so strip it
    // alongside id/_op before the write.
    const { id, _op, _table, ...fields } = row
    try {
      const { error } =
        _op === 'update'
          ? await supabase.from(table).update(fields).eq('id', id)
          : await supabase.from(table).upsert({ id, ...fields }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      succeededIds.push(id)
    } catch (err) {
      if (isPermanentError(err)) permanentFailureIds.push(id)
      // else: leave it in the outbox, the scheduler will retry with backoff
    }
  }

  return { succeededIds, permanentFailureIds }
}

export async function deleteRowById(table, id) {
  await supabase.from(table).delete().eq('id', id)
}
