import {
  DISTANCE_PROFILE_MIN_BAND_ATTEMPTS,
  DISTANCE_PROFILE_MIN_QUALIFIED_BANDS,
  LOCK_IN_LOWER_BOUND,
  WILSON_MIN_N_FOR_HIDING,
} from '../lib/insights'

// Distance heat profile. Two bars per band — where the practice went, and what
// the evidence says — drawn on separate tracks so the disagreement between them
// is the thing you see. A long practice bar over a short make bar is reps that
// are not converting; a short bar over a short bar is a distance being avoided.
//
// The practice track is normalised to the busiest band rather than to 100%, so
// with six bands the bars are still readable, and it carries a tick at the even
// split — the reference the over/under classification actually uses. The make
// track is on its true 0–100% scale with the Wilson interval drawn behind the
// point estimate and a tick at the lock-in standard.

const pct = (value) => `${Math.round(value * 100)}%`

const GAP_LABELS = {
  'blind-spot': 'Blind spot',
  grinding: 'Not converting',
  'over-drilled': 'Over-drilled',
  aligned: 'Matched',
  untested: 'Untested',
}

const STRENGTH_LABELS = {
  owned: 'owned',
  weak: 'weak',
  unresolved: 'unresolved',
  unproven: 'too few attempts',
}

function takeawayText(profile) {
  const { takeaway } = profile
  if (!takeaway) {
    return {
      title: 'Not enough spread yet to find a blind spot',
      detail: `A mismatch compares distances against each other, so it needs at least ${DISTANCE_PROFILE_MIN_QUALIFIED_BANDS} bands with ${DISTANCE_PROFILE_MIN_BAND_ATTEMPTS}+ attempts each. You have ${profile.qualifiedBandCount}.`,
      tone: 'flat',
    }
  }
  const band = takeaway.band
  switch (takeaway.kind) {
    case 'blind-spot':
      return {
        title: `Blind spot: ${band.label}`,
        detail: `${band.makes}/${band.attempts} (${pct(band.makePct)}) there, and it takes only ${pct(band.volumeShare)} of your practice against an even split of ${pct(profile.evenShare)}. Your weakest distance is also the one you throw at least.`,
        tone: 'alert',
      }
    case 'grinding':
      return {
        title: `${band.label} is taking the reps without moving`,
        detail: `${pct(band.volumeShare)} of your practice goes here against an even split of ${pct(profile.evenShare)}, and it is still at ${band.makes}/${band.attempts} (${pct(band.makePct)}) — under the ${pct(LOCK_IN_LOWER_BOUND)} standard even at the optimistic end of its interval. Volume alone is not fixing it.`,
        tone: 'alert',
      }
    case 'over-drilled':
      return {
        title: `${band.label} is already owned and still takes the practice`,
        detail: `${pct(band.volumeShare)} of your attempts go to a band you make ${pct(band.makePct)} of the time (${band.makes}/${band.attempts}). Nothing here is confidently weak, so this is the reps worth moving outward.`,
        tone: 'flat',
      }
    default:
      return {
        title: 'Practice and weakness line up',
        detail: 'No band is both weak and neglected, and none is soaking up reps it no longer needs.',
        tone: 'good',
      }
  }
}

export default function DistanceHeatProfile({ profile }) {
  const takeaway = takeawayText(profile)
  const maxShare = Math.max(0, ...profile.bands.map((band) => band.volumeShare))

  return (
    <section className="distance-profile" aria-labelledby="distance-profile-title">
      <h2 id="distance-profile-title">Practice vs weakness by distance</h2>

      {profile.totalAttempts === 0 ? (
        <p className="confidence-map-intro">
          No completed putts logged yet — this fills in once there are attempts at more than one distance.
        </p>
      ) : (
        <>
          <p className={`distance-profile-takeaway takeaway-${takeaway.tone}`}>
            <strong>{takeaway.title}</strong>
            <span>{takeaway.detail}</span>
          </p>

          <ul className="distance-profile-list">
            {profile.bands.map((band) => (
              <li key={band.start} className={`distance-profile-band gap-${band.gap}`}>
                <div className="distance-profile-header">
                  <span className="distance-profile-label">{band.label}</span>
                  <span className="distance-profile-gap">{GAP_LABELS[band.gap]}</span>
                </div>

                <div className="distance-profile-row">
                  <span className="distance-profile-axis">Practice</span>
                  <div className="distance-profile-track">
                    <div
                      className="distance-profile-volume"
                      style={{ width: `${maxShare ? (band.volumeShare / maxShare) * 100 : 0}%` }}
                    />
                    <div
                      className="distance-profile-tick"
                      style={{ left: `${maxShare ? (profile.evenShare / maxShare) * 100 : 0}%` }}
                      title="Even split across your practised distances"
                    />
                  </div>
                  <span className="distance-profile-value">{pct(band.volumeShare)}</span>
                </div>

                <div className="distance-profile-row">
                  <span className="distance-profile-axis">Make</span>
                  <div className="distance-profile-track">
                    <div
                      className="distance-profile-interval"
                      style={{
                        left: `${band.interval.lower * 100}%`,
                        width: `${(band.interval.upper - band.interval.lower) * 100}%`,
                      }}
                    />
                    <div className="distance-profile-point" style={{ left: `${band.makePct * 100}%` }} />
                    <div
                      className="distance-profile-tick"
                      style={{ left: `${LOCK_IN_LOWER_BOUND * 100}%` }}
                      title={`Lock-in standard (${pct(LOCK_IN_LOWER_BOUND)})`}
                    />
                  </div>
                  <span className="distance-profile-value">{pct(band.makePct)}</span>
                </div>

                <p className="distance-profile-footer">
                  {band.makes}/{band.attempts} · {STRENGTH_LABELS[band.strength]}
                  {band.attempts < WILSON_MIN_N_FOR_HIDING && (
                    <> · 95% interval {pct(band.interval.lower)}–{pct(band.interval.upper)}</>
                  )}
                </p>
              </li>
            ))}
          </ul>

          {profile.coverageGaps.length > 0 && (
            <p className="distance-profile-coverage">
              Never practised inside your own range: {profile.coverageGaps.map((gap) => gap.label).join(', ')}.
              No evidence either way at those distances — the profile cannot call them strong or weak.
            </p>
          )}

          <p className="distance-profile-legend">
            The practice bar is scaled against your busiest band; its tick is an even split across the{' '}
            {profile.bands.length} distance{profile.bands.length === 1 ? '' : 's'} you use. The make bar
            is a true 0–100% scale with the 95% interval behind it and a tick at the {pct(LOCK_IN_LOWER_BOUND)}{' '}
            lock-in standard. A band stays <strong>untested</strong> under {profile.minBandAttempts} attempts.
          </p>
        </>
      )}
    </section>
  )
}
