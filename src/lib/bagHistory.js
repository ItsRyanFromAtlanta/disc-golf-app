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
