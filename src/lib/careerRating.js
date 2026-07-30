// The ME career hub's rating headline, as a pure function.
//
// This exists because the panel read `profiles.current_rating` — a column that
// has never existed in this schema. `grep -rn "current_rating" --include=*.sql .`
// matches nothing; the shipped column is `pdga_rating`
// (`layer1_foundation_schema.sql:50`, and it is already in the hardened
// column-level UPDATE grant list at `layer5_gamification_hardening.sql:175`, so
// no grant migration is owed). Reading an absent key is silently `undefined`
// rather than an error, so the defect rendered as a permanent `—`, a
// permanently `null` progress value, a 0%-wide bar, and an `aria-label` frozen
// at "Rating progress unavailable" — for every user, forever, with nothing
// failing anywhere to say so. `CareerHubPage` had no tests at all, which is
// exactly why it survived to be found by a documentation pass.
//
// The column name is therefore the whole point of this module, not an incidental
// detail of it: pulling the read out of JSX is what lets a test pin it.

// The two profile columns the rating headline reads. Named so a future rename
// has one place to fail loudly instead of three places to fail silently.
export const RATING_COLUMN = 'pdga_rating'
export const TARGET_RATING_COLUMN = 'target_rating'

function ratingValue(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

// Returns the current rating, the target, and progress toward it as a whole
// percent, or `null` for any of them that cannot be computed. Progress is
// clamped at 100 (passing your target is not 140% of a progress bar) and is
// withheld entirely unless both numbers are present and the target is positive
// — dividing by a zero or absent target is not a 0% result, it is no result.
export function careerRating(profile) {
  const current = ratingValue(profile?.[RATING_COLUMN])
  const target = ratingValue(profile?.[TARGET_RATING_COLUMN])
  const progress = current !== null && target !== null && target > 0
    ? Math.min(100, Math.round((current / target) * 100))
    : null
  return { current, target, progress }
}
