import { useState } from 'react'
import ChipGroup from '../ChipGroup'
import PutterPicker from './PutterPicker'

const WEATHER_OPTIONS = ['clear', 'headwind', 'tailwind', 'crosswind', 'rain']

// Mid-round adjustments row (blueprint's ad-hoc SWAP + weather selector +
// batch-edit shortcut + the weather->backup swap suggestion banner) — grouped
// into one slot since they're all "correct course without leaving the canvas."
export default function CanvasToolbar({
  userId,
  activePutterDiscId,
  activePutterLabel,
  onSelectPutter,
  weatherCondition,
  windMph,
  onSetWeather,
  suggestedSwapDisc,
  onAcceptSwap,
  onDismissSwap,
  onEdit,
}) {
  const [showSwapDrawer, setShowSwapDrawer] = useState(false)
  const [showWeatherDrawer, setShowWeatherDrawer] = useState(false)

  return (
    <div className="canvas-toolbar">
      <div className="canvas-toolbar-row">
        <button type="button" className="chip canvas-toolbar-chip" onClick={() => setShowSwapDrawer((v) => !v)}>
          🥏 {activePutterLabel ?? 'No putter'} 🔄
        </button>
        <button type="button" className="chip canvas-toolbar-chip" onClick={() => setShowWeatherDrawer((v) => !v)}>
          🌬️ {!weatherCondition || weatherCondition === 'clear' ? 'Weather' : weatherCondition}
        </button>
        {onEdit && (
          <button type="button" className="link-button" onClick={onEdit}>
            📝 Edit
          </button>
        )}
      </div>

      {showSwapDrawer && (
        <div className="canvas-toolbar-drawer">
          <PutterPicker
            userId={userId}
            selectedId={activePutterDiscId}
            onSelect={(id) => {
              onSelectPutter(id)
              setShowSwapDrawer(false)
            }}
          />
        </div>
      )}

      {showWeatherDrawer && (
        <div className="canvas-toolbar-drawer">
          <ChipGroup
            options={WEATHER_OPTIONS}
            isActive={(o) => weatherCondition === o}
            onSelect={(o) => onSetWeather({ condition: o, windMph: o === 'clear' ? null : windMph })}
          />
          {weatherCondition && weatherCondition !== 'clear' && (
            <label className="canvas-toolbar-wind">
              Wind (mph)
              <input
                type="number"
                min="0"
                value={windMph ?? ''}
                onChange={(e) =>
                  onSetWeather({
                    condition: weatherCondition,
                    windMph: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          )}
        </div>
      )}

      {suggestedSwapDisc && (
        <div className="canvas-swap-banner">
          <p>
            ⚠️ Windy conditions detected! Swap to backup:{' '}
            {suggestedSwapDisc.nickname || suggestedSwapDisc.moldInfo?.mold_name || suggestedSwapDisc.mold}?
          </p>
          <div className="canvas-swap-banner-actions">
            <button type="button" className="start-button" onClick={onAcceptSwap}>
              Yes, swap
            </button>
            <button type="button" className="link-button" onClick={onDismissSwap}>
              Ignore
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
