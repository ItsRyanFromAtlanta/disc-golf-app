import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTIVITY_SOURCES } from '../lib/activityLifecycle'
import { getInstallationId } from '../lib/instantLaunch/installationId'
import { createSyncScheduler, SYNC_STATUS } from '../lib/instantLaunch/syncScheduler'
import { activityRepository } from '../lib/repository/activityRepository'
import { createHistoryRecoverySyncAdapter } from '../lib/repository/historyRecoverySync'

function mutationFor(activity, action, reason = null) {
  const now = new Date().toISOString()
  return {
    expectedState: activity.state,
    expectedVersion: activity.version,
    occurredAt: now,
    recordedAt: now,
    source: ACTIVITY_SOURCES.MANUAL_CORRECTION,
    installationId: getInstallationId(),
    idempotencyKey: `activity-history:${activity.id}:${action}:${crypto.randomUUID()}`,
    reason,
    metadata: { client: 'history_ui' },
  }
}

export function useHistoryRecovery() {
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.SYNCED)
  const adapterRef = useRef(null)
  const schedulerRef = useRef(null)
  if (!adapterRef.current) adapterRef.current = createHistoryRecoverySyncAdapter()

  useEffect(() => {
    const scheduler = createSyncScheduler({
      flush: adapterRef.current.flush,
      onStatusChange: setSyncStatus,
    })
    schedulerRef.current = scheduler
    scheduler.start()
    return () => scheduler.stop()
  }, [])

  const hide = useCallback(async (activity) => {
    const result = await activityRepository.hide(
      activity.id,
      mutationFor(activity, 'hide', 'user_hide'),
    )
    schedulerRef.current?.notifyOutboxChanged()
    return result
  }, [])

  const restore = useCallback(async (activity) => {
    const result = await activityRepository.restore(
      activity.id,
      mutationFor(activity, 'restore', 'user_restore'),
    )
    schedulerRef.current?.notifyOutboxChanged()
    return result
  }, [])

  const correctPracticeDetails = useCallback(async (activity, previous, next) => {
    const result = await activityRepository.correctPracticeDetails(
      activity.id,
      {
        previousNotes: previous.notes,
        previousTags: previous.tags,
        notes: next.notes,
        tags: next.tags,
      },
      mutationFor(activity, 'correct-practice-details'),
    )
    schedulerRef.current?.notifyOutboxChanged()
    return result
  }, [])

  const retrySync = useCallback(async () => {
    await adapterRef.current.retryPoisoned()
    schedulerRef.current?.retry()
  }, [])

  return { syncStatus, hide, restore, correctPracticeDetails, retrySync }
}
