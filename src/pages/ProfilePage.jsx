import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchProfile, upsertProfileFields, isThrowingProfileEmpty } from '../lib/profile'
import { getFlairMode, setFlairMode } from '../lib/viewPreference'
import EditableSection from '../components/EditableSection'
import ChipGroup from '../components/ChipGroup'

const HANDEDNESS_OPTIONS = ['right', 'left', 'ambidextrous']
const CONFIDENCE_OPTIONS = ['none', 'developing', 'reliable', 'weapon']
const UNITS_OPTIONS = ['feet', 'meters']
const SPECIALTY_SHOTS = ['roller', 'thumber', 'tomahawk', 'grenade']

function display(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const [flairEnabled, setFlairEnabled] = useState(getFlairMode)
  const throwingRef = useRef(null)

  useEffect(() => {
    fetchProfile(user.id)
      .then((data) => setProfile(data ?? { id: user.id }))
      .catch((err) => setError(err.message))
  }, [user.id])

  async function saveFields(fields) {
    const updated = await upsertProfileFields(user.id, fields)
    setProfile(updated)
  }

  if (error) return <p className="form-error">{error}</p>
  if (!profile) return <p className="loading">Loading...</p>

  const nudgeVisible = isThrowingProfileEmpty(profile)

  return (
    <section className="profile-page">
      <header className="practice-header">
        <h1>Profile</h1>
        <Link to="/practice" className="link-button">
          Practice menu
        </Link>
      </header>

      <Link to="/profile/trophies" className="mode-card">
        <span className="mode-card-icon" aria-hidden="true">
          🏆
        </span>
        <span className="mode-card-body">
          <span className="mode-card-title">Trophy Room</span>
          <span className="mode-card-description">XP, levels, and achievement badges</span>
        </span>
        <span className="mode-card-chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <section className="profile-section profile-preferences" aria-labelledby="profile-preferences-title">
        <div className="profile-section-header">
          <h2 id="profile-preferences-title">Preferences</h2>
        </div>
        <label className="preference-toggle" htmlFor="disc-card-flair">
          <span className="preference-toggle-copy">
            <strong>Game-flair disc cards</strong>
            <small>Show rarity borders, stat blocks, and mount motion in your locker.</small>
          </span>
          <input
            id="disc-card-flair"
            type="checkbox"
            checked={flairEnabled}
            onChange={(event) => {
              const enabled = event.target.checked
              setFlairEnabled(enabled)
              setFlairMode(enabled)
            }}
          />
        </label>
      </section>

      {nudgeVisible && (
        <div className="nudge-banner">
          <p>Add your throwing profile so future features (like caddie recommendations) can use it.</p>
          <button
            type="button"
            className="chip"
            onClick={() => throwingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Fill it out
          </button>
        </div>
      )}

      <EditableSection
        title="Identity"
        values={{
          username: profile.username ?? '',
          pdga_number: profile.pdga_number ?? '',
          division: profile.division ?? '',
          handedness: profile.handedness ?? '',
        }}
        onSave={saveFields}
        renderView={(v) => (
          <dl className="profile-field-list">
            <div>
              <dt>Username</dt>
              <dd>{display(v.username)}</dd>
            </div>
            <div>
              <dt>PDGA number</dt>
              <dd>{display(v.pdga_number)}</dd>
            </div>
            <div>
              <dt>Division</dt>
              <dd>{display(v.division)}</dd>
            </div>
            <div>
              <dt>Handedness</dt>
              <dd>{display(v.handedness)}</dd>
            </div>
          </dl>
        )}
        renderEdit={(draft, setDraft) => (
          <div className="profile-edit-fields">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            />
            <label htmlFor="pdga_number">PDGA number</label>
            <input
              id="pdga_number"
              type="text"
              value={draft.pdga_number}
              onChange={(e) => setDraft({ ...draft, pdga_number: e.target.value })}
            />
            <label htmlFor="division">Division</label>
            <input
              id="division"
              type="text"
              placeholder="e.g. MA2"
              value={draft.division}
              onChange={(e) => setDraft({ ...draft, division: e.target.value })}
            />
            <label htmlFor="handedness">Handedness</label>
            <select
              id="handedness"
              value={draft.handedness}
              onChange={(e) => setDraft({ ...draft, handedness: e.target.value })}
            >
              <option value="">Not set</option>
              {HANDEDNESS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      />

      <div ref={throwingRef}>
        <EditableSection
          title="Throwing"
          values={{
            bh_confidence: profile.bh_confidence ?? 'none',
            fh_confidence: profile.fh_confidence ?? 'none',
            specialty_shots: profile.specialty_shots ?? [],
          }}
          onSave={saveFields}
          renderView={(v) => (
            <dl className="profile-field-list">
              <div>
                <dt>Backhand confidence</dt>
                <dd>{v.bh_confidence}</dd>
              </div>
              <div>
                <dt>Forehand confidence</dt>
                <dd>{v.fh_confidence}</dd>
              </div>
              <div>
                <dt>Specialty shots</dt>
                <dd>{v.specialty_shots.length ? v.specialty_shots.join(', ') : '—'}</dd>
              </div>
            </dl>
          )}
          renderEdit={(draft, setDraft) => (
            <div className="profile-edit-fields">
              <label htmlFor="bh_confidence">Backhand confidence</label>
              <select
                id="bh_confidence"
                value={draft.bh_confidence}
                onChange={(e) => setDraft({ ...draft, bh_confidence: e.target.value })}
              >
                {CONFIDENCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <label htmlFor="fh_confidence">Forehand confidence</label>
              <select
                id="fh_confidence"
                value={draft.fh_confidence}
                onChange={(e) => setDraft({ ...draft, fh_confidence: e.target.value })}
              >
                {CONFIDENCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="editor-label">Specialty shots</span>
              <ChipGroup
                options={SPECIALTY_SHOTS}
                isActive={(shot) => draft.specialty_shots.includes(shot)}
                onSelect={(shot) =>
                  setDraft({
                    ...draft,
                    specialty_shots: draft.specialty_shots.includes(shot)
                      ? draft.specialty_shots.filter((s) => s !== shot)
                      : [...draft.specialty_shots, shot],
                  })
                }
              />
            </div>
          )}
        />
      </div>

      <EditableSection
        title="Calibration"
        values={{
          bh_max_distance_ft: profile.bh_max_distance_ft ?? '',
          fh_max_distance_ft: profile.fh_max_distance_ft ?? '',
          c1_comfort_ft: profile.c1_comfort_ft ?? '',
          units: profile.units ?? 'feet',
        }}
        onSave={(draft) =>
          saveFields({
            bh_max_distance_ft: draft.bh_max_distance_ft === '' ? null : Number(draft.bh_max_distance_ft),
            bh_max_distance_source: 'self_reported',
            fh_max_distance_ft: draft.fh_max_distance_ft === '' ? null : Number(draft.fh_max_distance_ft),
            fh_max_distance_source: 'self_reported',
            c1_comfort_ft: draft.c1_comfort_ft === '' ? null : Number(draft.c1_comfort_ft),
            c1_comfort_source: 'self_reported',
            units: draft.units,
          })
        }
        renderView={(v) => (
          <dl className="profile-field-list">
            <div>
              <dt>Backhand max distance</dt>
              <dd>{v.bh_max_distance_ft === '' ? '—' : `${v.bh_max_distance_ft} ${v.units}`}</dd>
            </div>
            <div>
              <dt>Forehand max distance</dt>
              <dd>{v.fh_max_distance_ft === '' ? '—' : `${v.fh_max_distance_ft} ${v.units}`}</dd>
            </div>
            <div>
              <dt>C1 comfort distance</dt>
              <dd>{v.c1_comfort_ft === '' ? '—' : `${v.c1_comfort_ft} ${v.units}`}</dd>
            </div>
            <div>
              <dt>Units</dt>
              <dd>{v.units}</dd>
            </div>
          </dl>
        )}
        renderEdit={(draft, setDraft) => (
          <div className="profile-edit-fields">
            <label htmlFor="units">Units</label>
            <select id="units" value={draft.units} onChange={(e) => setDraft({ ...draft, units: e.target.value })}>
              {UNITS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <label htmlFor="bh_max_distance_ft">Backhand max distance</label>
            <input
              id="bh_max_distance_ft"
              type="number"
              min="0"
              value={draft.bh_max_distance_ft}
              onChange={(e) => setDraft({ ...draft, bh_max_distance_ft: e.target.value })}
            />
            <label htmlFor="fh_max_distance_ft">Forehand max distance</label>
            <input
              id="fh_max_distance_ft"
              type="number"
              min="0"
              value={draft.fh_max_distance_ft}
              onChange={(e) => setDraft({ ...draft, fh_max_distance_ft: e.target.value })}
            />
            <label htmlFor="c1_comfort_ft">C1 comfort distance</label>
            <input
              id="c1_comfort_ft"
              type="number"
              min="0"
              value={draft.c1_comfort_ft}
              onChange={(e) => setDraft({ ...draft, c1_comfort_ft: e.target.value })}
            />
          </div>
        )}
      />

      <EditableSection
        title="Goals"
        values={{
          target_rating: profile.target_rating ?? '',
          injury_notes: profile.injury_notes ?? '',
        }}
        onSave={(draft) =>
          saveFields({
            target_rating: draft.target_rating === '' ? null : Number(draft.target_rating),
            injury_notes: draft.injury_notes.trim() || null,
          })
        }
        renderView={(v) => (
          <dl className="profile-field-list">
            <div>
              <dt>Target rating</dt>
              <dd>{v.target_rating === '' ? '—' : v.target_rating}</dd>
            </div>
            <div>
              <dt>Injury notes (private)</dt>
              <dd>{v.injury_notes || '—'}</dd>
            </div>
          </dl>
        )}
        renderEdit={(draft, setDraft) => (
          <div className="profile-edit-fields">
            <label htmlFor="target_rating">Target rating</label>
            <input
              id="target_rating"
              type="number"
              min="0"
              value={draft.target_rating}
              onChange={(e) => setDraft({ ...draft, target_rating: e.target.value })}
            />
            <label htmlFor="injury_notes">Injury notes (private — never shown to others)</label>
            <textarea
              id="injury_notes"
              rows={3}
              value={draft.injury_notes}
              onChange={(e) => setDraft({ ...draft, injury_notes: e.target.value })}
            />
          </div>
        )}
      />
    </section>
  )
}
