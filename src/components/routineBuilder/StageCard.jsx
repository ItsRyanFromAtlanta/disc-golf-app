import { IconTrash } from '@tabler/icons-react'
import ChipGroup from '../ChipGroup'
import { DISTANCE_OPTIONS, PUTT_OPTIONS } from '../../lib/routineBuilder'

// One stage of a custom routine. The blueprint's "segmented horizontal steppers"
// are single-select chip grids, so this reuses the shipped zero-typing ChipGroup
// rather than dropdowns. `onChange` patches this stage; `onDelete` removes it.
export default function StageCard({ index, stage, onChange, onDelete, canDelete }) {
  return (
    <div className="stage-card">
      <div className="stage-card-header">
        <span className="editor-label">Stage {index + 1}</span>
        {canDelete && (
          <button type="button" className="link-button stage-card-delete" onClick={onDelete} aria-label={`Delete stage ${index + 1}`}>
            <IconTrash size={18} stroke={1.75} />
          </button>
        )}
      </div>

      <span className="stage-card-field-label">Distance</span>
      <ChipGroup
        options={DISTANCE_OPTIONS}
        getLabel={(ft) => `${ft} ft`}
        isActive={(ft) => stage.distanceFt === ft}
        onSelect={(ft) => onChange({ ...stage, distanceFt: ft })}
      />

      <span className="stage-card-field-label">Putts</span>
      <ChipGroup
        options={PUTT_OPTIONS}
        isActive={(n) => stage.putts === n}
        onSelect={(n) => onChange({ ...stage, putts: n })}
      />

      <button
        type="button"
        className={`chip stage-pressure-toggle ${stage.pressure ? 'chip-active' : ''}`}
        onClick={() => onChange({ ...stage, pressure: !stage.pressure })}
      >
        🎯 Pressure last putt
      </button>
    </div>
  )
}
