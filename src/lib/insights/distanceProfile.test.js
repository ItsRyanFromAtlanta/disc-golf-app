import { describe, expect, it } from 'vitest'
import {
  distanceProfile,
  DISTANCE_PROFILE_MIN_BAND_ATTEMPTS,
  DISTANCE_PROFILE_MIN_QUALIFIED_BANDS,
} from './distanceProfile'

const at = (distanceFeet, makes, attempts) => ({ distanceFeet, makes, attempts })
const bandAt = (profile, start) => profile.bands.find((band) => band.start === start)

describe('distanceProfile', () => {
  it('names the weak, under-practised band as the blind spot ahead of an over-drilled strength', () => {
    const profile = distanceProfile([
      at(15, 234, 260), // owned, and over half the practice
      at(25, 180, 200), // owned, an even share
      at(35, 4, 20), // weak, and barely touched
    ])

    expect(bandAt(profile, 10)).toMatchObject({ strength: 'owned', volumeLevel: 'over', gap: 'over-drilled' })
    expect(bandAt(profile, 20)).toMatchObject({ strength: 'owned', volumeLevel: 'even', gap: 'aligned' })
    expect(bandAt(profile, 30)).toMatchObject({ strength: 'weak', volumeLevel: 'under', gap: 'blind-spot' })

    // The blind spot outranks the over-drilled band: the reps going to the
    // solved distance are the other half of the same story.
    expect(profile.takeaway).toMatchObject({ kind: 'blind-spot', band: { start: 30 } })
    expect(profile.ready).toBe(true)
  })

  it('separates grinding from a blind spot — same weakness, opposite volume', () => {
    const profile = distanceProfile([
      at(15, 27, 30), // owned, lightly practised
      at(35, 60, 200), // weak despite taking most of the reps
    ])

    expect(bandAt(profile, 30)).toMatchObject({ strength: 'weak', volumeLevel: 'over', gap: 'grinding' })
    expect(profile.takeaway).toMatchObject({ kind: 'grinding', band: { start: 30 } })
  })

  it('falls back to the over-drilled strength when nothing is confidently weak', () => {
    const profile = distanceProfile([at(15, 270, 300), at(25, 36, 40)])
    expect(profile.takeaway).toMatchObject({ kind: 'over-drilled', band: { start: 10 } })
  })

  it('says nothing is mismatched when effort and evidence agree', () => {
    const profile = distanceProfile([at(15, 90, 100), at(25, 90, 100)])
    expect(profile.bands.every((band) => band.gap === 'aligned')).toBe(true)
    expect(profile.takeaway).toEqual({ kind: 'aligned', band: null })
  })

  it('leaves a band unresolved rather than weak when the interval straddles the standard', () => {
    // 8/10 looks strong at the point estimate but its interval spans 49–94%.
    const profile = distanceProfile([at(15, 8, 10), at(25, 90, 100)])
    expect(bandAt(profile, 10)).toMatchObject({ strength: 'unresolved', gap: 'aligned' })
  })

  it('withholds every verdict on bands below the attempt floor', () => {
    const profile = distanceProfile([at(15, 2, 3), at(25, 1, 4)])
    expect(profile.bands.map((band) => band.strength)).toEqual(['unproven', 'unproven'])
    expect(profile.bands.map((band) => band.gap)).toEqual(['untested', 'untested'])
    expect(profile.qualifiedBandCount).toBe(0)
    expect(profile.ready).toBe(false)
    expect(profile.takeaway).toBeNull()
    // Volume share is still a real fact and is still reported.
    expect(profile.bands[0].volumeShare).toBeCloseTo(3 / 7)
  })

  it('refuses a mismatch claim from a single qualified band', () => {
    const profile = distanceProfile([at(15, 40, 50), at(25, 1, 2)])
    expect(profile.qualifiedBandCount).toBe(1)
    expect(profile.qualifiedBandCount).toBeLessThan(DISTANCE_PROFILE_MIN_QUALIFIED_BANDS)
    expect(profile.ready).toBe(false)
    expect(profile.takeaway).toBeNull()
  })

  it('counts thin bands toward the even split so shares are not inflated', () => {
    const profile = distanceProfile([at(15, 45, 50), at(25, 45, 50), at(35, 1, 2)])
    expect(profile.evenShare).toBeCloseTo(1 / 3)
    expect(profile.totalAttempts).toBe(102)
    expect(bandAt(profile, 30).volumeShare).toBeCloseTo(2 / 102)
  })

  it('reports untouched distances inside the practised range as coverage gaps', () => {
    const profile = distanceProfile([at(15, 40, 50), at(25, 40, 50), at(55, 10, 50)])
    expect(profile.coverageGaps.map((gap) => gap.label)).toEqual(['30-40ft', '40-50ft'])
  })

  it('has no coverage gaps with fewer than two practised bands', () => {
    expect(distanceProfile([at(15, 40, 50)]).coverageGaps).toEqual([])
    expect(distanceProfile([]).coverageGaps).toEqual([])
  })

  it('returns an honest empty shape with no data at all', () => {
    const profile = distanceProfile([])
    expect(profile).toMatchObject({
      totalMakes: 0,
      totalAttempts: 0,
      bands: [],
      evenShare: null,
      qualifiedBandCount: 0,
      ready: false,
      takeaway: null,
    })
  })

  it('ignores zero-attempt, distance-less and malformed samples', () => {
    const profile = distanceProfile([
      at(15, 0, 0),
      { makes: 5, attempts: 10 },
      { distanceFeet: null, makes: 5, attempts: 10 },
      { distanceFeet: Number.NaN, makes: 5, attempts: 10 },
      null,
      at(15, 8, 10),
    ])
    expect(profile.bands).toHaveLength(1)
    expect(profile.totalAttempts).toBe(10)
  })

  it('honours an injected attempt floor', () => {
    const strict = distanceProfile([at(15, 8, 10), at(25, 8, 10)], 10, DISTANCE_PROFILE_MIN_BAND_ATTEMPTS + 5)
    expect(strict.bands.every((band) => band.strength === 'unproven')).toBe(true)
    expect(strict.ready).toBe(false)
  })
})
