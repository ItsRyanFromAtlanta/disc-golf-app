import { buildFreeformCsv, buildRegimenCsv, downloadCsv } from '../../lib/csvExport'

// Data export (Screen 10 + Screen 19's "own your data" use case). Client-side
// only — builds CSVs from the already-fetched history and downloads them. Two
// plain .csv files rather than a zip (see csvExport divergence note).
function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function DataExportPanel({ history }) {
  const sessionCount = history?.sessions?.length ?? 0
  const runCount = history?.runs?.length ?? 0

  return (
    <section className="settings-card data-export">
      <h2>Export your data</h2>
      <p className="settings-card-sub">
        Download your practice history as CSV — yours to keep, open in any spreadsheet.
      </p>
      <div className="data-export-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={sessionCount === 0}
          onClick={() => downloadCsv(`freeform-putts-${today()}.csv`, buildFreeformCsv(history))}
        >
          Freeform CSV ({sessionCount})
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={runCount === 0}
          onClick={() => downloadCsv(`regimen-runs-${today()}.csv`, buildRegimenCsv(history))}
        >
          Regimen CSV ({runCount})
        </button>
      </div>
    </section>
  )
}
