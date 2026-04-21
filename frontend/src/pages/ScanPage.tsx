import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { scansApi } from '../api/scans'
import { supabase } from '../lib/supabase'
import { useTheme, getTokens } from '../hooks/useTheme'
import AppLayout from '../components/Layout/AppLayout'

interface ProgressState {
  message: string
  progress_pct: number
  partial_findings: number
  status: string
}

const PIPELINE_STEPS = [
  'Cloning repository...',
  'Scanning for secrets and credentials...',
  'Analyzing code structure...',
  'Running deep analysis...',
  'Calculating security score...',
  'Scan complete',
]

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const t = getTokens(isDark)

  // Primary mechanism: poll every 2s
  useEffect(() => {
    if (!scanId) return

    const poll = async () => {
      try {
        const report = await scansApi.get(scanId)
        if (report.status === 'completed') {
          setProgress(prev => ({
            ...(prev ?? { message: '', partial_findings: 0 }),
            message: 'Scan complete',
            progress_pct: 100,
            partial_findings: report.total_vulnerabilities,
            status: 'completed',
          }))
          clearInterval(pollInterval.current!)
          setTimeout(() => navigate(`/report/${scanId}`), 1200)
        } else if (report.status === 'failed') {
          setProgress({
            message: report.error_message ?? 'Scan failed.',
            progress_pct: 0,
            partial_findings: 0,
            status: 'failed',
          })
          clearInterval(pollInterval.current!)
        }
      } catch {
        // keep polling silently
      }
    }

    pollInterval.current = setInterval(poll, 2000)
    return () => clearInterval(pollInterval.current!)
  }, [scanId, navigate])

  // Bonus: Supabase Realtime for live progress percentage
  useEffect(() => {
    if (!scanId) return
    const channel = supabase
      .channel(`progress-${scanId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'scan_progress',
        filter: `scan_id=eq.${scanId}`,
      }, (payload) => {
        const data = payload.new as { message: string; progress_pct: number; partial_findings: number }
        setProgress(prev => ({
          message: data.message,
          progress_pct: data.progress_pct,
          partial_findings: data.partial_findings,
          status: prev?.status ?? 'running',
        }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [scanId])

  const handleScan = async () => {
    setError(null)
    setLoading(true)
    setProgress(null)
    try {
      const result = await scansApi.create({ repo_url: repoUrl.trim() })
      setScanId(result.scan_id)
      setProgress({ message: 'Scan queued — starting shortly...', progress_pct: 2, partial_findings: 0, status: 'queued' })
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to start scan.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setLoading(false)
    }
  }

  const isValidUrl = /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(repoUrl.trim())
  const isFailed = progress?.status === 'failed'
  const isComplete = progress?.status === 'completed'
  const displayPct = progress?.progress_pct ?? 0

  const visibleSteps = PIPELINE_STEPS.slice(
    0,
    Math.min(PIPELINE_STEPS.length, Math.ceil((displayPct / 100) * PIPELINE_STEPS.length) + 1)
  )

  return (
    <AppLayout>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .scan-animate { animation: fadeIn 0.5s ease forwards; }
      `}</style>

      <div className="scan-animate" style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 300,
            letterSpacing: '-1px', color: t.text, marginBottom: 8,
          }}>
            New <span style={{ fontWeight: 600 }}>Scan</span>
          </h1>
          <p style={{ fontSize: 15, color: t.textSecondary }}>
            Submit any public GitHub repository URL for vulnerability analysis.
          </p>
        </div>

        {/* Input card */}
        <div style={{
          background: t.cardBg, border: `1px solid ${t.cardBorder}`,
          borderRadius: 12, padding: '28px 32px', marginBottom: 24,
        }}>
          <label style={{
            display: 'block', fontSize: 13, fontWeight: 500,
            color: t.textSecondary, marginBottom: 10,
          }}>
            GitHub Repository URL
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="url"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isValidUrl && !scanId && handleScan()}
              placeholder="https://github.com/owner/repository"
              disabled={!!scanId}
              style={{
                flex: 1, background: t.inputBg,
                border: `1.5px solid ${t.inputBorder}`, borderRadius: 8,
                padding: '11px 16px', fontSize: 14, color: t.text,
                fontFamily: 'inherit', outline: 'none',
                transition: 'border-color 0.2s',
                opacity: scanId ? 0.6 : 1,
              }}
              onFocus={e => e.target.style.borderColor = t.inputFocus}
              onBlur={e => e.target.style.borderColor = t.inputBorder}
            />
            <button
              onClick={handleScan}
              disabled={!isValidUrl || loading || !!scanId}
              style={{
                background: t.btnPrimary, color: t.btnPrimaryTxt,
                padding: '11px 22px', borderRadius: 8,
                fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: !isValidUrl || loading || !!scanId ? 0.45 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Starting...' : 'Scan'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: '#fee2e2', border: '1px solid #fecaca',
              borderRadius: 6, fontSize: 13, color: '#dc2626',
            }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Progress card */}
        {progress && (
          <div style={{
            background: t.cardBg,
            border: `1px solid ${isFailed ? '#fecaca' : t.cardBorder}`,
            borderRadius: 12, padding: '28px 32px',
            animation: 'fadeIn 0.4s ease forwards',
          }}>
            {/* Progress bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary }}>
                  {isFailed ? 'Scan failed' : isComplete ? 'Analysis complete' : 'Analyzing...'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: "'DM Mono', monospace" }}>
                  {displayPct}%
                </span>
              </div>
              <div style={{ height: 4, background: t.bgTertiary, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: isFailed ? '#ef4444' : isComplete ? '#22c55e' : t.text,
                  width: `${displayPct}%`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>

            {/* Current message */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', background: t.bgTertiary,
              borderRadius: 8, marginBottom: 20,
            }}>
              {!isFailed && !isComplete && (
                <div style={{
                  width: 14, height: 14, flexShrink: 0,
                  border: `2px solid ${t.border}`, borderTopColor: t.text,
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
              )}
              {isComplete && <span style={{ fontSize: 14 }}>✓</span>}
              {isFailed && <span style={{ fontSize: 14 }}>⚠</span>}
              <span style={{ fontSize: 13, color: t.text }}>{progress.message}</span>
            </div>

            {/* Step log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visibleSteps.map((step, i) => {
                const isDone = i < visibleSteps.length - 1
                const isCurrent = i === visibleSteps.length - 1 && !isComplete && !isFailed
                return (
                  <div key={step} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 12, fontFamily: "'DM Mono', monospace",
                    color: isDone ? t.textSecondary : isCurrent ? t.text : t.textMuted,
                    opacity: isDone ? 0.7 : 1,
                    animation: `fadeIn 0.3s ease ${i * 60}ms both`,
                  }}>
                    <span style={{ color: isDone ? '#22c55e' : t.textMuted, flexShrink: 0 }}>
                      {isDone ? '✓' : isCurrent ? '▶' : '○'}
                    </span>
                    {step}
                  </div>
                )
              })}
            </div>

            {/* Findings counter */}
            {(progress.partial_findings ?? 0) > 0 && (
              <div style={{
                marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.borderLight}`,
                fontSize: 13, color: t.textSecondary,
              }}>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>{progress.partial_findings}</span>
                {' '}finding{progress.partial_findings !== 1 ? 's' : ''} detected so far
              </div>
            )}

            {/* Navigate when complete */}
            {isComplete && (
              <button
                onClick={() => navigate(`/report/${scanId}`)}
                style={{
                  marginTop: 20, width: '100%',
                  background: t.btnPrimary, color: t.btnPrimaryTxt,
                  padding: '12px 24px', borderRadius: 8,
                  fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                  border: 'none', cursor: 'pointer', transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                View full report →
              </button>
            )}

            {/* Retry on failure */}
            {isFailed && (
              <button
                onClick={() => { setScanId(null); setProgress(null); setLoading(false) }}
                style={{
                  marginTop: 16, width: '100%',
                  background: 'transparent', color: t.text,
                  padding: '11px 24px', borderRadius: 8,
                  fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                  border: `1.5px solid ${t.border}`, cursor: 'pointer',
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* Info cards — shown before scan starts */}
        {!scanId && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12,
            animation: 'fadeIn 0.5s ease 0.1s both',
          }}>
            {[
              { icon: '🔒', title: 'Sandboxed', desc: 'No code is executed from the scanned repository' },
              { icon: '⚡', title: 'Fast', desc: 'Most repositories complete in under 30 seconds' },
              { icon: '📋', title: 'Detailed', desc: 'Every finding includes file, line, and fix advice' },
              { icon: '🎯', title: 'Accurate', desc: 'Three analysis layers reduce false positives' },
            ].map(card => (
              <div key={card.title} style={{
                background: t.cardBg, border: `1px solid ${t.cardBorder}`,
                borderRadius: 10, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{card.icon}</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>{card.title}</p>
                <p style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}