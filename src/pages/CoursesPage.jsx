import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchCourses } from '../lib/roundLog'
import { useRoundList } from '../lib/repository/roundRepository'

function courseLocation(course) {
  return course.location || 'Location not set'
}

export default function CoursesPage() {
  const { user } = useAuth()
  const roundsQuery = useRoundList(user.id)
  const [courses, setCourses] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch((err) => setError(err.message))
  }, [])

  const roundError = roundsQuery.error?.message
  if (error && !courses) return <p className="form-error">{error}</p>
  if (!courses || roundsQuery.isLoading) return <p className="loading">Loading courses...</p>

  const recentRounds = (roundsQuery.data ?? []).slice(0, 3)

  return (
    <section className="course-page">
      <header className="practice-header">
        <h1>Courses</h1>
        <Link to="/courses/new" className="start-button">
          Add course
        </Link>
      </header>

      {(error || roundError) && <p className="form-error">{error || roundError}</p>}

      <section className="course-section" aria-labelledby="course-directory-title">
        <div className="section-heading-row">
          <h2 id="course-directory-title">Directory</h2>
          <span className="log-time">{courses.length} course{courses.length === 1 ? '' : 's'}</span>
        </div>
        {courses.length === 0 ? (
          <div className="empty-state">
            <p>No courses yet. Build a quick course for your next round.</p>
            <Link to="/courses/new" className="btn-primary">
              Build a course
            </Link>
          </div>
        ) : (
          <ul className="course-list">
            {courses.map((course) => (
              <li key={course.id}>
                <Link to={`/courses/${course.id}`} className="course-card">
                  <span>
                    <strong>{course.name}</strong>
                    <small>{courseLocation(course)}</small>
                  </span>
                  <span className="course-card-chevron" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="course-section" aria-labelledby="recent-rounds-title">
        <div className="section-heading-row">
          <h2 id="recent-rounds-title">My rounds</h2>
          <Link to="/rounds" className="link-button">
            View all
          </Link>
        </div>
        {recentRounds.length === 0 ? (
          <p className="log-time">Your played rounds will appear here.</p>
        ) : (
          <ul className="course-list">
            {recentRounds.map((round) => (
              <li key={round.id}>
                <Link to={`/rounds/${round.id}`} className="course-card">
                  <span>
                    <strong>{round.course?.name ?? 'Round'}</strong>
                    <small>{round.status === 'completed' ? 'Completed' : 'In progress'}</small>
                  </span>
                  <span className="course-card-score">{round.total_score ?? '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
