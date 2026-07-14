// Make-% trend over time (Screen 10). Pure SVG — no chart lib — so it stays
// self-contained and light. Plots one dot per practiced day (gaps for rest
// days, matching makePercentTimeSeries), connects them, and injects vertical ★
// markers at the exact moment a disc became the PRIMARY_PUTTER (equipment
// milestones read from disc_role_history).
//
// The y-axis is fixed 0–100% so the line's height is comparable across range
// switches; the x-axis spans the selected window [start, end].
const VIEW_W = 320
const VIEW_H = 168
const PAD = { top: 14, right: 12, bottom: 22, left: 30 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom
const Y_GRID = [0, 0.25, 0.5, 0.75, 1]

function fmtPct(v) {
  return `${Math.round(v * 100)}%`
}

export default function TrendChart({ series, milestones = [], range, rangeOptions, onRangeChange }) {
  const { start, end, points } = series
  const span = end - start || 1
  const scaleX = (t) => PAD.left + ((t - start) / span) * PLOT_W
  const scaleY = (p) => PAD.top + (1 - p) * PLOT_H

  const visibleMilestones = milestones.filter((m) => m.at >= start && m.at <= end)
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.periodStart)} ${scaleY(p.makePct)}`).join(' ')

  return (
    <div className="trend-chart">
      <div className="chip-row trend-range-chips" role="group" aria-label="Trend range">
        {rangeOptions.map((days) => (
          <button
            key={days}
            type="button"
            className={`chip ${range === days ? 'chip-active' : ''}`}
            aria-pressed={range === days}
            onClick={() => onRangeChange(days)}
          >
            {days}d
          </button>
        ))}
      </div>

      {points.length === 0 ? (
        <p className="trend-empty">No putts in this window — practice to start the trend.</p>
      ) : (
        <svg
          className="trend-svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={`Make percentage trend over the last ${range} days`}
        >
          {Y_GRID.map((g) => (
            <g key={g}>
              <line
                className="trend-gridline"
                x1={PAD.left}
                y1={scaleY(g)}
                x2={VIEW_W - PAD.right}
                y2={scaleY(g)}
              />
              <text className="trend-axis-label" x={PAD.left - 5} y={scaleY(g) + 3} textAnchor="end">
                {fmtPct(g)}
              </text>
            </g>
          ))}

          {visibleMilestones.map((m) => (
            <g key={m.id} className="trend-milestone">
              <line
                className="trend-milestone-line"
                x1={scaleX(m.at)}
                y1={PAD.top}
                x2={scaleX(m.at)}
                y2={PAD.top + PLOT_H}
              />
              <text className="trend-milestone-star" x={scaleX(m.at)} y={PAD.top - 3} textAnchor="middle">
                ★
              </text>
              <title>
                {m.discName} → primary putter ({new Date(m.changedAt).toLocaleDateString()})
              </title>
            </g>
          ))}

          {points.length > 1 && <path className="trend-line" d={linePath} fill="none" />}
          {points.map((p) => (
            <circle key={p.periodStart} className="trend-dot" cx={scaleX(p.periodStart)} cy={scaleY(p.makePct)} r={3}>
              <title>
                {new Date(p.periodStart).toLocaleDateString()}: {p.makes}/{p.attempts} ({fmtPct(p.makePct)})
              </title>
            </circle>
          ))}
        </svg>
      )}

      <div className="trend-footer">
        <span>
          {series.totalAttempts > 0
            ? `${series.totalMakes}/${series.totalAttempts} (${fmtPct(series.makePct)}) this window`
            : 'No attempts this window'}
        </span>
        {visibleMilestones.length > 0 && <span className="trend-legend">★ new primary putter</span>}
      </div>
    </div>
  )
}
