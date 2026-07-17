import { db } from '../db/dexieDb'
import { fetchRegimenWithSets, fetchRegimensWithSets } from '../regimens'

function belongsToUser(regimen, userId) {
  return regimen.user_id == null || regimen.user_id === userId
}

async function cacheList(database, userId, snapshot) {
  await database.transaction('rw', database.regimens, database.regimenSets, async () => {
    const cachedRegimens = (await database.regimens.toArray()).filter((regimen) => belongsToUser(regimen, userId))
    const remoteRegimenIds = new Set(snapshot.regimens.map((regimen) => regimen.id))
    const staleRegimenIds = cachedRegimens
      .map((regimen) => regimen.id)
      .filter((regimenId) => !remoteRegimenIds.has(regimenId))

    const cachedSets = await database.regimenSets.toArray()
    const remoteSetIds = new Set(snapshot.sets.map((set) => set.id))
    const staleSetIds = cachedSets
      .filter((set) => staleRegimenIds.includes(set.regimen_id)
        || (remoteRegimenIds.has(set.regimen_id) && !remoteSetIds.has(set.id)))
      .map((set) => set.id)

    if (snapshot.regimens.length) await database.regimens.bulkPut(snapshot.regimens)
    if (snapshot.sets.length) await database.regimenSets.bulkPut(snapshot.sets)
    if (staleRegimenIds.length) await database.regimens.bulkDelete(staleRegimenIds)
    if (staleSetIds.length) await database.regimenSets.bulkDelete(staleSetIds)
  })
}

async function cachedList(database, userId) {
  return (await database.regimens.toArray())
    .filter((regimen) => belongsToUser(regimen, userId))
    .sort((left, right) => Number(left.difficulty ?? 99) - Number(right.difficulty ?? 99))
}

export function createRegimenRepository({
  database = db,
  fetchListRemote = fetchRegimensWithSets,
  fetchOneRemote = fetchRegimenWithSets,
} = {}) {
  return {
    async list(userId) {
      try {
        const snapshot = await fetchListRemote(userId)
        await cacheList(database, userId, snapshot)
        return snapshot.regimens
      } catch (error) {
        const cached = await cachedList(database, userId)
        if (cached.length) return cached
        throw error
      }
    },

    async getWithSets(regimenId, userId) {
      try {
        const snapshot = await fetchOneRemote(regimenId)
        if (!belongsToUser(snapshot.regimen, userId)) throw new Error('Regimen is not available to this user.')
        await database.transaction('rw', database.regimens, database.regimenSets, async () => {
          await database.regimens.put(snapshot.regimen)
          const staleSetIds = (await database.regimenSets.where('regimen_id').equals(regimenId).toArray())
            .map((set) => set.id)
            .filter((setId) => !snapshot.sets.some((set) => set.id === setId))
          if (snapshot.sets.length) await database.regimenSets.bulkPut(snapshot.sets)
          if (staleSetIds.length) await database.regimenSets.bulkDelete(staleSetIds)
        })
        return snapshot
      } catch (error) {
        const regimen = await database.regimens.get(regimenId)
        if (!regimen || !belongsToUser(regimen, userId)) throw error
        const sets = await database.regimenSets.where('regimen_id').equals(regimenId).sortBy('set_order')
        if (!sets.length) throw error
        return { regimen, sets }
      }
    },
  }
}

export const regimenRepository = createRegimenRepository()
