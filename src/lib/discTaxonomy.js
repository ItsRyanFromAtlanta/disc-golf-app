export function activeGhostSlots(rows = []) {
  return rows.filter((row) => !row.removed_at)
}

export function activeShotTagAssignments(rows = []) {
  return rows.filter((row) => !row.removed_at)
}

export function assignedShotTags(tags = [], assignments = []) {
  const activeIds = new Set(activeShotTagAssignments(assignments).map((row) => row.shot_tag_id))
  return tags.filter((tag) => activeIds.has(tag.id) && !tag.retired_at)
}

export function normalizeShotTag(value) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
