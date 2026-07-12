export default function ToastHost({ toast }) {
  if (!toast) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toast}
    </div>
  )
}
