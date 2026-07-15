import { db } from '../db/dexieDb'
import { supabase } from '../supabaseClient'
import { normalizeShotTag } from '../discTaxonomy'

async function cacheRows(table, rows) {
  if (rows.length) await table.bulkPut(rows)
  return rows
}

export async function loadGhostSlots(bagId) {
  try {
    const { data, error } = await supabase.from('bag_ghost_slots').select('*').eq('bag_id', bagId)
    if (error) throw error
    return cacheRows(db.bagGhostSlots, data)
  } catch (error) {
    const cached = await db.bagGhostSlots.where('bag_id').equals(bagId).toArray()
    if (cached.length) return cached
    throw error
  }
}

export async function addGhostSlot(userId, bagId, fields) {
  const row = { id: crypto.randomUUID(), user_id: userId, bag_id: bagId, ...fields, created_at: new Date().toISOString(), removed_at: null }
  await db.bagGhostSlots.put(row)
  const { data, error } = await supabase.from('bag_ghost_slots').insert(row).select().single()
  if (error) throw error
  await db.bagGhostSlots.put(data)
  return data
}

export async function removeGhostSlot(slot) {
  const removed_at = new Date().toISOString()
  await db.bagGhostSlots.put({ ...slot, removed_at })
  const { data, error } = await supabase.from('bag_ghost_slots').update({ removed_at }).eq('id', slot.id).select().single()
  if (error) throw error
  await db.bagGhostSlots.put(data)
  return data
}

export async function loadDiscShotTags(discId) {
  try {
    const [tagResult, assignmentResult] = await Promise.all([
      supabase.from('shot_tags').select('*').is('retired_at', null).order('category').order('label'),
      supabase.from('disc_shot_tag_assignments').select('*').eq('disc_id', discId),
    ])
    if (tagResult.error) throw tagResult.error
    if (assignmentResult.error) throw assignmentResult.error
    await Promise.all([
      cacheRows(db.shotTags, tagResult.data),
      cacheRows(db.discShotTagAssignments, assignmentResult.data),
    ])
    return { tags: tagResult.data, assignments: assignmentResult.data }
  } catch (error) {
    const tags = await db.shotTags.toArray()
    const assignments = await db.discShotTagAssignments.where('disc_id').equals(discId).toArray()
    if (tags.length) return { tags, assignments }
    throw error
  }
}

export async function createShotTag(userId, label, category = 'utility') {
  const row = { id: crypto.randomUUID(), user_id: userId, slug: normalizeShotTag(label), label: label.trim(), category }
  const { data, error } = await supabase.from('shot_tags').insert(row).select().single()
  if (error) throw error
  await db.shotTags.put(data)
  return data
}

export async function assignShotTag(userId, discId, shotTagId) {
  const row = { id: crypto.randomUUID(), user_id: userId, disc_id: discId, shot_tag_id: shotTagId, assigned_at: new Date().toISOString(), removed_at: null, idempotency_key: `shot-tag:${crypto.randomUUID()}` }
  const { data, error } = await supabase.from('disc_shot_tag_assignments').insert(row).select().single()
  if (error) throw error
  await db.discShotTagAssignments.put(data)
  return data
}

export async function removeShotTagAssignment(assignment) {
  const removed_at = new Date().toISOString()
  const { data, error } = await supabase.from('disc_shot_tag_assignments').update({ removed_at }).eq('id', assignment.id).select().single()
  if (error) throw error
  await db.discShotTagAssignments.put(data)
  return data
}
