/**
 * Presentational only. The shell owns the state (`useToastController` in
 * `src/hooks/useToast.js`); this renders whatever is currently in the single
 * toast slot.
 *
 * `role="status"` + `aria-live="polite"` is the whole point of the component:
 * an auto-close the athlete did not ask for has to reach a screen reader, not
 * just a viewport.
 */
export default function ToastHost({ toast, onDismiss }) {
  if (!toast) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      <p className="toast-message">{toast}</p>
      {onDismiss ? (
        <button type="button" className="toast-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}
