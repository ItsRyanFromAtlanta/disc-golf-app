import PutterPicker from './PutterPicker'
import SmartPredictionCard from './SmartPredictionCard'
import QuickModPresetPills from './QuickModPresetPills'

// READY_DEFAULT view: shown by both RegimenRunPage and FreeformLogPage while
// the FSM hasn't started a session yet. Purely presentational/orchestration —
// the pages own the actual data fetching and pass down whatever's relevant.
export default function SessionLauncher({
  userId,
  title,
  regimenName,
  suggestion,
  presets,
  favoritePutterId,
  onSelectPutter,
  onSelectPreset,
  onStart,
  starting,
}) {
  return (
    <section className="session-launcher">
      <SmartPredictionCard title={title} regimenName={regimenName} suggestion={suggestion} onStart={onStart} starting={starting} />
      <QuickModPresetPills presets={presets} onSelect={onSelectPreset} />
      <PutterPicker userId={userId} selectedId={favoritePutterId} onSelect={onSelectPutter} />
    </section>
  )
}
