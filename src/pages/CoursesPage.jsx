import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCourseList, useCourseSync } from '../lib/repository/courseRepository'
import { useRoundList } from '../lib/repository/roundRepository'

function courseLocation(course) {
  return course.location || 'Location not set'
}

function holeCount(course) {
  const layout = course.layouts?.find((row) => row.is_default) ?? course.layouts?.[0]
  return layout?.holes?.length ?? null
}

export default function CoursesPage() {
  const { user } = useAuth()
  const coursesQuery = useCourseList()
  const roundsQuery = useRoundList(user.id)
  const courseSync = useCourseSync()

  const error = coursesQuery.error?.message
  const roundError = roundsQuery.error?.message
  const courses = coursesQuery.data

  if (error && !courses) return <p className="form-error">{error}</p>
  if (!courses || roundsQuery.isLoading) return <p className="loading">Loading courses...</p>

  const recentRounds = (roundsQuery.data ?? []).slice(0, 3)
  const { queuedCourseIds, failedCourseIds } = courseSync
  // Queued-but-not-failed is "not yet"; failed is "not without your help". They
  // read differently to a user, so they are counted and worded separately.
  const waitingCount = queuedCourseIds.filter((id) => !failedCourseIds.includes(id)).length

  return (
    <section className="course-page">
      <header className="practice-header">
        <h1>Courses</h1>
        <Link to="/courses/new" className="start-button">
          Add course
        </Link>
      </header>

      {(error || roundError) && <p className="form-error">{error || roundError}</p>}

      {/* A course that never reached the server must not look identical to one
          that did (E2 finding 2, applied to courses). The per-row badge alone is
          not enough: a course whose create poisoned is missing from the remote
          directory entirely, so the count is what makes it findable. */}
      {waitingCount > 0 && (
        <p className="form-info" role="status">
          {waitingCount === 1 ? '1 course is' : `${waitingCount} courses are`} saved on this device and waiting to
          upload. You can start a round on {waitingCount === 1 ? 'it' : 'them'} once the upload finishes.
        </p>
      )}

      {failedCourseIds.length > 0 && (
        <p className="form-error" role="status">
          {failedCourseIds.length === 1
            ? '1 course could not be uploaded.'
            : `${failedCourseIds.length} courses could not be uploaded.`}{' '}
          They are saved on this device only.{' '}
          <button type="button" className="link-button" onClick={courseSync.retrySync}>
            Retry course upload
          </button>
        </p>
      )}

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
            {courses.map((course) => {
              const failed = failedCourseIds.includes(course.id)
              const queued = queuedCourseIds.includes(course.id)
              const holes = holeCount(course)
              const detail = holes ? `${courseLocation(course)} · ${holes} holes` : courseLocation(course)

              // Not a link while queued: the detail screen and the round-start
              // picker both read the course back from the server, and sending
              // someone to a page that cannot load is worse than not offering it.
              if (queued) {
                return (
                  <li key={course.id}>
                    <div className="course-card" aria-disabled="true">
                      <span>
                        <strong>{course.name}</strong>
                        <small>{detail}</small>
                        <span
                          className={`history-sync-badge ${failed ? 'history-sync-attention' : 'history-sync-pending'}`}
                        >
                          {failed ? 'Needs attention' : 'Saved on device'}
                        </span>
                      </span>
                    </div>
                  </li>
                )
              }

              return (
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
              )
            })}
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
