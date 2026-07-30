import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchBags } from '../lib/discLocker'
import { fetchCourse, fetchCourses } from '../lib/roundLog'
import { parTotal } from '../lib/rounds'
import { roundScoringModeFields } from '../lib/roundScoring'
import { useCreateRound } from '../lib/repository/roundRepository'

export default function RoundStartPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedCourseId = searchParams.get('courseId')
  const requestedLayoutId = searchParams.get('layoutId')
  const [courses, setCourses] = useState(null)
  const [bags, setBags] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState(requestedCourseId ?? '')
  const [selectedLayoutId, setSelectedLayoutId] = useState(requestedLayoutId ?? '')
  const [selectedBagId, setSelectedBagId] = useState('')
  const [scoringMode, setScoringMode] = useState('hole_by_hole')
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingCourse, setLoadingCourse] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const createRound = useCreateRound(user.id)

  useEffect(() => {
    let active = true
    Promise.all([fetchCourses(), fetchBags(user.id)])
      .then(([courseRows, bagRows]) => {
        if (!active) return
        setCourses(courseRows)
        setBags(bagRows)
        setSelectedCourseId((current) => {
          if (courseRows.some((row) => row.id === current)) return current
          return courseRows[0]?.id ?? ''
        })
        if (bagRows.length > 0) {
          const defaultBag = bagRows.find((bag) => bag.is_default) ?? bagRows[0]
          setSelectedBagId(defaultBag.id)
        }
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user.id])

  useEffect(() => {
    if (!selectedCourseId) {
      setCourse(null)
      return undefined
    }
    let active = true
    setLoadingCourse(true)
    fetchCourse(selectedCourseId)
      .then((value) => {
        if (!active) return
        setCourse(value)
        setSelectedLayoutId((current) => {
          if (value.layouts.some((layout) => layout.id === current)) return current
          const preferred = value.layouts.find((layout) => layout.is_default) ?? value.layouts[0]
          return preferred?.id ?? ''
        })
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoadingCourse(false)
      })

    return () => {
      active = false
    }
  }, [selectedCourseId])

  const selectedLayout = useMemo(
    () => course?.layouts.find((layout) => layout.id === selectedLayoutId) ?? null,
    [course, selectedLayoutId],
  )

  const activityOnly = scoringMode === 'activity_only'

  // An activity-only round still names a course — `rounds.course_id` is NOT
  // NULL, and the course is what makes the entry a round rather than a diary
  // line. The layout is what becomes optional: without per-hole scoring the tee
  // set changes nothing, and requiring a choice the round will never use is the
  // friction this whole feature exists to remove.
  function destinationFor(roundId) {
    return activityOnly ? `/rounds/${roundId}/summary` : `/rounds/${roundId}`
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedCourseId || (!activityOnly && !selectedLayoutId)) {
      setError(activityOnly ? 'Choose a course first' : 'Choose a course and layout first')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const round = await createRound.mutateAsync({
        course_id: selectedCourseId,
        layout_id: selectedLayoutId || null,
        bag_id: selectedBagId || null,
        status: 'in_progress',
        played_at: new Date().toISOString(),
        ...roundScoringModeFields(scoringMode),
      })
      navigate(destinationFor(round.id))
    } catch (err) {
      if (err.localResult?.id) {
        navigate(destinationFor(err.localResult.id))
        return
      }
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="loading">Loading round setup...</p>

  return (
    <section className="round-start-page">
      <header className="practice-header">
        <h1>Start round</h1>
        <Link to="/courses" className="link-button">
          Cancel
        </Link>
      </header>

      {error && <p className="form-error">{error}</p>}
      {courses?.length === 0 ? (
        <div className="empty-state">
          <p>Create a quick course before starting a round.</p>
          <Link to="/courses/new" className="btn-primary">
            Add course
          </Link>
        </div>
      ) : (
        <form className="putt-form" onSubmit={handleSubmit}>
          {/* Chosen before anything else, because it changes what the rest of
              the form is for. Two real radios rather than the ChipGroup used
              elsewhere: this is a mutually-exclusive choice that cannot be
              cleared, which is a radiogroup, and ChipGroup deliberately
              declines that role (see its header). */}
          <fieldset className="round-mode-field">
            <legend>How are you logging this round?</legend>
            <label className="round-mode-option">
              <input
                type="radio"
                name="round-scoring-mode"
                value="hole_by_hole"
                checked={!activityOnly}
                onChange={() => setScoringMode('hole_by_hole')}
              />
              <span>
                <strong>Full scorecard</strong>
                <small>Enter a score on every hole.</small>
              </span>
            </label>
            <label className="round-mode-option">
              <input
                type="radio"
                name="round-scoring-mode"
                value="activity_only"
                checked={activityOnly}
                onChange={() => setScoringMode('activity_only')}
              />
              <span>
                <strong>Activity only</strong>
                <small>Log that you played. No per-hole scoring; a total is optional.</small>
              </span>
            </label>
          </fieldset>

          <label htmlFor="round-course">Course</label>
          <select
            id="round-course"
            value={selectedCourseId}
            onChange={(event) => {
              setSelectedCourseId(event.target.value)
              setSelectedLayoutId('')
            }}
          >
            {courses?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>

          <label htmlFor="round-layout">{activityOnly ? 'Layout (optional)' : 'Layout'}</label>
          <select
            id="round-layout"
            value={selectedLayoutId}
            onChange={(event) => setSelectedLayoutId(event.target.value)}
            disabled={loadingCourse || !course?.layouts.length}
          >
            {/* Offered only when the round has no scorecard to hang on it.
                Naming a layout is still worth doing there — it is what lets an
                optional total become a relative-to-par — but it must not be
                mandatory for a round that will never score a hole. */}
            {activityOnly && <option value="">No layout recorded</option>}
            {course?.layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {layout.name} · {layout.holes.length} holes
              </option>
            ))}
          </select>

          <label htmlFor="round-bag">Bag (optional)</label>
          <select id="round-bag" value={selectedBagId} onChange={(event) => setSelectedBagId(event.target.value)}>
            <option value="">No bag selected</option>
            {bags.map((bag) => (
              <option key={bag.id} value={bag.id}>
                {bag.name}
              </option>
            ))}
          </select>

          {selectedLayout && (
            <p className="form-info">
              {selectedLayout.holes.length} holes · par {parTotal(selectedLayout.holes)}
            </p>
          )}

          {/* The last moment before a round where prep is still useful, and the
              one screen that already knows exactly which layout is about to be
              played. Shown whenever a layout is selected, including on an
              activity-only round: not scoring a card is no reason not to read
              the holes. */}
          {selectedLayout && (
            <Link to={`/courses/${selectedCourseId}/prep?layoutId=${selectedLayout.id}`} className="link-button">
              View prep sheet
            </Link>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={saving || loadingCourse || (!activityOnly && !selectedLayout)}
          >
            {saving ? 'Starting…' : activityOnly ? 'Log round' : 'Start round'}
          </button>
        </form>
      )}
    </section>
  )
}
