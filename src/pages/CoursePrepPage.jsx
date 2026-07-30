import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { holePrep, layoutBrief, lockerCoverage, priorityHoles } from '../lib/insights'
import { useDiscList } from '../lib/repository/discRepository'
import { loadRound, useRoundList } from '../lib/repository/roundRepository'
import { fetchCourse } from '../lib/roundLog'
import { formatRelativeToPar } from '../lib/rounds'

// Same label rule the scorecard uses, so a disc reads identically on the prep
// sheet and on the card the player fills in half an hour later. Deliberately
// not extracted: five surfaces already carry a `discLabel` with slightly
// different fallbacks, and unifying them is a separate change that would move
// text on screens this task did not touch.
function discLabel(disc) {
  return disc?.nickname || disc?.moldInfo?.mold_name || disc?.mold || disc?.manufacturer || 'Disc'
}

// One decimal is as much precision as an average over three rounds earns —
// matching `RoundsPage`.
function formatAverage(value) {
  return formatRelativeToPar(Math.round(value * 10) / 10)
}

function formatFeet(value) {
  return `${Number(value).toLocaleString()} ft`
}

function holeTitle(entry) {
  const number = entry.holeNumber == null ? 'Hole' : `Hole ${entry.holeNumber}`
  return entry.teeType ? `${number} · ${entry.teeType}` : number
}

/**
 * What the player's own record says about this hole, in one line, or null.
 *
 * Null rather than "no history" so the caller renders nothing at all: a
 * scouting line on every hole of a course nobody has played would be eighteen
 * repetitions of the same absence.
 */
function historyLine(entry) {
  if (entry.playedRounds === 0) return null
  const parts = [entry.playedRounds === 1 ? 'Played once' : `Played ${entry.playedRounds} times`]
  if (entry.best != null) parts.push(`best ${entry.best}`)
  // The average is null below the sample floor by design (see
  // `lib/insights/coursePrep.js`); the total is a fact at any sample size, so a
  // thin history still says something true.
  if (entry.averageRelativeToPar != null) parts.push(`avg ${formatAverage(entry.averageRelativeToPar)}`)
  else if (entry.totalRelativeToPar != null) parts.push(`${formatRelativeToPar(entry.totalRelativeToPar)} total`)
  return parts.join(' · ')
}

export default function CoursePrepPage() {
  const { courseId } = useParams()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedLayoutId = searchParams.get('layoutId')
  const [course, setCourse] = useState(null)
  const [error, setError] = useState(null)
  const roundsQuery = useRoundList(user.id)
  const discsQuery = useDiscList(user.id)
  const [details, setDetails] = useState({})

  useEffect(() => {
    let active = true
    setCourse(null)
    setError(null)
    fetchCourse(courseId)
      .then((value) => {
        if (active) setCourse(value)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [courseId])

  const layouts = useMemo(() => course?.layouts ?? [], [course])
  const layout = useMemo(() => {
    if (layouts.length === 0) return null
    return (
      layouts.find((row) => row.id === requestedLayoutId) ??
      layouts.find((row) => row.is_default) ??
      layouts[0]
    )
  }, [layouts, requestedLayoutId])

  // Only this layout's completed rounds are hydrated. Filtering before the
  // fan-out is what keeps this bounded: the list row already carries
  // `layout_id` and `status`, so a player with fifty rounds across six courses
  // still only loads the ones that can say anything about these holes.
  const historyRoundIds = useMemo(() => {
    if (!layout) return []
    return (roundsQuery.data ?? [])
      .filter((round) => round.layout_id === layout.id && round.status === 'completed')
      .map((round) => round.id)
  }, [layout, roundsQuery.data])

  useEffect(() => {
    let active = true
    if (historyRoundIds.length === 0) {
      setDetails({})
      return () => {
        active = false
      }
    }

    Promise.all(
      historyRoundIds.map(async (roundId) => {
        try {
          return [roundId, await loadRound(roundId, user.id)]
        } catch {
          // A round that will not load is one round of evidence missing, not a
          // reason to withhold the whole sheet — the course half of this page
          // does not depend on it at all.
          return [roundId, null]
        }
      }),
    ).then((entries) => {
      if (active) setDetails(Object.fromEntries(entries))
    })

    return () => {
      active = false
    }
  }, [historyRoundIds, user.id])

  const rounds = useMemo(
    () => historyRoundIds.map((roundId) => details[roundId]).filter(Boolean),
    [details, historyRoundIds],
  )
  const brief = useMemo(() => layoutBrief(layout), [layout])
  const entries = useMemo(() => holePrep(layout, rounds), [layout, rounds])
  const priority = useMemo(() => priorityHoles(entries), [entries])
  const coverage = useMemo(() => lockerCoverage(layout, discsQuery.data ?? []), [discsQuery.data, layout])

  if (error) return <p className="form-error">{error}</p>
  if (!course) return <p className="loading">Loading course prep...</p>

  const playedRounds = rounds.length

  return (
    <section className="course-prep-page">
      <header className="practice-header">
        <div>
          <h1>{course.name}</h1>
          <p className="log-time">{layout ? `Prep · ${layout.name}` : 'Prep'}</p>
        </div>
        <Link to={`/courses/${course.id}`} className="link-button">
          Course
        </Link>
      </header>

      {layouts.length === 0 ? (
        <div className="empty-state">
          <p>This course has no layout yet, so there is nothing to prepare from.</p>
          <Link to="/courses/new" className="btn-primary">
            Build a course
          </Link>
        </div>
      ) : (
        <>
          {layouts.length > 1 && (
            <div className="chip-row" role="group" aria-label="Layout">
              {layouts.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`chip ${row.id === layout.id ? 'chip-active' : ''}`}
                  aria-pressed={row.id === layout.id}
                  onClick={() => setSearchParams({ layoutId: row.id }, { replace: true })}
                >
                  {row.name}
                </button>
              ))}
            </div>
          )}

          <section className="course-section" aria-labelledby="prep-brief-title">
            <div className="section-heading-row">
              <h2 id="prep-brief-title">The layout</h2>
              <Link
                to={`/rounds/new?courseId=${course.id}&layoutId=${layout.id}`}
                className="btn-primary course-start-button"
              >
                Start round
              </Link>
            </div>

            {brief.holeCount === 0 ? (
              <div className="empty-state">
                <p>No holes are recorded for this layout yet.</p>
              </div>
            ) : (
              <div className="prep-brief">
                <p className="prep-brief-headline">
                  {brief.holeCount} {brief.holeCount === 1 ? 'hole' : 'holes'} · par {brief.parTotal}
                  {brief.holesWithDistance > 0 ? ` · ${formatFeet(brief.distanceTotalFeet)}` : ''}
                </p>

                {/* A quick course is typed in at the first tee and half its
                    distances are usually blank. Saying so is the difference
                    between a short course and an incomplete record. */}
                {brief.holesWithoutDistance > 0 && (
                  <p className="log-time">
                    Distance recorded on {brief.holesWithDistance} of {brief.holeCount} holes
                    {brief.holesWithDistance > 0 ? '; the total above covers only those.' : '.'}
                  </p>
                )}

                {brief.longest && (
                  <p className="log-time">
                    Longest hole {brief.longest.holeNumber} at {formatFeet(brief.longest.distanceFeet)} · shortest hole{' '}
                    {brief.shortest.holeNumber} at {formatFeet(brief.shortest.distanceFeet)}
                  </p>
                )}

                {brief.parMix.length > 0 && (
                  <p className="log-time">
                    {brief.parMix.map((row) => `${row.holes} × par ${row.par}`).join(' · ')}
                  </p>
                )}

                {brief.bands.length > 0 && (
                  <ul className="putt-log-list">
                    {brief.bands.map((band) => (
                      <li key={band.key} className="putt-log-row">
                        <span>{band.label}</span>
                        <span>
                          {band.holes} {band.holes === 1 ? 'hole' : 'holes'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {(brief.documented.hazards > 0 || brief.documented.strategyNotes > 0) && (
                  <p className="log-time">
                    Notes on file: {brief.documented.hazards} hazard, {brief.documented.strategyNotes} strategy
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Only ever rendered once at least one hole cleared the sample floor
              in `priorityHoles`, so there is no empty-heading state to design. */}
          {priority.length > 0 && (
            <section className="course-section" aria-labelledby="prep-priority-title">
              <div className="section-heading-row">
                <h2 id="prep-priority-title">Where the strokes go</h2>
                <span className="log-time">
                  {playedRounds} {playedRounds === 1 ? 'round' : 'rounds'} here
                </span>
              </div>
              <ul className="putt-log-list">
                {priority.map((entry) => (
                  <li key={entry.holeId} className="putt-log-row">
                    <span>{holeTitle(entry)}</span>
                    <span>{formatAverage(entry.averageRelativeToPar)}</span>
                    <span className="log-time">over {entry.playedRounds} rounds</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {brief.holeCount > 0 && (
            <section className="course-section" aria-labelledby="prep-holes-title">
              <div className="section-heading-row">
                <h2 id="prep-holes-title">Hole by hole</h2>
                <span className="log-time">{brief.holeCount} holes</span>
              </div>

              {/* The state this ships into: a real catalog with no rounds
                  behind it. Said once, here, rather than as a repeated absence
                  on every hole below. */}
              {playedRounds === 0 && (
                <p className="log-time">
                  No completed rounds on this layout yet. Your scoring and disc history fill in here as you play it.
                </p>
              )}

              <ol className="prep-hole-list">
                {entries.map((entry) => {
                  const history = historyLine(entry)
                  return (
                    <li key={entry.holeId} className="prep-hole">
                      <div className="prep-hole-head">
                        <strong>{holeTitle(entry)}</strong>
                        <span>
                          Par {entry.par ?? '—'} ·{' '}
                          {entry.distanceFeet != null ? formatFeet(entry.distanceFeet) : 'distance —'}
                        </span>
                      </div>

                      {entry.hazards && <p className="prep-hole-hazards">Hazards: {entry.hazards}</p>}
                      {entry.strategyNotes && <p className="prep-hole-strategy">{entry.strategyNotes}</p>}

                      {history && <p className="prep-hole-history">{history}</p>}

                      {/* Not a recommendation — a record. "You have thrown this
                          here" is a fact the player can check; "throw this
                          here" would be a claim this app cannot support from
                          the data it holds. */}
                      {entry.discs.length > 0 && (
                        <p className="prep-hole-discs">
                          Thrown here:{' '}
                          {entry.discs
                            .map((row) => {
                              const label = `${discLabel(row.disc)} ×${row.throws}`
                              return row.averageRelativeToPar == null
                                ? label
                                : `${label} (${formatAverage(row.averageRelativeToPar)})`
                            })
                            .join(' · ')}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          {coverage.discCount > 0 && coverage.bands.length > 0 && (
            <section className="course-section" aria-labelledby="prep-bag-title">
              <div className="section-heading-row">
                <h2 id="prep-bag-title">What you carry</h2>
              </div>
              {/* Two counts printed beside each other, on purpose. Nothing here
                  says a bag is wrong for a course: that would need a model of
                  how far this player throws, which no table in this app
                  records. See the header of `lib/insights/coursePrep.js`. */}
              <p className="log-time">
                {coverage.discCount} {coverage.discCount === 1 ? 'disc' : 'discs'} in your locker, against this
                layout&apos;s distances.
              </p>
              <ul className="putt-log-list">
                {coverage.categories.map((row) => (
                  <li key={row.category} className="putt-log-row">
                    <span>{row.category}</span>
                    <span>
                      {row.discs} {row.discs === 1 ? 'disc' : 'discs'}
                    </span>
                  </li>
                ))}
              </ul>
              {coverage.uncategorized > 0 && (
                <p className="log-time">
                  {coverage.uncategorized} {coverage.uncategorized === 1 ? 'disc has' : 'discs have'} no catalog
                  category, so {coverage.uncategorized === 1 ? 'it is' : 'they are'} not counted above.
                </p>
              )}
            </section>
          )}

          {roundsQuery.error && (
            <p className="form-info">Round history unavailable; the course details above are unaffected.</p>
          )}
        </>
      )}
    </section>
  )
}
