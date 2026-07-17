import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { weeklyReportRepository } from '../lib/repository/weeklyReportRepository'

const reportDate = (value) => new Date(`${value}T00:00:00Z`).toLocaleDateString([], {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
})
const pct = (value) => value == null ? '—' : `${Math.round(value * 100)}%`
const highlightText = {
  putting_accuracy: (item) => `${pct(item.value)} putting across ${item.sampleSize} putts`,
  practice_sessions: (item) => `${item.value} practice session${item.value === 1 ? '' : 's'}`,
  rounds_completed: (item) => `${item.value} completed round${item.value === 1 ? '' : 's'}`,
}

function ReportVersion({ report, latest }) {
  const metrics = report.metrics ?? {}
  const counts = report.sample_counts ?? {}
  return <article className="weekly-report-card">
    <header className="weekly-report-head">
      <div><h3>Version {report.version}</h3><span>{latest ? 'Current version' : 'Superseded snapshot'}</span></div>
      <span className="status-chip">{report.generation_reason.replaceAll('_', ' ')}</span>
    </header>
    <div className="weekly-report-metrics">
      <div><strong>{metrics.attempts ?? 0}</strong><span>Putts</span></div>
      <div><strong>{pct(metrics.makePct)}</strong><span>Conversion</span></div>
      <div><strong>{metrics.completedRounds ?? 0}</strong><span>Rounds</span></div>
    </div>
    {(report.highlights ?? []).length > 0
      ? <ul className="weekly-report-highlights">{report.highlights.map((item) => <li key={item.key}>{highlightText[item.key]?.(item) ?? `${item.key}: ${item.value}`}</li>)}</ul>
      : <p className="career-note">No completed activity was recorded in this window.</p>}
    <dl className="weekly-report-audit">
      <div><dt>Samples</dt><dd>{counts.practiceSessions ?? 0} practice · {counts.rounds ?? 0} round rows</dd></div>
      <div><dt>Timezone</dt><dd>{report.timezone}</dd></div>
      <div><dt>Calculation</dt><dd>{report.calculation_version}</dd></div>
      <div><dt>Source cutoff</dt><dd><time dateTime={report.source_cutoff}>{new Date(report.source_cutoff).toLocaleString()}</time></dd></div>
    </dl>
  </article>
}

export default function WeeklyReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => setReports(await weeklyReportRepository.list(user.id)), [user.id])
  useEffect(() => { load().catch((err) => setError(err.message)) }, [load])

  const weeks = useMemo(() => {
    const grouped = new Map()
    for (const report of reports ?? []) grouped.set(report.week_start, [...(grouped.get(report.week_start) ?? []), report])
    return [...grouped.entries()].map(([weekStart, versions]) => [weekStart, versions.sort((a, b) => b.version - a.version)])
  }, [reports])

  async function generate() {
    setBusy(true); setError(null)
    try { await weeklyReportRepository.generate(user.id); await load() }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!reports && !error) return <p className="loading">Loading weekly reports…</p>
  return <section className="weekly-reports-page">
    <header className="weekly-reports-intro">
      <div><h1>Weekly reports</h1><p>Deterministic Monday–Sunday recaps. Regeneration creates a new version and never overwrites history.</p></div>
      <button type="button" className="btn-primary" disabled={busy} onClick={generate}>{busy ? 'Generating…' : 'Generate last week'}</button>
    </header>
    {error && <p className="form-error">Weekly reports unavailable: {error}</p>}
    {weeks.length === 0 ? <p className="career-note">No reports yet. Generate the latest completed week when you are online.</p>
      : <div className="weekly-report-weeks">{weeks.map(([weekStart, versions]) => <section key={weekStart} className="weekly-report-week" aria-labelledby={`week-${weekStart}`}>
        <h2 id={`week-${weekStart}`}>{reportDate(weekStart)}–{reportDate(versions[0].week_end)}</h2>
        <ReportVersion report={versions[0]} latest />
        {versions.length > 1 && <details><summary>Earlier versions ({versions.length - 1})</summary>
          <div className="weekly-report-history">{versions.slice(1).map((report) => <ReportVersion key={report.id} report={report} />)}</div>
        </details>}
      </section>)}</div>}
  </section>
}
