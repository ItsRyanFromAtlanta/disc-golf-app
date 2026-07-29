import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCreateCourse } from '../lib/repository/courseRepository'

export default function CourseFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const createCourse = useCreateCourse(user.id)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [holeCount, setHoleCount] = useState('9')
  const [defaultPar, setDefaultPar] = useState('3')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const count = Math.max(1, Math.min(36, Number(holeCount) || 0))
      const par = Math.max(2, Math.min(6, Number(defaultPar) || 3))
      const course = await createCourse.mutateAsync({
        name,
        location,
        holes: Array.from({ length: count }, (_, index) => ({ holeNumber: index + 1, par })),
      })
      navigate(`/courses/${course.id}`)
    } catch (err) {
      // The course is queued and mirrored locally even when the write could not
      // be sent, so this is not a dead end — but it must not look like a
      // success either. The directory is where its state is legible (badge,
      // count banner, retry), and the detail screen reads from the server, so
      // that is where an unsent course goes rather than a page that would fail
      // to load.
      if (err.localResult?.id) {
        navigate('/courses')
        return
      }
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="course-form-page">
      <header className="practice-header">
        <h1>Quick course</h1>
        <Link to="/courses" className="link-button">
          Cancel
        </Link>
      </header>

      <p className="form-info">Create a lightweight course now and enrich its hole details later.</p>
      <p className="form-info">
        No signal? The course is saved on this device and uploaded when you are back online.
      </p>
      {error && <p className="form-error">{error}</p>}

      <form className="putt-form" onSubmit={handleSubmit}>
        <label htmlFor="course-name">Course name</label>
        <input id="course-name" type="text" required value={name} onChange={(event) => setName(event.target.value)} />

        <label htmlFor="course-location">Location</label>
        <input id="course-location" type="text" value={location} onChange={(event) => setLocation(event.target.value)} />

        <label htmlFor="course-hole-count">Number of holes</label>
        <input
          id="course-hole-count"
          type="number"
          min="1"
          max="36"
          required
          value={holeCount}
          onChange={(event) => setHoleCount(event.target.value)}
        />

        <label htmlFor="course-default-par">Default par per hole</label>
        <input
          id="course-default-par"
          type="number"
          min="2"
          max="6"
          required
          value={defaultPar}
          onChange={(event) => setDefaultPar(event.target.value)}
        />

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create course'}
        </button>
      </form>
    </section>
  )
}
