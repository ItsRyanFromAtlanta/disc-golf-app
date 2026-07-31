import { COMPARISON_SOURCES } from './discCompare'

// Which comparison sources the compare screen may actually offer.
//
// `resolveCommunityCohort` is a complete, tested resolver — given candidate
// cohorts it picks the largest one clearing the minimum sample. What never
// existed is anything that produces those candidates. The screen called
// `resolveCommunityCohort([])` with a hard-coded empty literal, so the answer
// was always `unavailable`, and the consequence was a `Community benchmark`
// button that was always pressable, always fell back to official catalog
// numbers, and whose only observable effect was rendering the notice
// explaining that it had done nothing.
//
// Offering a control that cannot succeed is worse than not offering it: it
// reads as a broken feature rather than an absent one. So the source list is
// derived from cohort availability instead of being a fixed enumeration, and
// with no cohort source wired the community option is simply not shown.
//
// Wiring a real cohort is a feature, not a defect fix. When one lands it passes
// its resolved cohort in here and the chip reappears with no other change —
// which is why this takes a cohort rather than hard-coding the exclusion.

// The cohort source, or its absence. There is no community cohort provider in
// this app yet; this constant is the single place that says so, and the seam a
// real provider replaces.
export const NO_COMMUNITY_COHORT = null

export function isCohortReady(cohort) {
  return cohort?.status === 'ready'
}

// The sources a user may pick from, in declaration order.
export function selectableComparisonSources(cohort = NO_COMMUNITY_COHORT) {
  const all = Object.values(COMPARISON_SOURCES)
  if (isCohortReady(cohort)) return all
  return all.filter((candidate) => candidate.id !== COMPARISON_SOURCES.community.id)
}

// Resolve a requested source against what is actually selectable. Anything
// unavailable — a community selection held in state from before a cohort went
// away, or a junk value from a restored URL — degrades to the official catalog,
// which is the source that needs no user data and can always answer.
export function resolveActiveSource(requested, cohort = NO_COMMUNITY_COHORT) {
  const selectable = selectableComparisonSources(cohort)
  return selectable.some((candidate) => candidate.id === requested)
    ? requested
    : COMPARISON_SOURCES.official.id
}
