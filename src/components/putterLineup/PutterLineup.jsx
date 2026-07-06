import { useEffect, useMemo, useState } from 'react'
import { fetchUserDiscs, updateDiscRole, updateDiscWear, upsertDisc } from '../../lib/discLocker'
import { effectiveFlightNumbers } from '../../lib/discs'
import { speedClass } from '../../lib/discFilters'
import { ODOMETER_ALERT_THRESHOLD, proposeWearStepDown } from '../../lib/flightCurve'
import ChipGroup from '../ChipGroup'
import FlightCurve from './FlightCurve'

const ROLES = [
  { key: 'primary_putter', label: 'Primary' },
  { key: 'backup_putter', label: 'Backup' },
  { key: 'situational_weather', label: 'Situational' },
  { key: 'standard', label: 'Standard' },
]

export default function PutterLineup({ userId }) {
  const [discs, setDiscs] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    const all = await fetchUserDiscs(userId)
    const putters = all.filter((disc) => {
      if (disc.status !== 'in_locker') return false
      const { speed } = effectiveFlightNumbers(disc, disc.moldInfo)
      return speedClass(speed) === 'putter'
    })
    setDiscs(putters)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [userId])

  const swimlanes = useMemo(() => {
    if (!discs) return null
    return ROLES.map(({ key, label }) => ({
      key,
      label,
      discs: discs.filter((d) => (d.role ?? 'standard') === key),
    }))
  }, [discs])

  async function handleSetRole(discId, role) {
    setError(null)
    try {
      await updateDiscRole(discs, discId, role)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSetWear(discId, wearScore) {
    setError(null)
    try {
      await updateDiscWear(discId, wearScore)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRetire(discId) {
    setError(null)
    try {
      await upsertDisc(userId, discId, { status: 'retired' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !discs) return <p className="form-error">{error}</p>
  if (!discs) return <p className="loading">Loading...</p>

  if (discs.length === 0) {
    return <p>No putters in your locker yet — add one to build your lineup.</p>
  }

  return (
    <div className="putter-lineup">
      {error && <p className="form-error">{error}</p>}
      {swimlanes.map((lane) => (
        <section key={lane.key} className="putter-swimlane">
          <h3>
            {lane.label} <span className="log-time">({lane.discs.length})</span>
          </h3>
          {lane.discs.length === 0 ? (
            <p className="loading">Empty</p>
          ) : (
            lane.discs.map((disc) => {
              const overOdometer = disc.total_chain_hits >= ODOMETER_ALERT_THRESHOLD
              return (
                <div key={disc.id} className="putter-lineup-row">
                  <FlightCurve disc={disc} mold={disc.moldInfo} />
                  <div className="putter-lineup-details">
                    <span className="disc-card-title">{disc.nickname || disc.moldInfo?.mold_name || disc.mold}</span>

                    <ChipGroup
                      options={ROLES}
                      getKey={(r) => r.key}
                      getLabel={(r) => r.label}
                      isActive={(r) => (disc.role ?? 'standard') === r.key}
                      onSelect={(r) => handleSetRole(disc.id, r.key)}
                    />

                    <label className="wear-slider-row">
                      Wear
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={disc.wear_score ?? 1}
                        onChange={(e) => handleSetWear(disc.id, Number(e.target.value))}
                      />
                      <span>{disc.wear_score ?? 1}</span>
                    </label>

                    {overOdometer && (
                      <p className="odometer-alert">
                        {disc.total_chain_hits} chain hits logged — consider stepping wear up to{' '}
                        {proposeWearStepDown(disc.wear_score)}.{' '}
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleSetWear(disc.id, proposeWearStepDown(disc.wear_score))}
                        >
                          Apply
                        </button>
                      </p>
                    )}

                    <button type="button" className="link-button" onClick={() => handleRetire(disc.id)}>
                      Retire
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </section>
      ))}
    </div>
  )
}
