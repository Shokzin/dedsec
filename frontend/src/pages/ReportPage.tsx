import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { scansApi } from '../api/scans'
import type { VulnerabilityItem } from '../api/scans'
import { useTheme, getTokens } from '../hooks/useTheme'
import AppLayout from '../components/Layout/AppLayout'

type Severity = 'critical' | 'high' | 'medium' | 'low'
type SeverityFilter = 'all' | Severity

const SEV: Record<Severity, { bg: string; color: string; border: string; dot: string; order: number }> = {
  critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '#ef4444', order: 0 },
  high:     { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#f97316', order: 1 },
  medium:   { bg: '#fefce8', color: '#92400e', border: '#fde68a', dot: '#eab308', order: 2 },
  low:      { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', order: 3 },
}

function ScoreRing({ score, t }: { score: number; t: ReturnType<typeof getTokens> }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'
  const label = score >= 80 ? 'Secure' : score >= 60 ? 'Moderate' : score >= 40 ? 'Vulnerable' : 'Critical'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 110, height: 110 }}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={r} fill="none" stroke={t.border} strokeWidth="7" />
          <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - score / 100)}
            strokeLinecap="round" transform="rotate(-90 55 55)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
          <text x="55" y="50" textAnchor="middle" fontSize="22" fontWeight="600" fill={t.text}>{score}</text>
          <text x="55" y="66" textAnchor="middle" fontSize="11" fill={t.textMuted}>/100</text>
        </svg>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEV[severity]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 100, textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot }} />
      {severity}
    </span>
  )
}

function VulnCard({ vuln, t, isDark }: { vuln: VulnerabilityItem; t: ReturnType<typeof getTokens>; isDark: boolean }) {
  const [open, setOpen] = useState(false)
  const sev = vuln.severity as Severity
  const cfg = SEV[sev] ?? SEV.low

  return (
    <div style={{ border: `1px solid ${open ? cfg.border : t.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
          padding: '16px 20px',
          background: open ? (isDark ? cfg.bg + '15' : cfg.bg + '80') : t.cardBg,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = t.bgTertiary }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = t.cardBg }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <SeverityBadge severity={sev} />
          <span style={{ fontSize: 14, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vuln.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: t.textMuted, fontFamily: "'DM Mono', monospace" }}>
            {vuln.file_path?.split('/').pop()}:{vuln.line_start}
          </span>
          <span style={{ fontSize: 12, color: t.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${cfg.border}`, padding: '20px 24px', background: t.cardBg, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: t.textSecondary }}>{vuln.description}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Location</p>
              <p style={{ fontSize: 13, color: t.text, fontFamily: "'DM Mono', monospace" }}>
                {vuln.file_path}<br />
                <span style={{ color: t.textMuted }}>Line {vuln.line_start}{vuln.line_end !== vuln.line_start ? `–${vuln.line_end}` : ''}</span>
              </p>
            </div>
            {vuln.cwe_id && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>CWE</p>
                <a href={`https://cwe.mitre.org/data/definitions/${vuln.cwe_id.replace('CWE-', '')}.html`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: cfg.color, fontFamily: "'DM Mono', monospace", textDecoration: 'none' }}>
                  {vuln.cwe_id} ↗
                </a>
              </div>
            )}
            {vuln.owasp_category && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>OWASP</p>
                <p style={{ fontSize: 13, color: t.textSecondary }}>{vuln.owasp_category}</p>
              </div>
            )}
          </div>

          {vuln.code_snippet && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Code</p>
              <pre style={{
                background: isDark ? '#0d0d0d' : '#f8f8f8',
                border: `1px solid ${t.border}`, borderRadius: 8,
                padding: '14px 16px', overflow: 'auto',
                fontSize: 12, lineHeight: 1.6,
                fontFamily: "'DM Mono', monospace",
                color: isDark ? '#e0e0e0' : '#1a1a1a', margin: 0,
              }}>{vuln.code_snippet}</pre>
            </div>
          )}

          <div style={{ borderLeft: `3px solid ${cfg.dot}`, paddingLeft: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Recommendation</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: t.textSecondary }}>{vuln.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReportPage() {
  const { scanId } = useParams<{ scanId: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [search, setSearch] = useState('')

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: () => scansApi.get(scanId!),
    refetchInterval: q =>
      q.state.data?.status === 'running' || q.state.data?.status === 'queued' ? 3000 : false,
  })

  const filtered = report?.vulnerabilities
    .filter(v => {
      const ms = severityFilter === 'all' || v.severity === severityFilter
      const mq = !search ||
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.file_path.toLowerCase().includes(search.toLowerCase()) ||
        v.type.toLowerCase().includes(search.toLowerCase())
      return ms && mq
    })
    .sort((a, b) => (SEV[a.severity as Severity]?.order ?? 4) - (SEV[b.severity as Severity]?.order ?? 4))
    ?? []

  if (isLoading) return (
    <AppLayout>
      <div style={{ textAlign: 'center', padding: '80px 0', color: t.textMuted }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${t.border}`, borderTopColor: t.text, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ fontSize: 14 }}>Loading report...</p>
      </div>
    </AppLayout>
  )

  if (isError || !report) return (
    <AppLayout>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 15, color: '#dc2626', marginBottom: 16 }}>Report not found.</p>
        <button onClick={() => navigate('/dashboard')} style={{ fontSize: 14, color: t.text, background: 'none', border: `1.5px solid ${t.border}`, borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Back to dashboard
        </button>
      </div>
    </AppLayout>
  )

  const repoName = report.repo_url.replace('https://github.com/', '')
  const [owner, repo] = repoName.split('/')
  const isRunning = report.status === 'running' || report.status === 'queued'

  return (
    <AppLayout>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .report-animate { animation: fadeIn 0.5s ease forwards; }
      `}</style>

      <div className="report-animate">
        {/* Breadcrumb */}
        <button onClick={() => navigate('/dashboard')} style={{ fontSize: 13, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.2s', padding: 0, marginBottom: 20 }}
          onMouseEnter={e => e.currentTarget.style.color = t.text}
          onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
        >
          ← Dashboard
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
          <div>
            <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 4 }}>Scan report</p>
            <h1 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 300, letterSpacing: '-1px', color: t.text, lineHeight: 1.2, fontFamily: "'DM Mono', monospace" }}>
              <span style={{ color: t.textSecondary }}>{owner}/</span>{repo}
            </h1>
            {report.status === 'completed' && (
              <p style={{ fontSize: 13, color: t.textMuted, marginTop: 6 }}>
                {report.scanned_files} files · {report.scan_duration_seconds?.toFixed(1)}s
              </p>
            )}
          </div>
          {report.security_score !== null && <ScoreRing score={report.security_score} t={t} />}
        </div>

        {/* Running */}
        {isRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 18px', marginBottom: 28 }}>
            <div style={{ width: 14, height: 14, border: '2px solid #93c5fd', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#1d4ed8' }}>Scan is {report.status} — results will appear automatically when complete.</p>
          </div>
        )}

        {/* Failed */}
        {report.status === 'failed' && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '14px 18px', marginBottom: 28 }}>
            <p style={{ fontSize: 13, color: '#dc2626' }}>⚠ Scan failed: {report.error_message}</p>
          </div>
        )}

        {/* Stats */}
        {report.status === 'completed' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 36 }}>
            {[
              { label: 'Total', value: report.total_vulnerabilities, color: t.text, id: 'all' },
              { label: 'Critical', value: report.critical_count, color: '#ef4444', id: 'critical' },
              { label: 'High', value: report.high_count, color: '#f97316', id: 'high' },
              { label: 'Medium', value: report.medium_count, color: '#eab308', id: 'medium' },
              { label: 'Low', value: report.low_count, color: '#3b82f6', id: 'low' },
            ].map((s, i) => (
              <div key={s.label} onClick={() => setSeverityFilter(s.id as SeverityFilter)}
                style={{
                  background: t.cardBg,
                  border: `1.5px solid ${severityFilter === s.id ? t.text : t.cardBorder}`,
                  borderRadius: 10, padding: '16px 18px', cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  animation: `fadeIn 0.5s ease ${i * 50}ms both`,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.text}
                onMouseLeave={e => { e.currentTarget.style.borderColor = severityFilter === s.id ? t.text : t.cardBorder }}
              >
                <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontSize: 26, fontWeight: 600, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Clean state */}
        {report.status === 'completed' && report.vulnerabilities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 40px', border: `1px dashed ${t.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: t.text, marginBottom: 8 }}>No vulnerabilities found</p>
            <p style={{ fontSize: 14, color: t.textSecondary }}>This repository looks clean across all three analysis layers.</p>
          </div>
        )}

        {/* Search + filter */}
        {report.vulnerabilities.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Search by title, file, or type..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.text, fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = t.inputFocus}
              onBlur={e => e.target.style.borderColor = t.inputBorder}
            />
            <p style={{ fontSize: 13, color: t.textMuted }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        )}

        {filtered.length === 0 && report.vulnerabilities.length > 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: t.textMuted }}>
            <p style={{ fontSize: 14 }}>No results match your filter.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((vuln, i) => (
            <div key={vuln.id} style={{ animation: `fadeIn 0.4s ease ${i * 30}ms both` }}>
              <VulnCard vuln={vuln} t={t} isDark={isDark} />
            </div>
          ))}
        </div>

        {/* Footer */}
        {report.status === 'completed' && report.vulnerabilities.length > 0 && (
          <div style={{ marginTop: 40, paddingTop: 32, borderTop: `1px solid ${t.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 13, color: t.textMuted }}>
              {report.total_vulnerabilities} vulnerabilities · {report.scanned_files} files · {report.scan_duration_seconds?.toFixed(1)}s
            </p>
            <button onClick={() => navigate('/scan')}
              style={{ background: t.btnPrimary, color: t.btnPrimaryTxt, padding: '10px 22px', borderRadius: 6, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Scan another repository →
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}