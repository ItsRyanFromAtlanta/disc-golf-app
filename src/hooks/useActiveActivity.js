import { useEffect, useState } from 'react'
import { activityRepository } from '../lib/repository/activityRepository'

// Dexie's live query keeps the shell and PLAY resume card in sync with the
// local lifecycle mirror without waiting for Supabase or the capture queues.
export function useActiveActivity(userId) {
  const [activity, setActivity] = useState(null)

  useEffect(() => {
    if (!userId) {
      setActivity(null)
      return undefined
    }

    const subscription = activityRepository.subscribeToActive(
      userId,
      setActivity,
      () => setActivity(null),
    )
    return () => subscription.unsubscribe()
  }, [userId])

  return activity
}
