import { useCallback, useEffect, useState } from 'react'
import {
  COSMETIC_TIER_THRESHOLDS,
  DISC_ODOMETER_LABELS,
  DISC_ODOMETER_METRICS,
  highestUnlockedTier,
  nextCosmeticMilestone,
} from '../lib/discOdometer'
import {
  flushDiscOdometerOutbox,
  loadDiscOdometer,
  recordDiscOdometerEvent,
} from '../lib/repository/discOdometerRepository'

const TOTAL_FIELD = Object.freeze({ throws: 'total_throws', chain_hits: 'total_chain_hits', airballs: 'total_airballs' })

export default function DiscOdometerManager({ userId, disc, onDiscUpdate, onError }) {
  const [events, setEvents] = useState([])
  const [unlocks, setUnlocks] = useState(disc.cosmeticUnlocks ?? [])
  const [metric, setMetric] = useState('chain_hits')
  const [delta, setDelta] = useState('1')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    await flushDiscOdometerOutbox(userId)
    const data = await loadDiscOdometer(disc.id)
    setEvents(data.events)
    setUnlocks(data.unlocks)
  }, [disc.id, userId])

  useEffect(() => {
    load().catch((error) => onError(error.message))
  }, [load, onError])

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const amount = Number(delta)
      const result = await recordDiscOdometerEvent({
        userId,
        discId: disc.id,
        metric,
        delta: amount,
        source: amount < 0 ? 'manual_correction' : 'manual_entry',
        reason,
      })
      const field = TOTAL_FIELD[metric]
      const updatedDisc = result.disc ?? { ...disc, [field]: (disc[field] ?? 0) + amount }
      if (result.unlocks?.length) updatedDisc.cosmeticUnlocks = result.unlocks
      onDiscUpdate(updatedDisc)
      setUnlocks(result.unlocks?.length ? result.unlocks : unlocks)
      setDelta('1')
      setReason('')
      setNotice(result.queued ? 'Saved on this device. It will sync when connectivity returns.' : 'Odometer updated.')
      await load()
    } catch (error) {
      onError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const milestone = nextCosmeticMilestone(disc.total_chain_hits, unlocks)
  const tier = highestUnlockedTier(unlocks)

  return (
    <section className="disc-odometer-panel">
      <header className="disc-odometer-header">
        <div><p className="eyebrow">Lifetime telemetry</p><h2>Disc odometer</h2></div>
        <span className={`disc-odometer-tier disc-odometer-tier-${tier}`}>{tier}</span>
      </header>

      <dl className="disc-odometer-totals">
        {DISC_ODOMETER_METRICS.map((name) => (
          <div key={name}><dt>{DISC_ODOMETER_LABELS[name]}</dt><dd>{disc[TOTAL_FIELD[name]] ?? 0}</dd></div>
        ))}
      </dl>

      {milestone ? (
        <p className="log-time">Next permanent tier: {milestone.tier} at {milestone.threshold.toLocaleString()} chain hits ({milestone.remaining.toLocaleString()} remaining).</p>
      ) : <p className="zone-badge">All permanent tiers unlocked</p>}

      <div className="disc-odometer-milestones" aria-label="Cosmetic tier milestones">
        {Object.entries(COSMETIC_TIER_THRESHOLDS).map(([name, threshold]) => (
          <span key={name} className={unlocks.some((unlock) => unlock.tier === name) ? 'chip chip-active' : 'chip'}>
            {name} · {threshold.toLocaleString()}
          </span>
        ))}
      </div>

      <form className="disc-odometer-form" onSubmit={submit}>
        <label htmlFor="odometer-metric">Metric</label>
        <select id="odometer-metric" value={metric} onChange={(event) => setMetric(event.target.value)}>
          {DISC_ODOMETER_METRICS.map((name) => <option key={name} value={name}>{DISC_ODOMETER_LABELS[name]}</option>)}
        </select>
        <div className="disc-odometer-quick-actions">
          {[1, 10, 25].map((amount) => <button key={amount} type="button" className="chip" onClick={() => setDelta(String(amount))}>+{amount}</button>)}
          <button type="button" className="chip" onClick={() => setDelta('-1')}>Correction</button>
        </div>
        <label htmlFor="odometer-delta">Change</label>
        <input id="odometer-delta" type="number" required step="1" min="-10000" max="10000" value={delta} onChange={(event) => setDelta(event.target.value)} />
        {Number(delta) < 0 && (
          <><label htmlFor="odometer-reason">Correction reason</label><input id="odometer-reason" required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></>
        )}
        <button className="link-button" disabled={saving}>{saving ? 'Saving…' : 'Record event'}</button>
      </form>
      {notice && <p className="success-message">{notice}</p>}

      <details>
        <summary>Odometer history ({events.length})</summary>
        {!events.length ? <p>No events recorded yet.</p> : (
          <ol className="disc-odometer-history">
            {events.slice(0, 30).map((row) => (
              <li key={row.id}>
                <span>{DISC_ODOMETER_LABELS[row.metric]} {row.delta > 0 ? '+' : ''}{row.delta}</span>
                <span className="log-time">{new Date(row.occurred_at).toLocaleString()} · {row.source}{row.pending ? ' · pending' : ''}</span>
                {row.reason && <span>{row.reason}</span>}
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  )
}
