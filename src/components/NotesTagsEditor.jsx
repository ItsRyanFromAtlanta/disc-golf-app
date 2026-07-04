import { useState } from 'react'
import { STARTER_TAGS, normalizeTag } from '../lib/insights'

export default function NotesTagsEditor({ initialNotes, initialTags, onSave }) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [tags, setTags] = useState(initialTags ?? [])
  const [customTag, setCustomTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  function toggleTag(tag) {
    setSaved(false)
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    )
  }

  function addCustomTag() {
    const tag = normalizeTag(customTag)
    if (!tag) return
    if (!tags.includes(tag)) setTags([...tags, tag])
    setCustomTag('')
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await onSave({ notes: notes.trim() || null, tags })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const chipTags = [...STARTER_TAGS, ...tags.filter((t) => !STARTER_TAGS.includes(t))]

  return (
    <div className="notes-tags-editor">
      <label htmlFor="notes">Notes</label>
      <textarea
        id="notes"
        rows={3}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
          setSaved(false)
        }}
        placeholder="How did it feel?"
      />

      <span className="editor-label">Tags</span>
      <div className="chip-row">
        {chipTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`chip ${tags.includes(tag) ? 'chip-active' : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="custom-tag-row">
        <input
          type="text"
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustomTag()
            }
          }}
          placeholder="Add a tag"
        />
        <button type="button" className="chip" onClick={addCustomTag}>
          Add
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      <button type="button" className="save-button" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save notes & tags'}
      </button>
    </div>
  )
}
