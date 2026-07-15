import { effectiveFlightNumbers } from '../../lib/discs'
import { flightPath, wearAdjustedFlightNumbers } from '../../lib/flightCurve'

const WIDTH = 120
const HEIGHT = 160

function currentFlightPath(disc, mold) {
  const effective = effectiveFlightNumbers(disc, mold)
  return flightPath(wearAdjustedFlightNumbers(effective, disc.wear_score), {
    width: WIDTH,
    height: HEIGHT,
  })
}

export default function FlightCurve({ disc, mold, className = '' }) {
  const stockPath = flightPath(
    { speed: mold?.speed, glide: mold?.glide, turn: mold?.turn, fade: mold?.fade },
    { width: WIDTH, height: HEIGHT },
  )
  const currentPath = currentFlightPath(disc, mold)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`flight-curve${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="Flight curve: factory stock vs current-reality"
    >
      {stockPath && <path d={stockPath} className="flight-curve-stock" fill="none" />}
      {currentPath && <path d={currentPath} className="flight-curve-current" fill="none" />}
    </svg>
  )
}

export function FlightCurveOverlay({ entries = [] }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="flight-curve flight-curve-overlay"
      role="img"
      aria-label="Overlaid current flight curves for selected discs"
    >
      {entries.map(({ disc, color }) => {
        const path = currentFlightPath(disc, disc.moldInfo)
        return (
          path && (
            <path
              key={disc.id}
              d={path}
              className="flight-curve-overlay-current"
              style={{ stroke: color }}
              data-disc-id={disc.id}
              fill="none"
            />
          )
        )
      })}
    </svg>
  )
}
