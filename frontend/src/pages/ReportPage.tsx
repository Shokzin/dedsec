import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { scansApi } from '../api/scans'
import type { VulnerabilityItem } from '../api/scans'
import Layout from '../components/Layout/Layout'
import ScoreCard from '../components/ScoreCard/ScoreCard'
import { SEVERITY_COLORS } from '../types'

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

function VulnCard({ vuln }: { vuln: VulnerabilityItem }) {
  const [expanded, setExpanded] = useState(false)
  const colors = SEVERITY_COLORS[vuln.severity]
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${colors}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-bold border px-2 py-0.5 rounded uppercase shrink-0 ${colors}`}>{vuln.severity}</span>
          <span className="text-sm text-white font-medium truncate">{vuln.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-dedsec-muted hidden sm:block truncate max-w-[200px]">{vuln.file_path}:{vuln.line_start}</span>
          <span className="text-dedsec-muted text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-current/20 p-4 space-y-4 bg-dedsec-bg/50">
          <div>
            <p className="text-xs text-dedsec-muted uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-white">{vuln.description}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-dedsec-muted uppercase tracking-wider mb-1">Location</p>
              <p className="text-xs font-mono text-dedsec-cyan">{vuln.file_path} — line {vuln.line_start}</p>
            </div>
            {vuln.cwe_id && <div><p className="text-xs text-dedsec-muted uppercase tracking-wider mb-1">CWE</p><p className="text-xs font-mono text-white">{vuln.cwe_id}</p></div>}
            {vuln.owasp_category && <div className="sm:col-span-2"><p className="text-xs text-dedsec-muted uppercase tracking-wider mb-1">OWASP</p><p className="text-xs text-white">{vuln.owasp_category}</p></div>}
          </div>
          {vuln.code_snippet && (
            <div>
              <p className="text-xs text-dedsec-muted uppercase tracking-wider mb-1">Code</p>
              <pre className="text-xs font-mono bg-dedsec-bg border border-dedsec-border rounded p-3 overflow-x-auto text-dedsec-green">{vuln.code_snippet}</pre>
            </div>
          )}
          <div className="border-l-2 border-dedsec-green pl-3">
            <p className="text-xs text-dedsec-muted uppercase tracking-wider mb-1">Recommendation</p>
            <p className="text-sm text-white">{vuln.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReportPage() {
  const { scanId } = useParams<{ scanId: string }>()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SeverityFilter>('all')
  const [search, setSearch] = useState('')

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: () => scansApi.get(scanId!),
    refetchInterval: (query) =>
      query.state.data?.status === 'running' || query.state.data?.status === 'queued' ? 3000 : false,
  })

  const filtered = report?.vulnerabilities.filter(v => {
    const matchesSeverity = filter === 'all' || v.severity === filter
    const matchesSearch = search === '' || v.title.toLowerCase().includes(search.toLowerCase()) || v.file_path.toLowerCase().includes(search.toLowerCase())
    return matchesSeverity && matchesSearch
  }) ?? []

  if (isLoading) return <Layout><div className="text-center py-20"><p className="text-dedsec-green animate-pulse-green text-lg">⬡</p><p className="mt-2 text-dedsec-muted text-sm">Loading report...</p></div></Layout>
  if (isError || !report) return <Layout><div className="text-center py-20 border border-dedsec-red/30 rounded-lg"><p className="text-dedsec-red text-sm">Report not found.</p><button onClick={() => navigate('/dashboard')} className="mt-4 text-dedsec-green text-xs underline">Back to dashboard</button></div></Layout>

  const repoName = report.repo_url.replace('https://github.com/', '')

  return (
    <Layout>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="min-w-0">
          <button onClick={() => navigate('/dashboard')} className="text-dedsec-muted text-xs hover:text-dedsec-green transition-colors mb-2 block">← Back to dashboard</button>
          <h1 className="text-xl font-bold text-white truncate">{repoName}</h1>
          <p className="text-dedsec-muted text-xs mt-1">{report.scanned_files} files scanned{report.scan_duration_seconds && ` · ${report.scan_duration_seconds}s`}</p>
        </div>
        {report.security_score !== null && <ScoreCard score={report.security_score} />}
      </div>

      {(report.status === 'running' || report.status === 'queued') && (
        <div className="mb-6 p-4 border border-dedsec-cyan/30 bg-dedsec-cyan/5 rounded-lg">
          <p className="text-dedsec-cyan text-sm">▶ Scan is {report.status} — page will update automatically</p>
        </div>
      )}

      {report.status === 'failed' && (
        <div className="mb-6 p-4 border border-dedsec-red/30 bg-dedsec-red/5 rounded-lg">
          <p className="text-dedsec-red text-sm">⚠ Scan failed: {report.error_message}</p>
        </div>
      )}

      {report.status === 'completed' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Critical', value: report.critical_count, color: 'text-red-400' },
            { label: 'High', value: report.high_count, color: 'text-orange-400' },
            { label: 'Medium', value: report.medium_count, color: 'text-yellow-400' },
            { label: 'Low', value: report.low_count, color: 'text-blue-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-dedsec-card border border-dedsec-border rounded-lg p-4">
              <p className="text-xs text-dedsec-muted uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {report.vulnerabilities.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text" placeholder="Search by title, file, or type..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-dedsec-card border border-dedsec-border rounded px-4 py-2 text-sm text-white placeholder-dedsec-muted focus:outline-none focus:border-dedsec-green transition-colors"
          />
          <div className="flex gap-2 flex-wrap">
            {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded text-xs uppercase tracking-wider border transition-all ${filter === f ? 'bg-dedsec-green text-black border-dedsec-green font-bold' : 'text-dedsec-muted border-dedsec-border hover:border-dedsec-green hover:text-white'}`}
              >{f}</button>
            ))}
          </div>
        </div>
      )}

      {report.status === 'completed' && report.vulnerabilities.length === 0 && (
        <div className="text-center py-20 border border-dedsec-green/30 rounded-lg">
          <p className="text-4xl mb-4">✓</p>
          <p className="text-dedsec-green font-medium">No vulnerabilities found</p>
          <p className="text-dedsec-muted text-sm mt-1">This repository looks clean</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(vuln => <VulnCard key={vuln.id} vuln={vuln} />)}
      </div>
    </Layout>
  )
}