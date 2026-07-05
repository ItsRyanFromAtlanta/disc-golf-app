// suggestion: lib/insights.suggestNextSession() output — { suggestedDistanceFt,
// currentFormPct, ... }. Pages pass whichever fields are relevant to them
// (e.g. RegimenRunPage omits suggestedDistanceFt since the regimen's sets
// already fix distances); this just renders whatever it's given.
export default function SmartPredictionCard({ title, regimenName, suggestion, onStart, starting }) {
  return (
    <div className="prediction-card">
      <h2>{title}</h2>
      {regimenName && <p className="prediction-card-sub">Last time: {regimenName}</p>}
      {suggestion?.suggestedDistanceFt != null && (
        <p className="prediction-card-sub">Suggested distance: {suggestion.suggestedDistanceFt} ft</p>
      )}
      {suggestion?.currentFormPct != null && (
        <p className="prediction-card-sub">Current form: {Math.round(suggestion.currentFormPct * 100)}%</p>
      )}
      <button type="button" className="start-button" onClick={onStart} disabled={starting}>
        {starting ? 'Starting...' : 'Start'}
      </button>
    </div>
  )
}
