import { useCallback, useMemo, useState } from 'react'
import { useUpdateRound } from '../lib/repository/roundRepository'
import { readRoundWeather } from '../lib/roundWeather'

/**
 * Save handling for `RoundWeatherPanel`, shared by the scorecard and the
 * summary because both screens edit the same three columns on the same round.
 *
 * The one decision worth stating: on success it merges only the weather fields
 * into the caller's round state rather than swapping in the round that
 * `updateRound` read back. The scorecard's round is not the round the data
 * layer returns — `prepareRound` has already filled in a placeholder row for
 * every unplayed hole, and a score being typed at that moment lives in that
 * state. Replacing it wholesale to pick up three columns we already know the
 * value of would throw away an in-flight edit for nothing.
 *
 * The offline path merges the same fields for the same reason it is not an
 * error: `useUpdateRound` has already written the optimistic row and queued the
 * outbox entry by the time it throws, so the round genuinely does have this
 * weather — it just has not reached the server yet, which the round-level sync
 * banners already report.
 */
export function useRoundWeather(round, setRound, userId) {
  const updateRound = useUpdateRound(userId)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const weather = useMemo(() => readRoundWeather(round ?? {}), [round])

  const save = useCallback(
    async (fields) => {
      if (!round?.id) return
      setSaving(true)
      setMessage(null)
      try {
        await updateRound.mutateAsync({ roundId: round.id, fields })
        setRound((current) => (current ? { ...current, ...fields } : current))
      } catch (error) {
        if (error.localResult) {
          setRound((current) => (current ? { ...current, ...fields } : current))
          setMessage({ tone: 'info', text: 'Conditions saved on this device; they will sync when you reconnect.' })
        } else {
          setMessage({ tone: 'error', text: error.message ?? 'Could not save conditions.' })
        }
      } finally {
        setSaving(false)
      }
    },
    [round?.id, setRound, updateRound],
  )

  return { weather, save, saving, message }
}
