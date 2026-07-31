// 35-disc hard cap (defect register `D-19`).
//
// `enforce_bag_capacity()` is a `before insert` trigger on `bag_discs`
// (`layer1_foundation_schema.sql:230-253`) — not a CHECK constraint, because a
// CHECK cannot count sibling rows. It counts every `bag_discs` row for the
// bag regardless of the member disc's status, and raises with
// `errcode = 'check_violation'` (23514) carrying a bag id in the message.
//
// Two surfaces call `addDiscToBag` with no pre-check and used to surface that
// raw string verbatim: `/bag/locker?addToBag=` (`BagLockerPage.jsx`) and the
// bag-chip "Equip" control on disc detail (`DiscDetailPage.jsx`). Both now
// guard client-side with `BAG_HARD_CAPACITY` before writing, and translate the
// trigger's own error the same way when the guard loses a race (two tabs
// adding the 35th and 36th disc at once) — hence one small shared module
// rather than two copies that could drift on the limit or the copy.
export const BAG_HARD_CAPACITY = 35

export function bagCapacityMessage(limit = BAG_HARD_CAPACITY) {
  return `This bag is at the ${limit}-disc capacity limit. Remove a disc before adding another.`
}

export function isBagCapacityError(error) {
  return String(error?.code ?? '') === '23514'
}
