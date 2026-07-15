import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchBags } from '../lib/discLocker'
import { fetchCourse, fetchCourses } from '../lib/roundLog'
import { parTotal } from '../lib/rounds'
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

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedCourseId || !selectedLayoutId) {
      setError('Choose a course and layout first')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const round = await createRound.mutateAsync({
        course_id: selectedCourseId,
        layout_id: selectedLayoutId,
        bag_id: selectedBagId || null,
        status: 'in_progress',
        played_at: new Date().toISOString(),
      })
      navigate(`/rounds/${round.id}`)
    } catch (err) {
      if (err.localResult?.id) {
        navigate(`/rounds/${err.localResult.id}`)
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

          <label htmlFor="round-layout">Layout</label>
          <select
            id="round-layout"
            value={selectedLayoutId}
            onChange={(event) => setSelectedLayoutId(event.target.value)}
            disabled={loadingCourse || !course?.layouts.length}
          >
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

          <button type="submit" className="btn-primary" disabled={saving || loadingCourse || !selectedLayout}>
            {saving ? 'Starting…' : 'Start round'}
          </button>
        </form>
      )}
    </section>
  )
}
