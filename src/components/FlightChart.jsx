const WIDTH = 320
const HEIGHT = 220
const PAD = 28

function domain(values, fallbackMin, fallbackMax) {
  if (values.length === 0) return [fallbackMin, fallbackMax]
  const min = Math.min(...values, fallbackMin)
  const max = Math.max(...values, fallbackMax)
  return [min, max]
}

export default function FlightChart({ points }) {
  const [xMin, xMax] = domain(points.map((p) => p.x), 1, 14)
  const [yMin, yMax] = domain(points.map((p) => p.y), -5, 6)

  const scaleX = (x) => PAD + ((x - xMin) / (xMax - xMin || 1)) * (WIDTH - PAD * 2)
  const scaleY = (y) => HEIGHT - PAD - ((y - yMin) / (yMax - yMin || 1)) * (HEIGHT - PAD * 2)

  const zeroY = yMin <= 0 && yMax >= 0 ? scaleY(0) : null

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="flight-chart" role="img" aria-label="Flight chart: speed by turn+fade">
      <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} className="flight-chart-axis" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={HEIGHT - PAD} className="flight-chart-axis" />
      {zeroY !== null && (
        <line x1={PAD} y1={zeroY} x2={WIDTH - PAD} y2={zeroY} className="flight-chart-zero-line" />
      )}
      <text x={WIDTH / 2} y={HEIGHT - 6} textAnchor="middle" className="flight-chart-label">
        Speed
      </text>
      <text x={10} y={HEIGHT / 2} textAnchor="middle" className="flight-chart-label" transform={`rotate(-90 10 ${HEIGHT / 2})`}>
        Turn + Fade
      </text>
      {points.map((p, i) => (
        <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={5} className="flight-chart-point">
          <title>
            {(p.disc.nickname || `${p.mold.manufacturer} ${p.mold.mold_name}`)} — speed {p.x}, turn+fade {p.y}
          </title>
        </circle>
      ))}
    </svg>
  )
}
