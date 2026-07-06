import { effectiveFlightNumbers } from '../../lib/discs'
import { flightPath, wearAdjustedFlightNumbers } from '../../lib/flightCurve'

const WIDTH = 120
const HEIGHT = 160

export default function FlightCurve({ disc, mold }) {
  const stockPath = flightPath(
    { speed: mold?.speed, glide: mold?.glide, turn: mold?.turn, fade: mold?.fade },
    { width: WIDTH, height: HEIGHT },
  )
  const effective = effectiveFlightNumbers(disc, mold)
  const currentPath = flightPath(wearAdjustedFlightNumbers(effective, disc.wear_score), {
    width: WIDTH,
    height: HEIGHT,
  })

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="flight-curve"
      role="img"
      aria-label="Flight curve: factory stock vs current-reality"
    >
      {stockPath && <path d={stockPath} className="flight-curve-stock" fill="none" />}
      {currentPath && <path d={currentPath} className="flight-curve-current" fill="none" />}
    </svg>
  )
}
