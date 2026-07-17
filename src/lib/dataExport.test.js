import { describe, expect, it, vi } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import {
  buildDataExportArchive,
  createExportFiles,
  csvCell,
  dataExportFilename,
  rowsToCsv,
} from './dataExport'

describe('data export formatting', () => {
  it('quotes CSV values and neutralizes spreadsheet formulas without changing numbers', () => {
    expect(csvCell('=HYPERLINK("https://bad.example")')).toBe('"\'=HYPERLINK(""https://bad.example"")"')
    expect(csvCell('  +SUM(1,2)')).toBe('"\'  +SUM(1,2)"')
    expect(csvCell(-4)).toBe('"-4"')
    expect(csvCell('plain "text"')).toBe('"plain ""text"""')
  })

  it('uses stable columns, row order, JSON keys, UTF-8 BOM, and CRLF records', () => {
    const { columns, csv } = rowsToCsv([
      { id: 'b', user_id: 'u1', metadata: { z: 1, a: ['x', 'y'] } },
      { id: 'a', user_id: 'u1', metadata: null },
    ])

    expect(columns).toEqual(['id', 'user_id', 'metadata'])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"a","u1",\r\n"b","u1","{""a"":[""x"",""y""],""z"":1}"\r\n')
  })

  it('creates a manifest and readable ZIP with explicit exclusions', async () => {
    const options = {
      userId: 'user-1',
      generatedAt: '2026-07-17T04:00:00.000Z',
      datasets: {
        profiles: { rows: [{ id: 'user-1', username: 'ace' }], scope: 'owner', minimumColumns: ['id'] },
        rounds: { rows: [], scope: 'owner', minimumColumns: ['id', 'user_id'] },
      },
    }
    const files = createExportFiles(options)
    const manifest = JSON.parse(files['manifest.json'])

    expect(manifest.format_version).toBe(1)
    expect(manifest.files.map((file) => file.filename)).toEqual(['data/profiles.csv', 'data/rounds.csv'])
    expect(manifest.files[1]).toMatchObject({ row_count: 0, columns: ['id', 'user_id'] })
    expect(manifest.exclusions).toHaveLength(3)

    const archive = unzipSync(await buildDataExportArchive(options))
    expect(strFromU8(archive['manifest.json'])).toBe(files['manifest.json'])
    expect(strFromU8(archive['data/profiles.csv'])).toContain('"user-1","ace"')
    expect(dataExportFilename(options.generatedAt)).toBe('disc-golf-manager-export-2026-07-17.zip')
  })

  it('downloads through a temporary object URL', () => {
    const click = vi.fn()
    const link = { click }
    const documentApi = { createElement: vi.fn(() => link) }
    const urlApi = { createObjectURL: vi.fn(() => 'blob:export'), revokeObjectURL: vi.fn() }

    return import('./dataExport').then(({ downloadDataExport }) => {
      downloadDataExport(new Uint8Array([1, 2]), 'data.zip', { documentApi, urlApi })
      expect(documentApi.createElement).toHaveBeenCalledWith('a')
      expect(link).toMatchObject({ href: 'blob:export', download: 'data.zip' })
      expect(click).toHaveBeenCalledOnce()
      expect(urlApi.createObjectURL).toHaveBeenCalledOnce()
      expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:export')
    })
  })
})
