import { useCallback, useEffect, useState } from 'react'
import { loadDiscProfileContext } from '../lib/repository/discProfileRepository'

function percent(value) {
  return value == null ? 'Insufficient data' : `${Math.round(value * 100)}%`
}

function decimal(value, suffix = '') {
  return value == null ? 'Insufficient data' : `${value.toFixed(1)}${suffix}`
}

export default function DiscProfileContext({ discId, onError }) {
  const [context, setContext] = useState(null)
  const load = useCallback(() => loadDiscProfileContext(discId).then(setContext), [discId])

  useEffect(() => {
    load().catch((error) => onError(error.message))
  }, [load, onError])

  if (!context) return <p className="loading">Loading disc performance…</p>
  const { putting, rounds } = context.performance
  return (
    <>
      <section className="disc-context-panel">
        <h2>Contextual performance</h2>
        <p className="log-time">Only genuinely attributed putts and recorded round holes count.</p>
        <dl className="disc-context-stats">
          <div><dt>Putting</dt><dd>{percent(putting.pct)}</dd><span>{putting.makes}/{putting.attempts} genuine events</span></div>
          <div><dt>Round holes</dt><dd>{rounds.holesPlayed || '—'}</dd><span>physically attributed</span></div>
          <div><dt>Average score</dt><dd>{decimal(rounds.averageScore)}</dd><span>{rounds.averageToPar == null ? 'Insufficient data' : `${rounds.averageToPar >= 0 ? '+' : ''}${rounds.averageToPar.toFixed(1)} to par`}</span></div>
          <div><dt>Last used</dt><dd>{rounds.lastUsedAt ? new Date(rounds.lastUsedAt).toLocaleDateString() : 'Insufficient data'}</dd><span>recorded rounds</span></div>
        </dl>
        {putting.interval && <p className="log-time">Small-sample 95% range: {Math.round(putting.interval.lower * 100)}–{Math.round(putting.interval.upper * 100)}%</p>}
      </section>

      <section className="disc-history-panel">
        <h2>Lifecycle &amp; history</h2>
        {!context.history.length ? <p>No history recorded yet.</p> : (
          <ol className="disc-profile-history">
            {context.history.slice(0, 50).map((row) => (
              <li key={row.id}><strong>{row.title}</strong><span className="log-time">{new Date(row.at).toLocaleString()} · {row.type.replaceAll('_', ' ')}</span>{row.detail && <span>{row.detail}</span>}</li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}
