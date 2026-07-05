import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../db/dexieDb'
import { readThroughCache, writeThrough, flushOutbox } from './offlineFirstRepository'

// TanStack Query wrapper around the offline-first primitives in
// offlineFirstRepository.js. Call this once per entity (see
// discRepository.js) to get a consistent set of read/write hooks — new
// entities plug into the same offline behavior without re-deriving it.
//
// createRemote/updateRemote/removeRemote are optional; only the hooks a
// caller actually wires up are exposed, so an entity with no delete path
// (e.g. discs, which use a status lifecycle instead) never exposes a
// useRemove that would silently fail.
export function createRepository({ entityName, cacheTable, fetchRemote, createRemote, updateRemote, removeRemote }) {
  const remoteFns = { create: createRemote, update: updateRemote, remove: removeRemote }

  function useList(...args) {
    const queryClient = useQueryClient()
    const queryKey = [entityName, 'list', ...args]

    // The 'online' listener is registered once (empty deps, so a reconnect
    // mid-session doesn't churn the subscription) but must still invalidate
    // the CURRENT queryKey, not the one captured at mount — args can change
    // across renders without an unmount (e.g. a route param swap that reuses
    // the same element). A ref updated every render sidesteps the stale
    // closure without re-subscribing the listener on every arg change.
    const queryKeyRef = useRef(queryKey)
    queryKeyRef.current = queryKey

    // Retry anything queued while offline as soon as the browser reconnects.
    useEffect(() => {
      function onOnline() {
        flushOutbox({ outboxTable: db.outbox, entityName, remoteFns }).then(() =>
          queryClient.invalidateQueries({ queryKey: queryKeyRef.current }),
        )
      }
      window.addEventListener('online', onOnline)
      return () => window.removeEventListener('online', onOnline)
      // eslint-disable-next-line react-hooks/exhaustive-deps -- entityName/remoteFns/queryClient are stable per entity; queryKeyRef.current is read fresh on each invocation
    }, [])

    return useQuery({
      queryKey,
      queryFn: () => readThroughCache(cacheTable, () => fetchRemote(...args)),
      networkMode: 'offlineFirst',
      enabled: args.every((arg) => arg !== undefined && arg !== null),
    })
  }

  function useMutationFor(op, remoteFn, listArgs) {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (payload) => writeThrough({ outboxTable: db.outbox, entityName, op, payload, remoteFn }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [entityName, 'list', ...listArgs] }),
    })
  }

  // Create gets its own hook (rather than useMutationFor) because it's the
  // one op where a retried/duplicated write would INSERT a second row instead
  // of harmlessly re-applying to an existing one (update/remove already
  // target a known id, so replaying them is naturally idempotent). clientId
  // is generated once per mount and reused across repeated .mutate() calls
  // from that mount (manual retries, or two concurrent outbox flushes racing
  // the same queued entry) — remoteFn is expected to upsert on it. It resets
  // after a success so a subsequent create from the same mounted form (e.g. a
  // "create and add another" flow) gets its own fresh id.
  function useCreate(...listArgs) {
    const queryClient = useQueryClient()
    const clientIdRef = useRef(null)
    return useMutation({
      mutationFn: (fields) => {
        if (!clientIdRef.current) clientIdRef.current = crypto.randomUUID()
        return writeThrough({
          outboxTable: db.outbox,
          entityName,
          op: 'create',
          payload: { ...fields, clientId: clientIdRef.current },
          remoteFn: createRemote,
        })
      },
      onSuccess: () => {
        clientIdRef.current = null
        queryClient.invalidateQueries({ queryKey: [entityName, 'list', ...listArgs] })
      },
    })
  }

  const api = { useList }
  if (createRemote) api.useCreate = useCreate
  if (updateRemote) api.useUpdate = (...listArgs) => useMutationFor('update', updateRemote, listArgs)
  if (removeRemote) api.useRemove = (...listArgs) => useMutationFor('remove', removeRemote, listArgs)
  return api
}
