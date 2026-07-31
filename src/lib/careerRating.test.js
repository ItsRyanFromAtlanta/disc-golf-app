import { describe, expect, it } from 'vitest'
import { careerRating, RATING_COLUMN } from './careerRating'

describe('careerRating', () => {
  it('reads the shipped pdga_rating column', () => {
    expect(RATING_COLUMN).toBe('pdga_rating')
    expect(careerRating({ pdga_rating: 900, target_rating: 1000 })).toEqual({
      current: 900,
      target: 1000,
      progress: 90,
    })
  })

  // The regression this module exists for. `current_rating` is not a column in
  // this schema and never has been, so a profile carrying it must not light up
  // the rating headline — if this passes while the assertion above fails, the
  // read has been pointed back at the dead column.
  it('does not read the nonexistent current_rating column', () => {
    expect(careerRating({ current_rating: 900, target_rating: 1000 })).toEqual({
      current: null,
      target: 1000,
      progress: null,
    })
  })

  it('withholds progress when either rating is missing', () => {
    expect(careerRating({ target_rating: 1000 }).progress).toBeNull()
    expect(careerRating({ pdga_rating: 900 }).progress).toBeNull()
    expect(careerRating({}).progress).toBeNull()
    expect(careerRating(null)).toEqual({ current: null, target: null, progress: null })
  })

  it('withholds progress rather than dividing by a zero target', () => {
    expect(careerRating({ pdga_rating: 900, target_rating: 0 })).toEqual({
      current: 900,
      target: 0,
      progress: null,
    })
  })

  it('clamps progress at 100 once the target is passed', () => {
    expect(careerRating({ pdga_rating: 1050, target_rating: 1000 }).progress).toBe(100)
  })

  it('rounds progress to a whole percent', () => {
    expect(careerRating({ pdga_rating: 907, target_rating: 1000 }).progress).toBe(91)
  })

  it('treats empty strings and non-numeric values as absent', () => {
    expect(careerRating({ pdga_rating: '', target_rating: '' })).toEqual({
      current: null,
      target: null,
      progress: null,
    })
    expect(careerRating({ pdga_rating: 'unrated', target_rating: 1000 }).current).toBeNull()
  })

  it('accepts numeric strings, since PostgREST can hand back either', () => {
    expect(careerRating({ pdga_rating: '900', target_rating: '1000' })).toEqual({
      current: 900,
      target: 1000,
      progress: 90,
    })
  })
})
