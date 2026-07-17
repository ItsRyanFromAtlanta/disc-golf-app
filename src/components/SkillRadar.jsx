const CENTER = 100
const RADIUS = 66

function point(index, radius) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / 5
  return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius]
}
function points(values) {
  return values.map((value, index) => point(index, RADIUS * (value ?? 0) / 100).join(',')).join(' ')
}

export default function SkillRadar({ axes }) {
  const outer = points([100, 100, 100, 100, 100])
  return (
    <div className="career-radar-wrap">
      <svg className="career-radar" viewBox="0 0 200 200" role="img" aria-label="Five-axis career skill radar">
        <polygon points={outer} className="career-radar-grid" />
        {[0, 1, 2, 3, 4].map((index) => {
          const [x, y] = point(index, RADIUS)
          return <line key={index} x1={CENTER} y1={CENTER} x2={x} y2={y} className="career-radar-axis" />
        })}
        <polygon points={points(axes.map((axis) => axis.score))} className="career-radar-value" />
      </svg>
      <ul className="career-radar-legend">
        {axes.map((axis) => <li key={axis.key}><span>{axis.label}</span><strong>{axis.score == null ? 'Insufficient data' : `${axis.score}/100`}</strong></li>)}
      </ul>
    </div>
  )
}
