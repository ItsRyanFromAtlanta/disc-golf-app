export const DISC_PHOTO_BUCKET = 'disc-private-photos'
export const DISC_PHOTO_SLOTS = ['front', 'back', 'side']
export const DISC_PHOTO_MAX_SOURCE_BYTES = 15 * 1024 * 1024
export const DISC_PHOTO_MAX_DERIVATIVE_BYTES = 5 * 1024 * 1024
export const DISC_PHOTO_MAX_EDGE_PX = 1600
export const DISC_PHOTO_WEBP_QUALITY = 0.82
export const DISC_PHOTO_SIGNED_URL_SECONDS = 60 * 60

export function discPhotoStoragePath(userId, discId, slot, photoId, extension = 'webp') {
  if (!DISC_PHOTO_SLOTS.includes(slot)) throw new Error('Invalid disc photo slot')
  return `${userId}/${discId}/${slot}/${photoId}.${extension}`
}

export function currentDiscPhotos(rows) {
  return rows.filter((row) => !row.superseded_at && !row.deleted_at)
}

export function recoverableDiscPhotos(rows, now = Date.now()) {
  return rows.filter(
    (row) => !row.superseded_at && row.deleted_at && Date.parse(row.recoverable_until) >= now,
  )
}

export function photoBySlot(rows, slot) {
  return currentDiscPhotos(rows).find((row) => row.slot === slot) ?? null
}

export function validateDiscPhotoFile(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file')
  if (file.size > DISC_PHOTO_MAX_SOURCE_BYTES) throw new Error('Photo must be 15 MB or smaller')
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Photo compression failed'))), type, quality)
  })
}

export async function compressDiscPhoto(file) {
  validateDiscPhotoFile(file)
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, DISC_PHOTO_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const blob = await canvasToBlob(canvas, 'image/webp', DISC_PHOTO_WEBP_QUALITY)
  if (blob.size > DISC_PHOTO_MAX_DERIVATIVE_BYTES) {
    throw new Error('Compressed photo is still larger than 5 MB')
  }
  return { blob, width, height, mimeType: 'image/webp', extension: 'webp' }
}
