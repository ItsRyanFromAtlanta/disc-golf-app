// Client-side CSV export for Screen 10's data-export module (also covers
// Screen 19's "own your data" export use case — see SCREEN_SPECS divergence).
// Pure string builders live here and are unit-tested; the impure Blob/anchor
// download is a thin wrapper at the bottom.
//
// DIVERGENCE from the blueprint's "zipped" export: the repo has no zip
// dependency and adding one for a two-file export isn't worth the bundle weight,
// so each dataset downloads as its own plain .csv. Trivial to fold into a single
// zip later if a third+ dataset lands.

function escapeCell(value) {
  if (value == null) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// headers: string[]; rows: Array<Array<string|number|null>>
export function toCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) lines.push(row.map(escapeCell).join(','))
  return lines.join('\n')
}

function pct(makes, attempts) {
  return attempts > 0 ? (makes / attempts).toFixed(4) : ''
}

// One row per freeform distance log, carrying its parent session's context.
export function buildFreeformCsv({ sessions } = {}) {
  const headers = [
    'session_date',
    'distance_feet',
    'zone',
    'makes',
    'attempts',
    'make_pct',
    'tags',
    'notes',
  ]
  const rows = []
  for (const s of sessions ?? []) {
    for (const log of s.putt_distance_logs ?? []) {
      rows.push([
        s.session_date,
        log.distance_feet,
        log.zone,
        log.makes,
        log.attempts,
        pct(log.makes, log.attempts),
        (s.tags ?? []).join('|'),
        s.notes ?? '',
      ])
    }
  }
  return toCsv(headers, rows)
}

// One row per regimen-run set, carrying its parent run's context.
export function buildRegimenCsv({ runs } = {}) {
  const headers = [
    'started_at',
    'completed_at',
    'regimen',
    'completed',
    'total_score',
    'set_order',
    'distance_min_ft',
    'distance_max_ft',
    'makes',
    'attempts',
    'make_pct',
    'longest_streak',
    'clean_set',
    'pressure_putt_made',
    'points_earned',
    'tags',
    'notes',
  ]
  const rows = []
  for (const r of runs ?? []) {
    const sets = r.putting_regimen_run_sets ?? []
    for (const set of sets) {
      const def = set.putting_regimen_sets
      rows.push([
        r.started_at,
        r.completed_at ?? '',
        r.putting_regimens?.name ?? '',
        r.completed,
        r.total_score,
        def?.set_order ?? '',
        def?.distance_feet_min ?? '',
        def?.distance_feet_max ?? '',
        set.makes,
        set.attempts,
        pct(set.makes, set.attempts),
        set.longest_streak ?? '',
        set.clean_set,
        set.pressure_putt_made,
        set.points_earned,
        (r.tags ?? []).join('|'),
        r.notes ?? '',
      ])
    }
  }
  return toCsv(headers, rows)
}

// Impure: triggers a browser download of a CSV string. Kept out of the tested
// surface (needs Blob/URL/document, absent under this repo's node vitest).
export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
