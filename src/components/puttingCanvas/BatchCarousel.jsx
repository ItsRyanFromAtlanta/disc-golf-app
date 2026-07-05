import { useEffect, useMemo, useRef } from 'react'

// Adaptive scrub carousel for 15-20 remaining attempts — a horizontally
// scroll-snapping row of make-count cells (0..volumePlanned), one tap per
// cell. Smart-centers on the historical average for this distance on
// mount; the historical-average*1.25 cell gets a distinct "predictive
// anchor" highlight (an optimistic nudge, not a hard suggestion). The 0 and
// max cells get a distinct highlight of their own so they stay easy to spot
// even before scrolling — a lighter-weight reading of "edge-pinned" than
// true sticky positioning, which fights awkwardly with scroll-snap.
export default function BatchCarousel({ volumePlanned, historicalAvgMakePct, onComplete }) {
  const cellRefs = useRef([])
  const values = useMemo(() => Array.from({ length: volumePlanned + 1 }, (_, i) => i), [volumePlanned])

  const historicalAvgMakes =
    historicalAvgMakePct != null ? Math.round(historicalAvgMakePct * volumePlanned) : null
  const predictiveAnchor =
    historicalAvgMakes != null ? Math.min(volumePlanned, Math.round(historicalAvgMakes * 1.25)) : null

  useEffect(() => {
    const target = historicalAvgMakes ?? Math.round(volumePlanned / 2)
    cellRefs.current[target]?.scrollIntoView({ inline: 'center', block: 'nearest' })
    // Center once on mount only — re-centering on every render would fight
    // the user's own scrubbing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="batch-carousel">
      {values.map((n) => (
        <button
          key={n}
          ref={(el) => {
            cellRefs.current[n] = el
          }}
          type="button"
          className={[
            'batch-carousel-cell',
            (n === 0 || n === volumePlanned) && 'batch-carousel-cell-edge',
            n === predictiveAnchor && 'batch-carousel-cell-predicted',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onComplete(n, volumePlanned)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
