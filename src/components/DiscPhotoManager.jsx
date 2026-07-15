import { useCallback, useEffect, useMemo, useState } from 'react'
import { currentDiscPhotos, DISC_PHOTO_SLOTS, recoverableDiscPhotos } from '../lib/discPhotos'
import {
  deleteDiscPhoto,
  flushDiscPhotoUploads,
  loadDiscPhotos,
  queueDiscPhotoUpload,
  restoreDiscPhoto,
  signedDiscPhotoUrl,
} from '../lib/repository/discPhotoRepository'

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function DiscPhotoManager({ userId, discId, legacyPhotoUrl = null, onError }) {
  const [photos, setPhotos] = useState([])
  const [urls, setUrls] = useState({})
  const [busySlot, setBusySlot] = useState(null)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    const rows = await loadDiscPhotos(discId)
    setPhotos(rows)
    const visible = [...currentDiscPhotos(rows), ...recoverableDiscPhotos(rows)]
    const signed = await Promise.all(
      visible.map(async (photo) => {
        try {
          return [photo.id, await signedDiscPhotoUrl(photo.storage_path)]
        } catch {
          return [photo.id, null]
        }
      }),
    )
    setUrls(Object.fromEntries(signed))
  }, [discId])

  useEffect(() => {
    refresh().catch((error) => onError(error.message))
    const flush = () => flushDiscPhotoUploads(userId).then(refresh).catch(() => {})
    window.addEventListener('online', flush)
    flush()
    return () => window.removeEventListener('online', flush)
  }, [refresh, userId, onError])

  const currentBySlot = useMemo(
    () => Object.fromEntries(currentDiscPhotos(photos).map((photo) => [photo.slot, photo])),
    [photos],
  )
  const recoverable = recoverableDiscPhotos(photos)

  async function handleFile(slot, file) {
    if (!file) return
    setBusySlot(slot)
    setMessage('')
    try {
      const result = await queueDiscPhotoUpload({ userId, discId, slot, file })
      setMessage(result.queued ? 'Saved offline. Upload will retry when connected.' : `${titleCase(slot)} photo saved.`)
      await refresh().catch(() => {})
    } catch (error) {
      onError(error.message)
    } finally {
      setBusySlot(null)
    }
  }

  async function remove(photo) {
    setBusySlot(photo.slot)
    try {
      await deleteDiscPhoto(photo.id)
      setMessage('Photo removed. You can restore it for 30 days.')
      await refresh()
    } catch (error) {
      onError(error.message)
    } finally {
      setBusySlot(null)
    }
  }

  async function restore(photo) {
    setBusySlot(photo.slot)
    try {
      await restoreDiscPhoto(photo.id)
      setMessage(`${titleCase(photo.slot)} photo restored.`)
      await refresh()
    } catch (error) {
      onError(error.message)
    } finally {
      setBusySlot(null)
    }
  }

  return (
    <section className="disc-photo-manager" aria-labelledby="disc-photos-heading">
      <h2 id="disc-photos-heading">Private photos</h2>
      <p className="log-time">Up to three compressed photos. Only you can view them.</p>
      <div className="disc-photo-grid">
        {DISC_PHOTO_SLOTS.map((slot) => {
          const photo = currentBySlot[slot]
          return (
            <article key={slot} className="disc-photo-slot">
              <h3>{titleCase(slot)}</h3>
              {photo && urls[photo.id] ? (
                <img src={urls[photo.id]} alt={`${titleCase(slot)} of this disc`} />
              ) : slot === 'front' && legacyPhotoUrl ? (
                <img src={legacyPhotoUrl} alt="Legacy disc photo" />
              ) : (
                <div className="disc-photo-placeholder">No photo</div>
              )}
              <label className="link-button disc-photo-picker">
                {photo ? 'Replace' : 'Choose photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busySlot === slot}
                  onChange={(event) => handleFile(slot, event.target.files?.[0])}
                />
              </label>
              {photo && (
                <button type="button" className="secondary-button" disabled={busySlot === slot} onClick={() => remove(photo)}>
                  Remove
                </button>
              )}
            </article>
          )
        })}
      </div>
      {message && <p className="success-message" role="status">{message}</p>}
      {recoverable.length > 0 && (
        <div className="disc-photo-recovery">
          <h3>Recently removed</h3>
          {recoverable.map((photo) => (
            <button key={photo.id} type="button" className="link-button" onClick={() => restore(photo)}>
              Restore {photo.slot} photo
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
