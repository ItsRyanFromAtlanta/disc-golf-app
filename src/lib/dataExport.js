import { strToU8, zip } from 'fflate'

export const DATA_EXPORT_FORMAT_VERSION = 1

const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/
const PRIORITY_COLUMNS = ['id', 'user_id']

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function csvCell(value) {
  if (value == null) return ''
  let text = typeof value === 'object' ? stableJson(value) : String(value)
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function orderedColumns(rows, minimumColumns = ['id']) {
  const names = new Set(minimumColumns)
  rows.forEach((row) => Object.keys(row).forEach((key) => names.add(key)))
  return [...names].sort((left, right) => {
    const leftPriority = PRIORITY_COLUMNS.indexOf(left)
    const rightPriority = PRIORITY_COLUMNS.indexOf(right)
    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) return 1
      if (rightPriority === -1) return -1
      return leftPriority - rightPriority
    }
    return left.localeCompare(right)
  })
}

function compareRows(left, right) {
  const leftKey = left.id ?? `${left.user_id ?? ''}:${left.category ?? ''}`
  const rightKey = right.id ?? `${right.user_id ?? ''}:${right.category ?? ''}`
  return String(leftKey).localeCompare(String(rightKey))
}

export function rowsToCsv(rows, minimumColumns = ['id']) {
  const columns = orderedColumns(rows, minimumColumns)
  const lines = [columns.map(csvCell).join(',')]
  ;[...rows].sort(compareRows).forEach((row) => {
    lines.push(columns.map((column) => csvCell(row[column])).join(','))
  })
  return { columns, csv: `\uFEFF${lines.join('\r\n')}\r\n` }
}

export function createExportFiles({ userId, datasets, generatedAt = new Date().toISOString() }) {
  const tableFiles = {}
  const manifestFiles = []

  Object.keys(datasets).sort().forEach((table) => {
    const dataset = datasets[table]
    const filename = `data/${table}.csv`
    const { columns, csv } = rowsToCsv(dataset.rows, dataset.minimumColumns)
    tableFiles[filename] = csv
    manifestFiles.push({
      filename,
      table,
      scope: dataset.scope,
      row_count: dataset.rows.length,
      columns,
    })
  })

  const manifest = {
    format: 'disc-golf-manager-data-export',
    format_version: DATA_EXPORT_FORMAT_VERSION,
    generated_at: generatedAt,
    source_cutoff: generatedAt,
    account_id: userId,
    source: 'Supabase remote Data API under the signed-in user\'s RLS session',
    files: manifestFiles,
    exclusions: [
      'Pending or device-only local data that has not synced to Supabase',
      'Private disc-photo binary objects; disc_photos.csv contains their metadata and storage paths',
      'Server-only catalog ingestion, administration, and secret data',
    ],
  }

  return {
    ...tableFiles,
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'README.txt': [
      'Disc Golf Manager & Caddie App data export',
      '',
      'CSV files are UTF-8, deterministically ordered, and spreadsheet-formula safe.',
      'See manifest.json for row counts, columns, scope, and exclusions.',
      'Sync every device before exporting if you need the newest locally captured facts.',
      '',
    ].join('\n'),
  }
}

export function buildDataExportArchive(options) {
  const files = createExportFiles(options)
  const archiveEntries = Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, strToU8(contents)]))
  return new Promise((resolve, reject) => {
    zip(archiveEntries, { level: 6 }, (error, bytes) => error ? reject(error) : resolve(bytes))
  })
}

export function dataExportFilename(generatedAt = new Date().toISOString()) {
  return `disc-golf-manager-export-${generatedAt.slice(0, 10)}.zip`
}

export function downloadDataExport(bytes, filename, { urlApi = URL, documentApi = document } = {}) {
  const url = urlApi.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  const link = documentApi.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  urlApi.revokeObjectURL(url)
}
