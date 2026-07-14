// Behavioral toggles surfaced on Screen 10 (Analytics & Settings Control Tower):
// display units, the default batch-ribbon stack size, and a global haptics
// switch. Persisted in localStorage (device-scoped, no server round-trip) with
// the same defensive try/catch shell as viewPreference.js — private-browsing or
// a full quota just falls back to defaults rather than crashing.
//
// Pure merge/validate helpers (applySettings/normalizeSettings) are separated
// from the impure read/write so they stay unit-testable without a localStorage
// global (this repo's vitest has no jsdom).
const STORAGE_KEY = 'discgolf.appSettings.v1'

export const UNIT_OPTIONS = ['feet', 'meters']
// Batch ribbon default volume — bounded so a toggle can never plan a stage
// larger than the capture UI comfortably renders. Distinct from the 100-putt
// per-routine interlock (that caps a whole builder; this is one stage's default).
export const STACK_SIZE_MIN = 5
export const STACK_SIZE_MAX = 50

export function defaultAppSettings() {
  return {
    // The app is feet-native (CLAUDE.md: "Distance in feet"); the unit toggle
    // is a display preference reserved for a future metric conversion pass, so
    // it defaults to feet and does not (yet) re-scale stored distances.
    units: 'feet',
    defaultStackSize: 10,
    hapticsEnabled: true,
  }
}

function clampStackSize(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return defaultAppSettings().defaultStackSize
  return Math.min(STACK_SIZE_MAX, Math.max(STACK_SIZE_MIN, Math.round(n)))
}

// Coerces an arbitrary parsed blob into a valid, fully-populated settings
// object — unknown/old shapes degrade to defaults field-by-field rather than
// wiping the whole object.
export function normalizeSettings(raw) {
  const base = defaultAppSettings()
  if (!raw || typeof raw !== 'object') return base
  return {
    units: UNIT_OPTIONS.includes(raw.units) ? raw.units : base.units,
    defaultStackSize: raw.defaultStackSize == null ? base.defaultStackSize : clampStackSize(raw.defaultStackSize),
    hapticsEnabled: typeof raw.hapticsEnabled === 'boolean' ? raw.hapticsEnabled : base.hapticsEnabled,
  }
}

// Pure merge of a partial update onto current settings (re-normalized).
export function applySettings(current, partial) {
  return normalizeSettings({ ...normalizeSettings(current), ...partial })
}

export function readAppSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeSettings(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultAppSettings()
  }
}

export function writeAppSettings(settings) {
  const next = normalizeSettings(settings)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore — in-memory value is still correct, it just won't persist
  }
  return next
}

export function updateAppSettings(partial) {
  return writeAppSettings(applySettings(readAppSettings(), partial))
}
