// Fatigue curve: make % grouped by set_order across all regimen runs.
// A downward slope late in runs suggests accuracy fades with volume.
export function fatigueCurve(runSets) {
  const byOrder = new Map()
  for (const s of runSets) {
    if (s.setOrder == null || !s.attempts) continue
    const bucket = byOrder.get(s.setOrder) ?? { setOrder: s.setOrder, makes: 0, attempts: 0 }
    bucket.makes += s.makes
    bucket.attempts += s.attempts
    byOrder.set(s.setOrder, bucket)
  }
  return [...byOrder.values()]
    .sort((a, b) => a.setOrder - b.setOrder)
    .map((b) => ({ ...b, makePct: b.makes / b.attempts }))
}
