import { useEffect, useState } from 'react'

export default function EditableSection({ title, values, onSave, renderView, renderEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(values)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!editing) setDraft(values)
  }, [values, editing])

  function startEdit() {
    setDraft(values)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setDraft(values)
    setError(null)
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="profile-section">
      <div className="profile-section-header">
        <h2>{title}</h2>
        {!editing && (
          <button type="button" className="link-button" onClick={startEdit}>
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="profile-section-edit">
          {renderEdit(draft, setDraft)}
          {error && <p className="form-error">{error}</p>}
          <div className="profile-section-actions">
            <button type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="link-button" onClick={cancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="profile-section-view">{renderView(values)}</div>
      )}
    </section>
  )
}
