import { db } from '../db/dexieDb'
import { supabase } from '../supabaseClient'
import {
  DISC_PHOTO_BUCKET,
  DISC_PHOTO_SIGNED_URL_SECONDS,
  compressDiscPhoto,
  discPhotoStoragePath,
} from '../discPhotos'

async function cacheRows(rows) {
  if (rows.length) await db.discPhotos.bulkPut(rows)
  return rows
}

export async function loadDiscPhotos(discId) {
  try {
    const { data, error } = await supabase
      .from('disc_photos')
      .select('*')
      .eq('disc_id', discId)
      .order('created_at', { ascending: false })
    if (error) throw error
    await db.discPhotos.where('disc_id').equals(discId).delete()
    return cacheRows(data ?? [])
  } catch (error) {
    const cached = await db.discPhotos.where('disc_id').equals(discId).toArray()
    if (cached.length) return cached
    throw error
  }
}

export async function signedDiscPhotoUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(DISC_PHOTO_BUCKET)
    .createSignedUrl(storagePath, DISC_PHOTO_SIGNED_URL_SECONDS)
  if (error) throw error
  return data.signedUrl
}

async function syncUpload(row) {
  const { error: uploadError } = await supabase.storage
    .from(DISC_PHOTO_BUCKET)
    .upload(row.storagePath, row.blob, { contentType: row.mimeType, upsert: false })
  if (uploadError && !/already exists/i.test(uploadError.message)) throw uploadError

  const { data, error } = await supabase.rpc('register_disc_photo', {
    p_id: row.photoId,
    p_disc_id: row.discId,
    p_slot: row.slot,
    p_storage_path: row.storagePath,
    p_mime_type: row.mimeType,
    p_byte_size: row.blob.size,
    p_width: row.width,
    p_height: row.height,
    p_idempotency_key: row.idempotencyKey,
    p_created_at: row.createdAt,
  })
  if (error) throw error
  await db.discPhotos.put(data)
  return data
}

export async function queueDiscPhotoUpload({ userId, discId, slot, file }) {
  const derivative = await compressDiscPhoto(file)
  const photoId = crypto.randomUUID()
  const row = {
    id: crypto.randomUUID(),
    userId,
    discId,
    slot,
    photoId,
    storagePath: discPhotoStoragePath(userId, discId, slot, photoId, derivative.extension),
    blob: derivative.blob,
    width: derivative.width,
    height: derivative.height,
    mimeType: derivative.mimeType,
    idempotencyKey: `disc-photo:${photoId}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  await db.discPhotoUploads.put(row)
  try {
    const photo = await syncUpload(row)
    await db.discPhotoUploads.delete(row.id)
    return { photo, queued: false }
  } catch (error) {
    await db.discPhotoUploads.update(row.id, { status: 'retry', lastError: error.message })
    return { photo: null, queued: true }
  }
}

export async function flushDiscPhotoUploads(userId) {
  const pending = await db.discPhotoUploads.where('userId').equals(userId).toArray()
  for (const row of pending) {
    try {
      await syncUpload(row)
      await db.discPhotoUploads.delete(row.id)
    } catch (error) {
      await db.discPhotoUploads.update(row.id, { status: 'retry', lastError: error.message })
    }
  }
}

export async function deleteDiscPhoto(photoId) {
  const { data, error } = await supabase.rpc('delete_disc_photo', { p_photo_id: photoId })
  if (error) throw error
  await db.discPhotos.put(data)
  return data
}

export async function restoreDiscPhoto(photoId) {
  const { data, error } = await supabase.rpc('restore_disc_photo', { p_photo_id: photoId })
  if (error) throw error
  await db.discPhotos.put(data)
  return data
}
