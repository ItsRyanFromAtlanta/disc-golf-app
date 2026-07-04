import { effectiveFlightNumbers } from './discs'

// Speed class thresholds follow common disc golf convention (putters 1-3,
// midrange 4-5, fairway 6-9, distance 10+).
export function speedClass(speed) {
  if (speed == null) return null
  if (speed <= 3) return 'putter'
  if (speed <= 5) return 'midrange'
  if (speed <= 9) return 'fairway'
  return 'distance'
}

// Stability from turn+fade: comfortably negative fades late and turns hard
// (understable), near zero flies straight (stable), comfortably positive
// resists turn and fades hard (overstable).
export function stabilityClass(turnFadeSum) {
  if (turnFadeSum == null) return null
  if (turnFadeSum < -1) return 'understable'
  if (turnFadeSum <= 1) return 'stable'
  return 'overstable'
}

export const STABILITY_COLORS = {
  understable: '#2563eb',
  stable: '#2e7d32',
  overstable: '#b8860b',
}

export function stabilityColor(cls) {
  return STABILITY_COLORS[cls] ?? '#888'
}

function discEffective(disc) {
  return effectiveFlightNumbers(disc, disc.moldInfo)
}

function discLabel(disc) {
  return `${disc.nickname ?? ''} ${disc.moldInfo?.manufacturer ?? disc.manufacturer ?? ''} ${disc.moldInfo?.mold_name ?? disc.mold ?? ''}`.toLowerCase()
}

// All filters operate on EFFECTIVE numbers (override-aware), not mold stock —
// a re-worked disc should filter/sort by how it actually flies.
export function filterDiscs(discs, { query, manufacturer, speedClass: speedFilter, stability: stabilityFilter, status } = {}) {
  return discs.filter((disc) => {
    if (status && status !== 'all' && disc.status !== status) return false
    if (manufacturer && manufacturer !== 'all') {
      const mfr = disc.moldInfo?.manufacturer ?? disc.manufacturer
      if (mfr !== manufacturer) return false
    }
    const { speed, turn, fade } = discEffective(disc)
    if (speedFilter && speedFilter !== 'all' && speedClass(speed) !== speedFilter) return false
    if (stabilityFilter && stabilityFilter !== 'all') {
      const sum = turn == null || fade == null ? null : turn + fade
      if (stabilityClass(sum) !== stabilityFilter) return false
    }
    if (query && query.trim() && !discLabel(disc).includes(query.trim().toLowerCase())) return false
    return true
  })
}

export function sortDiscs(discs, sortKey) {
  const withEffective = discs.map((disc) => ({ disc, effective: discEffective(disc) }))

  const compareBy = {
    speed: (a, b) => (b.effective.speed ?? -Infinity) - (a.effective.speed ?? -Infinity),
    stability: (a, b) => {
      const sa = a.effective.turn == null || a.effective.fade == null ? Infinity : a.effective.turn + a.effective.fade
      const sb = b.effective.turn == null || b.effective.fade == null ? Infinity : b.effective.turn + b.effective.fade
      return sa - sb
    },
    recent: (a, b) => new Date(b.disc.created_at) - new Date(a.disc.created_at),
  }

  const compare = compareBy[sortKey] ?? compareBy.recent
  return [...withEffective].sort(compare).map((w) => w.disc)
}
