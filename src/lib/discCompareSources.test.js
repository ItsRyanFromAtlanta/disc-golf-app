import { describe, expect, it } from 'vitest'
import { COMPARISON_SOURCES, resolveCommunityCohort } from './discCompare'
import {
  isCohortReady,
  NO_COMMUNITY_COHORT,
  resolveActiveSource,
  selectableComparisonSources,
} from './discCompareSources'

const ids = (sources) => sources.map((source) => source.id)

describe('selectableComparisonSources', () => {
  // The defect: with no cohort provider wired, the screen still offered the
  // Community benchmark button, and pressing it could only ever produce an
  // unavailability notice.
  it('does not offer the community source when no cohort exists', () => {
    expect(ids(selectableComparisonSources(NO_COMMUNITY_COHORT))).toEqual(['personal', 'official'])
    expect(ids(selectableComparisonSources())).not.toContain('community')
  })

  it('does not offer it for a cohort that resolved to unavailable either', () => {
    // This is exactly what the page used to compute and then ignore.
    const cohort = resolveCommunityCohort([])
    expect(cohort.status).toBe('unavailable')
    expect(ids(selectableComparisonSources(cohort))).not.toContain('community')
  })

  it('offers it as soon as a cohort resolves ready', () => {
    const cohort = resolveCommunityCohort([{ sampleSize: 500 }])
    expect(cohort.status).toBe('ready')
    expect(ids(selectableComparisonSources(cohort))).toEqual(['personal', 'official', 'community'])
  })

  it('always offers the two sources that need no cohort', () => {
    for (const cohort of [NO_COMMUNITY_COHORT, resolveCommunityCohort([]), resolveCommunityCohort([{ sampleSize: 500 }])]) {
      expect(ids(selectableComparisonSources(cohort))).toEqual(
        expect.arrayContaining(['personal', 'official']),
      )
    }
  })
})

describe('resolveActiveSource', () => {
  it('keeps a selectable request', () => {
    expect(resolveActiveSource('personal')).toBe('personal')
    expect(resolveActiveSource('official')).toBe('official')
  })

  it('degrades an unselectable community request to the official catalog', () => {
    expect(resolveActiveSource('community')).toBe(COMPARISON_SOURCES.official.id)
    expect(resolveActiveSource('community', resolveCommunityCohort([]))).toBe('official')
  })

  it('honours community once a cohort is ready', () => {
    expect(resolveActiveSource('community', resolveCommunityCohort([{ sampleSize: 500 }]))).toBe('community')
  })

  it('degrades an unknown source rather than passing it through', () => {
    expect(resolveActiveSource('nonsense')).toBe('official')
    expect(resolveActiveSource(undefined)).toBe('official')
  })
})

describe('isCohortReady', () => {
  it('is false for absent, unavailable, and malformed cohorts', () => {
    expect(isCohortReady(null)).toBe(false)
    expect(isCohortReady(undefined)).toBe(false)
    expect(isCohortReady({})).toBe(false)
    expect(isCohortReady(resolveCommunityCohort([]))).toBe(false)
  })

  it('is true only for a resolved cohort', () => {
    expect(isCohortReady(resolveCommunityCohort([{ sampleSize: 500 }]))).toBe(true)
  })
})
