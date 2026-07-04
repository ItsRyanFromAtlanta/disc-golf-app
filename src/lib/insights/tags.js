// Starter tag vocabulary shown as one-tap chips; free-text tags are
// normalized to the same lowercase-kebab shape before saving.
export const STARTER_TAGS = [
  'windy',
  'indoor',
  'outdoor',
  'tired',
  'new-putter',
  'pre-tournament',
  'experimenting',
]

export function normalizeTag(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
