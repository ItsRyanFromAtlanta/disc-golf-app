import { supabase } from '../supabaseClient'
import { loadDiscOdometer } from './discOdometerRepository'
import { loadDiscPhotos } from './discPhotoRepository'
import { buildDiscHistory, buildDiscPerformance } from '../discProfile'

function rows(result) {
  if (result.error) throw result.error
  return result.data ?? []
}

export async function loadDiscProfileContext(discId) {
  const [puttsResult, holesResult, statesResult, casesResult, odometer, photos] = await Promise.all([
    supabase.from('putt_events').select('id,outcome').eq('putter_disc_id', discId),
    supabase.from('round_holes').select('id,score,round:rounds(played_at),hole:holes(par)').eq('disc_id', discId),
    supabase.from('disc_state_events').select('*').eq('disc_id', discId).order('occurred_at', { ascending: false }),
    supabase.from('lost_found_cases').select('id').eq('disc_id', discId),
    loadDiscOdometer(discId),
    loadDiscPhotos(discId),
  ])
  const cases = rows(casesResult)
  const updatesResult = cases.length
    ? await supabase.from('lost_found_updates').select('*').in('case_id', cases.map((row) => row.id))
    : { data: [], error: null }
  const performance = buildDiscPerformance({ puttEvents: rows(puttsResult), roundHoles: rows(holesResult) })
  const history = buildDiscHistory({
    stateEvents: rows(statesResult),
    odometerEvents: odometer.events,
    lostFoundUpdates: rows(updatesResult),
    photos,
  })
  return { performance, history }
}
