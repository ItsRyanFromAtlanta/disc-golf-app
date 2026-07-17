import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchUserDiscs } from '../lib/discLocker'
import { fetchCourses } from '../lib/roundLog'
import { discDisplayName, LOST_FOUND_EVENT_LABELS, LOST_FOUND_UPDATE_TYPES } from '../lib/lostFound'
import {
  appendLostFoundUpdate,
  flushLostFoundOutbox,
  loadLostFoundCases,
  openLostFoundCase,
} from '../lib/repository/lostFoundRepository'

const EMPTY_FIELDS = {
  courseId: '',
  areaText: '',
  latitude: '',
  longitude: '',
  notes: '',
  contactName: '',
  contactValue: '',
}

function CaseTimeline({ caseRow, updates, coursesById }) {
  return (
    <ol className="lost-found-timeline">
      {updates
        .filter((update) => update.case_id === caseRow.id)
        .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
        .map((update) => (
          <li key={update.id}>
            <strong>{LOST_FOUND_EVENT_LABELS[update.event_type]}</strong>
            <span className="log-time">{new Date(update.occurred_at).toLocaleString()}</span>
            {update.course_id && <span>{coursesById.get(update.course_id)?.name ?? 'Course'}</span>}
            {update.area_text && <span>{update.area_text}</span>}
            {update.latitude != null && <span>{Number(update.latitude).toFixed(5)}, {Number(update.longitude).toFixed(5)}</span>}
            {update.notes && <span>{update.notes}</span>}
            {update.contact_value && <span>Contact: {update.contact_name ? `${update.contact_name} — ` : ''}{update.contact_value}</span>}
            {update.pending && <span className="zone-badge">Waiting to sync</span>}
          </li>
        ))}
    </ol>
  )
}

export default function LostFoundPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [discs, setDiscs] = useState([])
  const [courses, setCourses] = useState([])
  const [cases, setCases] = useState([])
  const [updates, setUpdates] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [discId, setDiscId] = useState(searchParams.get('disc') ?? '')
  const [eventType, setEventType] = useState('note_added')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    await flushLostFoundOutbox(user.id)
    const [discRows, courseRows, lostFound] = await Promise.all([
      fetchUserDiscs(user.id),
      fetchCourses(),
      loadLostFoundCases(user.id),
    ])
    setDiscs(discRows)
    setCourses(courseRows)
    setCases(lostFound.cases)
    setUpdates(lostFound.updates)
    setDiscId((current) => current || discRows.find((disc) => !['retired', 'sold'].includes(disc.status))?.id || '')
    setSelectedCaseId((current) => current || lostFound.cases[0]?.id || '')
  }, [user.id])

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [load])

  const discsById = useMemo(() => new Map(discs.map((disc) => [disc.id, disc])), [discs])
  const coursesById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const openDiscIds = useMemo(() => new Set(cases.filter((row) => row.status === 'open').map((row) => row.disc_id)), [cases])
  const reportableDiscs = discs.filter((disc) => !['retired', 'sold'].includes(disc.status) && !openDiscIds.has(disc.id))
  const selectedCase = cases.find((row) => row.id === selectedCaseId) ?? null

  function setField(name, value) {
    setFields((current) => ({ ...current, [name]: value }))
  }

  function useCurrentLocation() {
    setError(null)
    if (!navigator.geolocation) {
      setError('Location is not available in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setFields((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })),
      (locationError) => setError(locationError.message),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function submitOpen(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const result = await openLostFoundCase({ userId: user.id, discId, ...fields })
      setNotice(result.queued ? 'Saved on this device. It will sync when connectivity returns.' : 'Lost disc case opened.')
      setFields(EMPTY_FIELDS)
      setSelectedCaseId(result.caseId)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function submitUpdate(event, terminalType = null) {
    event.preventDefault()
    if (!selectedCase) return
    setSaving(true)
    setError(null)
    try {
      const result = await appendLostFoundUpdate({
        userId: user.id,
        caseId: selectedCase.id,
        eventType: terminalType ?? eventType,
        ...fields,
      })
      setNotice(result.queued ? 'Saved on this device. It will sync when connectivity returns.' : 'Case timeline updated.')
      setFields(EMPTY_FIELDS)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function renderFieldControls(prefix) {
    return (
    <div className="lost-found-fields">
      <label htmlFor={`${prefix}-course`}>Course (optional)</label>
      <select id={`${prefix}-course`} value={fields.courseId} onChange={(e) => setField('courseId', e.target.value)}>
        <option value="">No course selected</option>
        {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
      </select>
      <label htmlFor={`${prefix}-area`}>Hole or area</label>
      <input id={`${prefix}-area`} maxLength={500} value={fields.areaText} onChange={(e) => setField('areaText', e.target.value)} placeholder="Hole 7, left rough" />
      <div className="lost-found-coordinate-grid">
        <label>Latitude<input type="number" step="0.000001" value={fields.latitude} onChange={(e) => setField('latitude', e.target.value)} /></label>
        <label>Longitude<input type="number" step="0.000001" value={fields.longitude} onChange={(e) => setField('longitude', e.target.value)} /></label>
      </div>
      <button type="button" className="link-button" onClick={useCurrentLocation}>Use current location</button>
      <label htmlFor={`${prefix}-notes`}>Notes</label>
      <textarea id={`${prefix}-notes`} maxLength={4000} rows={3} value={fields.notes} onChange={(e) => setField('notes', e.target.value)} />
      <label htmlFor={`${prefix}-contact-name`}>Contact name</label>
      <input id={`${prefix}-contact-name`} maxLength={200} value={fields.contactName} onChange={(e) => setField('contactName', e.target.value)} />
      <label htmlFor={`${prefix}-contact-value`}>Contact details</label>
      <input id={`${prefix}-contact-value`} maxLength={500} value={fields.contactValue} onChange={(e) => setField('contactValue', e.target.value)} placeholder="Phone, email, or clubhouse" />
    </div>
    )
  }

  return (
    <section className="lost-found-page">
      <header className="practice-header">
        <div><p className="eyebrow">Disc recovery</p><h1>Lost &amp; Found</h1></div>
        <Link to="/bag/locker" className="link-button">Locker</Link>
      </header>
      <p>Keep a private, offline-ready history of where a disc was lost, sightings, contacts, and recovery.</p>
      {error && <p className="form-error">{error}</p>}
      {notice && <p className="success-message">{notice}</p>}

      <form className="lost-found-panel" onSubmit={submitOpen}>
        <h2>Report a lost disc</h2>
        {reportableDiscs.length ? (
          <>
            <label htmlFor="lf-disc">Disc</label>
            <select id="lf-disc" required value={discId} onChange={(e) => setDiscId(e.target.value)}>
              <option value="">Choose a disc</option>
              {reportableDiscs.map((disc) => <option key={disc.id} value={disc.id}>{discDisplayName(disc)}</option>)}
            </select>
            {renderFieldControls('lost-report')}
            <button className="start-button" disabled={saving || !discId}>{saving ? 'Saving…' : 'Open case'}</button>
          </>
        ) : <p>Every eligible disc already has an open case, or there are no active discs.</p>}
      </form>

      <section className="lost-found-panel">
        <h2>Case history</h2>
        {!cases.length ? <p>No Lost &amp; Found cases yet.</p> : (
          <>
            <div className="lost-found-case-list">
              {cases.map((caseRow) => (
                <button key={caseRow.id} type="button" className={`history-row ${selectedCaseId === caseRow.id ? 'lost-found-case-active' : ''}`} onClick={() => setSelectedCaseId(caseRow.id)}>
                  <span>{discDisplayName(discsById.get(caseRow.disc_id))}</span>
                  <span className={caseRow.status === 'open' ? 'abandoned-badge' : 'zone-badge'}>{caseRow.status}{caseRow.pending ? ' · pending' : ''}</span>
                </button>
              ))}
            </div>
            {selectedCase && (
              <div className="lost-found-case-detail">
                <h3><Link to={`/bag/discs/${selectedCase.disc_id}`}>{discDisplayName(discsById.get(selectedCase.disc_id))}</Link></h3>
                <CaseTimeline caseRow={selectedCase} updates={updates} coursesById={coursesById} />
                {selectedCase.status === 'open' && (
                  <form onSubmit={submitUpdate}>
                    <label htmlFor="lf-event">Update type</label>
                    <select id="lf-event" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                      {LOST_FOUND_UPDATE_TYPES.map((type) => <option key={type} value={type}>{LOST_FOUND_EVENT_LABELS[type]}</option>)}
                    </select>
                    {renderFieldControls('case-update')}
                    <button className="link-button" disabled={saving}>Add update</button>
                    <div className="lost-found-resolution-actions">
                      <button type="button" className="start-button" disabled={saving} onClick={(e) => submitUpdate(e, 'recovered')}>Mark recovered</button>
                      <button type="button" className="link-button" disabled={saving} onClick={(e) => submitUpdate(e, 'closed')}>Close unresolved</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </section>
  )
}
