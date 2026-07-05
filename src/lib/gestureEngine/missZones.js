// Shared 9-zone diagnostic grid layout — fixed once here since 2.5 (miss
// tendency diagnostics) reads the same putt_events.miss_zone values later and
// must agree on what each 1-9 index means. Reading order: top-left to
// bottom-right.
export const MISS_ZONES = [
  { id: 1, row: 0, col: 0, label: 'high-left' },
  { id: 2, row: 0, col: 1, label: 'high-center' },
  { id: 3, row: 0, col: 2, label: 'high-right' },
  { id: 4, row: 1, col: 0, label: 'mid-left' },
  { id: 5, row: 1, col: 1, label: 'center' },
  { id: 6, row: 1, col: 2, label: 'mid-right' },
  { id: 7, row: 2, col: 0, label: 'low-left' },
  { id: 8, row: 2, col: 1, label: 'low-center' },
  { id: 9, row: 2, col: 2, label: 'low-right' },
]
