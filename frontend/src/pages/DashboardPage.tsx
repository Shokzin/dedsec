import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { scansApi } from '../api/scans'
import type { ScanListItem } from '../api/scans'
import Layout from '../components/Layout/Layout'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'text-dedsec-green border-dedsec-green',
    running: 'text-dedsec-cyan border-dedsec-cyan animate-pulse',
    queued: 'text-yellow-400 border-yellow-400',
    failed: 'text-dedsec-red border-dedsec-red',
  }
  return (
    <span className={`text-xs border px-2 py-0.5 rounded uppercase tracking-wider ${styles[status] ?? 'text-dedsec-muted border-dedsec-border'}`}>
      {status}
    </span>
  )
}

function ScanRow({ scan, onClick }: { scan: ScanListItem; onClick: () => void }) {
  const repoName = scan.repo_url.replace('https://github.com/', '')
  const date = new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div onClick={onClick} className="flex items-center justify-between p-4 border border-dedsec-border rounded-lg bg-dedsec-card hover:border-dedsec-green/50 cursor-pointer transition-all group">
      <div className="flex items-center gap-4 min-w-0">
        <span className="text-dedsec-green text-lg">⬡</span>
        <div className="min-w-0">
          <p className="text-sm text-white font-medium truncate group-hover:text-dedsec-green transition-colors">{repoName}</p>
          <p className="text-xs text-dedsec-muted mt-0.5">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        {scan.status === 'completed' && (
          <div className="text-center hidden sm:block">
            <p className="text-xs text-dedsec-muted uppercase tracking-wider">Vulns</p>
            <p className="text-sm font-bold text-white">{scan.total_vulnerabilities}</p>
          </div>
        )}
        {scan.security_score !== null && (
          <div className="text-center hidden sm:block">
            <p className="text-xs text-dedsec-muted uppercase tracking-wider">Score</p>
            <p className={`text-sm font-bold ${scan.security_score >= 80 ? 'text-dedsec-green' : scan.security_score >= 60 ? 'text-yellow-400' : scan.security_score >= 40 ? 'text-orange-400' : 'text-dedsec-red'}`}>
              {scan.security_score}
            </p>
          </div>
        )}
        <StatusBadge status={scan.status} />
        <span className="text-dedsec-muted group-hover:text-dedsec-green transition-colors">→</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: scans, isLoading, isError } = useQuery({
    queryKey: ['scans'],
    queryFn: scansApi.list,
    refetchInterval: 5000,
  })

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Scan <span className="text-dedsec-green">History</span></h1>
          <p className="text-dedsec-muted text-sm mt-1">{scans?.length ?? 0} repositories analyzed</p>
        </div>
        <button onClick={() => navigate('/scan')} className="bg-dedsec-green text-black font-bold px-5 py-2.5 rounded text-sm tracking-wider uppercase hover:bg-green-300 transition-colors">
          + New Scan
        </button>
      </div>

      {scans && scans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Scans', value: scans.length },
            { label: 'Completed', value: scans.filter(s => s.status === 'completed').length },
            { label: 'Avg Score', value: (() => { const c = scans.filter(s => s.security_score !== null); if (!c.length) return '—'; return Math.round(c.reduce((a, b) => a + (b.security_score ?? 0), 0) / c.length) })() },
            { label: 'Total Vulns', value: scans.reduce((a, b) => a + b.total_vulnerabilities, 0) },
          ].map(stat => (
            <div key={stat.label} className="bg-dedsec-card border border-dedsec-border rounded-lg p-4">
              <p className="text-xs text-dedsec-muted uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-dedsec-green mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div className="text-center py-20 text-dedsec-muted"><p className="text-dedsec-green animate-pulse-green text-lg">⬡</p><p className="mt-2 text-sm">Loading...</p></div>}
      {isError && <div className="text-center py-20 border border-dedsec-red/30 rounded-lg"><p className="text-dedsec-red text-sm">Failed to load scans. Is the API running?</p></div>}

      {!isLoading && !isError && scans?.length === 0 && (
        <div className="text-center py-20 border border-dedsec-border rounded-lg">
          <p className="text-4xl mb-4">☠️</p>
          <p className="text-white font-medium">No scans yet</p>
          <p className="text-dedsec-muted text-sm mt-1 mb-6">Submit a GitHub repository to get started</p>
          <button onClick={() => navigate('/scan')} className="border border-dedsec-green text-dedsec-green px-6 py-2 rounded text-sm tracking-wider uppercase hover:bg-dedsec-green hover:text-black transition-all">
            Start First Scan
          </button>
        </div>
      )}

      {!isLoading && scans && scans.length > 0 && (
        <div className="space-y-3">
          {scans.map(scan => <ScanRow key={scan.scan_id} scan={scan} onClick={() => navigate(`/report/${scan.scan_id}`)} />)}
        </div>
      )}
    </Layout>
  )
}