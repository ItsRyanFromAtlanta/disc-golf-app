import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCourse } from '../lib/roundLog'
import { parTotal } from '../lib/rounds'

export default function CourseDetailPage() {
  const { courseId } = useParams()
  const [course, setCourse] = useState(null)
  const [error, setError] = useState(null)

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

  if (error) return <p className="form-error">{error}</p>
  if (!course) return <p className="loading">Loading course...</p>

  return (
    <section className="course-detail-page">
      <header className="practice-header">
        <div>
          <h1>{course.name}</h1>
          <p className="log-time">{course.location || 'Location not set'}</p>
        </div>
        <Link to="/courses" className="link-button">
          Directory
        </Link>
      </header>

      <section className="course-section" aria-labelledby="course-layouts-title">
        <div className="section-heading-row">
          <h2 id="course-layouts-title">Layouts</h2>
          <span className="log-time">{course.layouts.length} layout{course.layouts.length === 1 ? '' : 's'}</span>
        </div>

        {course.layouts.length === 0 ? (
          <div className="empty-state">
            <p>This course has no layout holes yet.</p>
            <Link to={`/rounds/new?courseId=${course.id}`} className="btn-primary">
              Start a round
            </Link>
          </div>
        ) : (
          course.layouts.map((layout) => (
            <article key={layout.id} className="course-layout">
              <div className="section-heading-row">
                <div>
                  <h3>{layout.name}</h3>
                  <p className="log-time">
                    {layout.holes.length} holes · par {parTotal(layout.holes)}
                  </p>
                </div>
                <Link
                  to={`/rounds/new?courseId=${course.id}&layoutId=${layout.id}`}
                  className="btn-primary course-start-button"
                >
                  Start round
                </Link>
              </div>

              <ol className="course-hole-list">
                {layout.holes.map((hole) => (
                  <li key={hole.id} className="course-hole-row">
                    <strong>Hole {hole.hole_number}</strong>
                    <span>Par {hole.par}</span>
                    {hole.distance_feet ? <span>{hole.distance_feet} ft</span> : <span>Distance —</span>}
                  </li>
                ))}
              </ol>
            </article>
          ))
        )}
      </section>
    </section>
  )
}
