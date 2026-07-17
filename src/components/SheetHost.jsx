import { IconX } from '@tabler/icons-react'

export default function SheetHost({ sheet, onClose }) {
  if (!sheet) return null

  return (
    <div className="sheet-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="sheet-host"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-host-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-host-handle" aria-hidden="true" />
        <div className="sheet-host-header">
          <h2 id="sheet-host-title">{sheet.title}</h2>
          <button type="button" className="global-header-icon-button" onClick={onClose} aria-label={`Close ${sheet.title}`}>
            <IconX size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="sheet-host-content">{sheet.content}</div>
      </section>
    </div>
  )
}
