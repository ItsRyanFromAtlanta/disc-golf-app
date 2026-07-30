import ChipGroup from './ChipGroup'
import { TREND_WINDOWS, TREND_MIN_BUCKET_ATTEMPTS, WILSON_MIN_N_FOR_HIDING } from '../lib/insights'

// Make-% trend. Hand-rolled SVG for the same reason FlightChart and SkillRadar
// are: the repo takes no charting dependency, and the shapes it needs are a
// polyline and some ticks.
//
// The chart is deliberately not the headline. The verdict line above it is,
// because a reader looking at a wiggly line will find a trend in noise whether
// or not one is there — so `makePercentTrend` decides whether a direction may
// be claimed, and this component only renders that decision. Points thinner
// than TREND_MIN_BUCKET_ATTEMPTS are drawn hollow with their Wilson whisker,
// so a 2-of-3 period is visibly provisional rather than a confident vertex.

const VIEW_W = 320
const VIEW_H = 184
const PAD = { top: 14, right: 12, bottom: 26, left: 32 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom
const Y_GRID = [0, 0.25, 0.5, 0.75, 1]

const pct = (value) => `${Math.round(value * 100)}%`
const signedPct = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(Math.round(value * 100))} pts`
const day = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const VERDICTS = {
  improving: { title: 'Trending up', tone: 'up' },
  declining: { title: 'Trending down', tone: 'down' },
  'no-clear-change': { title: 'No clear change', tone: 'flat' },
  'insufficient-evidence': { title: 'Not enough yet to call a direction', tone: 'flat' },
}

function verdictDetail({ verdict, earlier, later, deltaPct, minHalfAttempts }, bucketLabel) {
  if (verdict === 'insufficient-evidence') {
    return `Needs ${minHalfAttempts} attempts in each half of the window to compare; you have ${earlier.attempts} then ${later.attempts}.`
  }
  const halves = `${earlier.makes}/${earlier.attempts} (${pct(earlier.makePct)}) → ${later.makes}/${later.attempts} (${pct(later.makePct)})`
  if (verdict === 'no-clear-change') {
    return `${halves}. ${signedPct(deltaPct)} on the point estimate, but the two 95% intervals still overlap — that gap is within noise. One point per ${bucketLabel}.`
  }
  return `${halves} — ${signedPct(deltaPct)}, with no overlap between the two 95% intervals. One point per ${bucketLabel}.`
}

export default function TrendChart({ trend, milestones = [], form = null, onWindowChange }) {
  const { start, end, points, totals, direction } = trend
  const span = end - start || 1
  const scaleX = (ms) => PAD.left + ((ms - start) / span) * PLOT_W
  const scaleY = (value) => PAD.top + (1 - value) * PLOT_H
  const centreOf = (point) => (point.start + point.end) / 2
  const verdict = VERDICTS[direction.verdict]

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(centreOf(point))} ${scaleY(point.makePct)}`)
    .join(' ')

  return (
    <section className="trend-chart" aria-labelledby="trend-chart-title">
      <h2 id="trend-chart-title">Make % over time</h2>

      <ChipGroup
        options={TREND_WINDOWS}
        isActive={(option) => option.days === trend.windowDays}
        onSelect={(option) => onWindowChange(option.days)}
        getKey={(option) => option.days}
        getLabel={(option) => option.label}
      />

      <p className={`trend-verdict trend-verdict-${verdict.tone}`}>
        <strong>{verdict.title}</strong>
        <span>{verdictDetail(direction, trend.bucketLabel)}</span>
      </p>

      {points.length === 0 ? (
        <p className="trend-empty">
          No completed putts in the last {trend.windowDays} days. The line starts as soon as you log one.
        </p>
      ) : (
        <>
          <svg
            className="trend-svg"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-label={`Make percentage per ${trend.bucketLabel} over the last ${trend.windowDays} days. ${verdict.title}.`}
          >
            {Y_GRID.map((line) => (
              <g key={line}>
                <line className="trend-gridline" x1={PAD.left} y1={scaleY(line)} x2={VIEW_W - PAD.right} y2={scaleY(line)} />
                <text className="trend-axis-label" x={PAD.left - 5} y={scaleY(line) + 3} textAnchor="end">
                  {pct(line)}
                </text>
              </g>
            ))}

            {milestones.map((milestone) => (
              <g key={milestone.id} className="trend-milestone">
                <line
                  className="trend-milestone-line"
                  x1={scaleX(milestone.at)}
                  y1={PAD.top}
                  x2={scaleX(milestone.at)}
                  y2={PAD.top + PLOT_H}
                />
                <text className="trend-milestone-star" x={scaleX(milestone.at)} y={PAD.top - 3} textAnchor="middle">
                  ★
                </text>
                <title>{`${milestone.label} — ${day(milestone.at)}`}</title>
              </g>
            ))}

            {points.length > 1 && <path className="trend-line" d={linePath} fill="none" />}

            {points.map((point) => (
              <g key={point.start}>
                {point.attempts < WILSON_MIN_N_FOR_HIDING && (
                  <line
                    className="trend-whisker"
                    x1={scaleX(centreOf(point))}
                    y1={scaleY(point.interval.upper)}
                    x2={scaleX(centreOf(point))}
                    y2={scaleY(point.interval.lower)}
                  />
                )}
                <circle
                  className={`trend-dot ${point.sparse ? 'trend-dot-sparse' : ''}`}
                  cx={scaleX(centreOf(point))}
                  cy={scaleY(point.makePct)}
                  r={3.5}
                >
                  <title>
                    {`${day(point.start)}–${day(point.end)}: ${point.makes}/${point.attempts} (${pct(point.makePct)})`}
                  </title>
                </circle>
              </g>
            ))}

            <text className="trend-axis-label" x={PAD.left} y={VIEW_H - 8}>{day(start)}</text>
            <text className="trend-axis-label" x={VIEW_W - PAD.right} y={VIEW_H - 8} textAnchor="end">
              {day(end)}
            </text>
          </svg>

          <p className="trend-footer">
            {totals.makes}/{totals.attempts} ({pct(totals.makePct)}) in this window
            {totals.attempts < WILSON_MIN_N_FOR_HIDING && (
              <> · 95% interval {pct(totals.interval.lower)}–{pct(totals.interval.upper)}</>
            )}
            {form?.currentFormPct != null && form.lifetimePct != null && (
              <> · current form {pct(form.currentFormPct)} vs lifetime {pct(form.lifetimePct)}</>
            )}
          </p>

          <p className="trend-legend">
            {trend.sparsePointCount > 0 && (
              <>Hollow points sit under {TREND_MIN_BUCKET_ATTEMPTS} attempts — provisional. </>
            )}
            Whiskers are the 95% interval, shown while a point is under {WILSON_MIN_N_FOR_HIDING} attempts.
            {milestones.length > 0 && ' ★ marks a logged equipment change.'}
          </p>

          <details className="trend-detail">
            <summary>Period evidence ({points.length})</summary>
            <ul className="trend-detail-list">
              {points.map((point) => (
                <li key={point.start}>
                  <span>
                    {day(point.start)}–{day(point.end)}
                    {point.sparse && ' · provisional'}
                  </span>
                  <strong>
                    {point.makes}/{point.attempts} ({pct(point.makePct)})
                  </strong>
                  {point.attempts < WILSON_MIN_N_FOR_HIDING && (
                    <small>{pct(point.interval.lower)}–{pct(point.interval.upper)} interval</small>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}
