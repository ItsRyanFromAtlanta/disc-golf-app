import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { buildDataExportArchive, dataExportFilename, downloadDataExport } from '../lib/dataExport'
import { dataExportRepository } from '../lib/repository/dataExportRepository'

export default function DataExportPanel() {
  const { user } = useAuth()
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  async function exportData() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('error')
      setMessage('Connect to the internet before exporting. A partial device cache is never exported.')
      return
    }

    setStatus('working')
    setMessage('Reading your authoritative account data…')
    try {
      const generatedAt = new Date().toISOString()
      const datasets = await dataExportRepository.collectUserExport(user.id)
      setMessage('Building your private ZIP archive…')
      const archive = await buildDataExportArchive({ userId: user.id, datasets, generatedAt })
      downloadDataExport(archive, dataExportFilename(generatedAt))
      setStatus('complete')
      setMessage('Export ready. Keep the downloaded archive private—it contains your account history.')
    } catch (error) {
      setStatus('error')
      setMessage(error.message)
    }
  }

  return <section className="profile-section data-export-panel" aria-labelledby="data-export-title">
    <div className="profile-section-header"><h2 id="data-export-title">Your data</h2></div>
    <p className="settings-note">Download your synced account history as deterministic CSV files in one ZIP archive. Private photo metadata is included; photo files and unsynced device-only data are not.</p>
    <div className="profile-section-actions">
      <button type="button" onClick={exportData} disabled={status === 'working'}>
        {status === 'working' ? 'Preparing export…' : 'Export my data'}
      </button>
    </div>
    {message && <p className={status === 'error' ? 'form-error data-export-status' : 'settings-note data-export-status'} role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
  </section>
}
