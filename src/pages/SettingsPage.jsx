import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchProfile, upsertProfileFields } from '../lib/profile'
import { getFlairMode, setFlairMode } from '../lib/viewPreference'
import { NOTIFICATION_PREFERENCE_CATEGORIES, isValidIanaTimezone, preferenceMap } from '../lib/notificationPreferences'
import { settingsRepository } from '../lib/repository/settingsRepository'
import DataExportPanel from '../components/DataExportPanel'

export default function SettingsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [preferences, setPreferences] = useState([])
  const [flairEnabled, setFlairEnabled] = useState(getFlairMode)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchProfile(user.id), settingsRepository.listNotificationPreferences(user.id)])
      .then(([nextProfile, nextPreferences]) => { setProfile(nextProfile ?? { id: user.id }); setPreferences(nextPreferences) })
      .catch((err) => setError(err.message))
  }, [user.id])

  async function saveProfile(fields) {
    const next = await upsertProfileFields(user.id, fields)
    setProfile(next)
  }

  async function toggleCategory(category, enabled) {
    const next = await settingsRepository.setNotificationPreference(user.id, category, enabled)
    setPreferences((rows) => [...rows.filter((row) => row.category !== category), next])
  }

  async function saveTimezone(value) {
    const timezone = value.trim() || 'UTC'
    if (!isValidIanaTimezone(timezone)) throw new Error('Use a valid IANA timezone, such as America/New_York.')
    await saveProfile({ timezone })
  }

  if (error) return <p className="form-error">Settings unavailable: {error}</p>
  if (!profile) return <p className="loading">Loading settings…</p>
  const enabledByCategory = preferenceMap(preferences)

  return <section className="settings-page">
    <section className="profile-section" aria-labelledby="app-settings-title">
      <div className="profile-section-header"><h2 id="app-settings-title">App preferences</h2></div>
      <label className="preference-toggle" htmlFor="disc-card-flair"><span className="preference-toggle-copy"><strong>Game-flair disc cards</strong><small>Show rarity borders, stat blocks, and mount motion on this device.</small></span><input id="disc-card-flair" type="checkbox" checked={flairEnabled} onChange={(event) => { setFlairEnabled(event.target.checked); setFlairMode(event.target.checked) }} /></label>
      <label className="preference-toggle" htmlFor="round-turn-prompt"><span className="preference-toggle-copy"><strong>Round-turn check-in</strong><small>Show a brief pace and focus reminder after the front nine.</small></span><input id="round-turn-prompt" type="checkbox" checked={profile.round_turn_prompt_enabled ?? true} onChange={(event) => saveProfile({ round_turn_prompt_enabled: event.target.checked }).catch((err) => setError(err.message))} /></label>
      <label className="settings-timezone" htmlFor="profile-timezone"><span><strong>Reporting timezone</strong><small>Defines Monday–Sunday weekly report boundaries.</small></span><input id="profile-timezone" value={profile.timezone ?? 'UTC'} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} onBlur={(event) => saveTimezone(event.target.value).catch((err) => setError(err.message))} /></label>
    </section>
    <section className="profile-section" aria-labelledby="notification-settings-title">
      <div className="profile-section-header"><h2 id="notification-settings-title">Optional notifications</h2></div>
      <p className="settings-note">Critical sync and data-safety alerts always remain on.</p>
      {NOTIFICATION_PREFERENCE_CATEGORIES.map((category) => <label className="preference-toggle" htmlFor={`notification-${category.id}`} key={category.id}><span className="preference-toggle-copy"><strong>{category.label}</strong><small>{category.description}</small></span><input id={`notification-${category.id}`} type="checkbox" checked={enabledByCategory.get(category.id) ?? true} onChange={(event) => toggleCategory(category.id, event.target.checked).catch((err) => setError(err.message))} /></label>)}
    </section>
    <DataExportPanel />
  </section>
}
