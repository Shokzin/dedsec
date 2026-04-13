import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { scansApi } from '../api/scans'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout/Layout'

interface ProgressEvent {
  message: string
  progress_pct: number
  partial_findings: number
}

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!scanId) return
    const channel = supabase
      .channel(`scan-progress-${scanId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scan_progress', filter: `scan_id=eq.${scanId}` },
        (payload) => {
          const data = payload.new as ProgressEvent
          setProgress(data)
          if (data.progress_pct === 100) setTimeout(() => navigate(`/report/${scanId}`), 1000)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [scanId, navigate])

  const handleScan = async () => {
    setError(null)
    setLoading(true)
    setProgress(null)
    try {
      const result = await scansApi.create({ repo_url: repoUrl.trim() })
      setScanId(result.scan_id)
      setProgress({ message: 'Scan queued...', progress_pct: 0, partial_findings: 0 })
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to start scan.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setLoading(false)
    }
  }

  const isValidGithubUrl = repoUrl.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">New <span className="text-dedsec-green">Scan</span></h1>
          <p className="text-dedsec-muted text-sm mt-1">Submit a public GitHub repository for vulnerability analysis</p>
        </div>

        <div className="bg-dedsec-card border border-dedsec-border rounded-lg p-6 border-glow-green">
          <label className="block text-xs text-dedsec-muted mb-2 tracking-wider uppercase">GitHub Repository URL</label>
          <div className="flex gap-3">
            <input
              type="url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isValidGithubUrl && !loading && handleScan()}
              placeholder="https://github.com/owner/repository"
              disabled={!!scanId}
              className="flex-1 bg-dedsec-bg border border-dedsec-border rounded px-4 py-3 text-sm text-white placeholder-dedsec-muted focus:outline-none focus:border-dedsec-green transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleScan}
              disabled={!isValidGithubUrl || loading || !!scanId}
              className="bg-dedsec-green text-black font-bold px-6 py-3 rounded text-sm tracking-wider uppercase hover:bg-green-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'SCANNING...' : 'SCAN'}
            </button>
          </div>
          {error && <div className="mt-4 p-3 border border-dedsec-red/50 bg-dedsec-red/10 rounded text-dedsec-red text-xs">⚠ {error}</div>}
        </div>

        {progress && (
          <div className="mt-6 bg-dedsec-card border border-dedsec-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-dedsec-muted uppercase tracking-wider">Progress</span>
              <span className="text-dedsec-green text-sm font-bold">{progress.progress_pct}%</span>
            </div>
            <div className="w-full bg-dedsec-bg rounded-full h-1.5 mb-4">
              <div className="bg-dedsec-green h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress.progress_pct}%` }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-dedsec-green animate-pulse-green text-xs">▶</span>
              <span className="text-sm text-white">{progress.message}</span>
            </div>
            {progress.partial_findings > 0 && <div className="mt-3 text-xs text-dedsec-muted"><span className="text-dedsec-red font-bold">{progress.partial_findings}</span> findings so far</div>}
            <div className="mt-4 border-t border-dedsec-border pt-4 space-y-1">
              {['> Initializing scanner engine...', '> Cloning repository...', '> Running pattern analysis...', '> Running AST analysis...', '> Running AI analysis...']
                .slice(0, Math.ceil((progress.progress_pct / 100) * 5))
                .map((line, i) => <p key={i} className="text-xs text-dedsec-muted font-mono"><span className="text-dedsec-green">$</span> {line}</p>)}
            </div>
          </div>
        )}

        {!scanId && (
          <div className="mt-6 p-4 border border-dedsec-border rounded-lg">
            <p className="text-xs text-dedsec-muted uppercase tracking-wider mb-3">What we scan for</p>
            <div className="grid grid-cols-2 gap-2">
              {['⚠ Exposed secrets & API keys', '⚠ SQL Injection', '⚠ Cross-Site Scripting (XSS)', '⚠ Hardcoded credentials', '⚠ Insecure configurations', '⚠ IDOR & access control flaws', '⚠ Command injection', '⚠ Business logic issues']
                .map(item => <p key={item} className="text-xs text-dedsec-muted">{item}</p>)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}