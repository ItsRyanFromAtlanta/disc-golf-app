export const LOST_FOUND_EVENT_LABELS = Object.freeze({
  reported_lost: 'Reported lost',
  location_updated: 'Location updated',
  sighting: 'Sighting',
  contact_updated: 'Contact updated',
  note_added: 'Note added',
  recovered: 'Recovered',
  closed: 'Closed unresolved',
})

export const LOST_FOUND_UPDATE_TYPES = Object.freeze([
  'location_updated',
  'sighting',
  'contact_updated',
  'note_added',
])

export function discDisplayName(disc) {
  return disc?.nickname || disc?.moldInfo?.mold_name || disc?.mold || 'Unknown disc'
}

export function normalizeLostFoundFields(fields = {}) {
  const latitude = fields.latitude === '' || fields.latitude == null ? null : Number(fields.latitude)
  const longitude = fields.longitude === '' || fields.longitude == null ? null : Number(fields.longitude)
  if ((latitude == null) !== (longitude == null)) throw new Error('Latitude and longitude must be provided together')
  if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    throw new Error('Latitude must be between -90 and 90')
  }
  if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw new Error('Longitude must be between -180 and 180')
  }
  return {
    courseId: fields.courseId || null,
    areaText: fields.areaText?.trim() || null,
    latitude,
    longitude,
    notes: fields.notes?.trim() || null,
    contactName: fields.contactName?.trim() || null,
    contactValue: fields.contactValue?.trim() || null,
  }
}

export function sortLostFoundCases(cases) {
  return [...cases].sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1
    if (a.status !== 'open' && b.status === 'open') return 1
    return new Date(b.latest_update_at) - new Date(a.latest_update_at)
  })
}
