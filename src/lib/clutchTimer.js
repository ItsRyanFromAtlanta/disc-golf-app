export const CLUTCH_MIN_REST_MS = 2 * 60 * 1000
export const CLUTCH_MAX_REST_MS = 8 * 60 * 1000

export function createClutchDeadline(nowMs, randomValue = Math.random()) {
  const bounded = Math.max(0, Math.min(0.999999999, randomValue))
  const durationMs = CLUTCH_MIN_REST_MS
    + Math.floor(bounded * (CLUTCH_MAX_REST_MS - CLUTCH_MIN_REST_MS + 1))
  return { dueAt: new Date(nowMs + durationMs).toISOString(), durationMs }
}

export function clutchTimerState(dueAt, nowMs) {
  const dueMs = Date.parse(dueAt)
  if (!Number.isFinite(dueMs)) return { status: 'invalid', remainingMs: 0 }
  const remainingMs = Math.max(0, dueMs - nowMs)
  return { status: remainingMs === 0 ? 'putt_now' : 'resting', remainingMs }
}

export function formatClutchCountdown(remainingMs) {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export async function requestClutchNotificationPermission(notificationApi = globalThis.Notification) {
  if (!notificationApi?.requestPermission) return 'unsupported'
  if (notificationApi.permission === 'granted' || notificationApi.permission === 'denied') {
    return notificationApi.permission
  }
  return notificationApi.requestPermission()
}

export async function showClutchNotification({ serviceWorker = globalThis.navigator?.serviceWorker } = {}) {
  if (globalThis.Notification?.permission !== 'granted' || !serviceWorker?.ready) return false
  const registration = await serviceWorker.ready
  await registration.showNotification('Putt now', {
    body: 'One pressure putt. Commit to your line.',
    tag: 'clutch-putt-now',
    renotify: true,
  })
  return true
}
