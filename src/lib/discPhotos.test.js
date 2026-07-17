import { describe, expect, it } from 'vitest'
import { currentDiscPhotos, discPhotoStoragePath, photoBySlot, recoverableDiscPhotos, validateDiscPhotoFile } from './discPhotos'

describe('discPhotos', () => {
  it('builds immutable owner/disc/slot paths', () => {
    expect(discPhotoStoragePath('user-1', 'disc-1', 'front', 'photo-1')).toBe(
      'user-1/disc-1/front/photo-1.webp',
    )
    expect(() => discPhotoStoragePath('u', 'd', 'top', 'p')).toThrow('Invalid disc photo slot')
  })

  it('selects current and recoverable versions without reviving superseded rows', () => {
    const rows = [
      { id: 'current', slot: 'front', deleted_at: null, superseded_at: null },
      { id: 'old', slot: 'front', deleted_at: null, superseded_at: '2026-07-01T00:00:00Z' },
      { id: 'deleted', slot: 'side', deleted_at: '2026-07-10T00:00:00Z', recoverable_until: '2026-08-09T00:00:00Z', superseded_at: null },
    ]
    expect(currentDiscPhotos(rows).map((row) => row.id)).toEqual(['current'])
    expect(photoBySlot(rows, 'front')?.id).toBe('current')
    expect(recoverableDiscPhotos(rows, Date.parse('2026-07-15T00:00:00Z')).map((row) => row.id)).toEqual(['deleted'])
  })

  it('rejects non-images and oversized source files', () => {
    expect(() => validateDiscPhotoFile({ type: 'text/plain', size: 1 })).toThrow('Choose an image')
    expect(() => validateDiscPhotoFile({ type: 'image/jpeg', size: 16 * 1024 * 1024 })).toThrow('15 MB')
  })
})
