import { useEffect, useState } from 'react'
import { fetchUserDiscs } from '../../lib/discLocker'
import { effectiveFlightNumbers } from '../../lib/discs'
import { speedClass } from '../../lib/discFilters'
import ChipGroup from '../ChipGroup'

// Optional putter selection at session start, persisted by the caller into
// profileDefaults.favoritePutterDiscId. Renders nothing if the user's locker
// has no putters yet — this is a nice-to-have, not a blocker to starting.
export default function PutterPicker({ userId, selectedId, onSelect }) {
  const [putters, setPutters] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchUserDiscs(userId)
      .then((discs) => {
        const onlyPutters = discs.filter((disc) => {
          const { speed } = effectiveFlightNumbers(disc, disc.moldInfo)
          return disc.status === 'in_locker' && speedClass(speed) === 'putter'
        })
        setPutters(onlyPutters)
      })
      .catch((err) => setError(err.message))
  }, [userId])

  if (error) return <p className="form-error">{error}</p>
  if (!putters || putters.length === 0) return null

  return (
    <div className="putter-picker">
      <span className="editor-label">Putter</span>
      <ChipGroup
        options={putters}
        getKey={(disc) => disc.id}
        getLabel={(disc) => disc.nickname || disc.moldInfo?.mold_name || disc.mold}
        isActive={(disc) => selectedId === disc.id}
        onSelect={(disc) => onSelect(disc.id)}
      />
    </div>
  )
}
