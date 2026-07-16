export function previewBagRestore({ currentDiscIds = [], snapshotDiscIds = [], availableDiscIds = [] }) {
  const current = new Set(currentDiscIds)
  const snapshot = new Set(snapshotDiscIds)
  const available = new Set(availableDiscIds)
  const target = [...snapshot].filter((id) => available.has(id))
  return {
    additions: target.filter((id) => !current.has(id)),
    removals: [...current].filter((id) => !snapshot.has(id)),
    unavailable: [...snapshot].filter((id) => !available.has(id)),
    targetDiscIds: target,
  }
}

export function latestBagVersion(versions = []) {
  return versions.reduce((latest, row) => (!latest || row.version > latest.version ? row : latest), null)
}

export function describeRestoreDiscIds(preview, discs = []) {
  const byId = new Map(discs.map((disc) => [disc.id, disc.nickname || disc.moldInfo?.mold_name || disc.mold || 'Unknown disc']))
  const describe = (ids) => ids.map((id) => ({ id, label: byId.get(id) ?? 'Unavailable historical disc' }))
  return {
    additions: describe(preview.additions),
    removals: describe(preview.removals),
    unavailable: describe(preview.unavailable),
  }
}
