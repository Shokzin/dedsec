import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTheme, getTokens } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { scansApi } from '../api/scans'
import type { ScanListItem } from '../api/scans'
import AppLayout from '../components/Layout/AppLayout'

function StatusPill({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string; dot: string }> = {
    completed: { bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
    running:   { bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
    queued:    { bg: '#fef9c3', color: '#854d0e', dot: '#eab308' },
    failed:    { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
  }
  const cfg = configs[status] ?? { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100,
      textTransform: 'capitalize', letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, animation: status === 'running' ? 'pulse 1.5s infinite' : 'none' }} />
      {status}
    </span>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span style={{ fontSize: 13, color: '#9ca3af' }}>—</span>
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : score >= 40 ? '#ea580c' : '#dc2626'
  return <span style={{ fontSize: 15, fontWeight: 600, color, fontFamily: "'DM Mono', monospace" }}>{score}</span>
}

function ScanRow({ scan, onClick, t }: { scan: ScanListItem; onClick: () => void; t: ReturnType<typeof getTokens> }) {
  const repoName = scan.repo_url.replace('https://github.com/', '')
  const [owner, repo] = repoName.split('/')
  const date = new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = new Date(scan.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <tr onClick={onClick} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = t.bgTertiary)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '16px 20px', borderBottom: `1px solid ${t.borderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.bgTertiary, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill={t.textMuted}>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: t.text, fontFamily: "'DM Mono', monospace" }}>
              <span style={{ color: t.textSecondary }}>{owner}/</span>{repo}
            </p>
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{date} at {time}</p>
          </div>
        </div>
      </td>
      <td style={{ padding: '16px 20px', borderBottom: `1px solid ${t.borderLight}`, textAlign: 'center' }}>
        <StatusPill status={scan.status} />
      </td>
      <td style={{ padding: '16px 20px', borderBottom: `1px solid ${t.borderLight}`, textAlign: 'center' }}>
        <ScoreBadge score={scan.security_score} />
      </td>
      <td style={{ padding: '16px 20px', borderBottom: `1px solid ${t.borderLight}`, textAlign: 'center' }}>
        {scan.status === 'completed' ? <span style={{ fontSize: 13, color: t.textSecondary }}>{scan.total_vulnerabilities}</span> : <span style={{ fontSize: 13, color: t.textMuted }}>—</span>}
      </td>
      <td style={{ padding: '16px 20px', borderBottom: `1px solid ${t.borderLight}`, textAlign: 'right' }}>
        <span style={{ fontSize: 13, color: t.textMuted }}>→</span>
      </td>
    </tr>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const t = getTokens(isDark)

  const { data: scans, isLoading, isError } = useQuery({
    queryKey: ['scans'],
    queryFn: scansApi.list,
    refetchInterval: 5000,
  })

  const completed = scans?.filter(s => s.status === 'completed') ?? []
  const avgScore = completed.length ? Math.round(completed.reduce((a, b) => a + (b.security_score ?? 0), 0) / completed.length) : null
  const totalVulns = scans?.reduce((a, b) => a + b.total_vulnerabilities, 0) ?? 0
  const running = scans?.filter(s => s.status === 'running' || s.status === 'queued') ?? []

  // Always use display_name from metadata first, then fall back to email username
  // This ensures the greeting updates immediately after profile changes
  const displayName = user?.user_metadata?.display_name
    || user?.email?.split('@')[0]
    || 'there'

  return (
    <AppLayout>
      <div style={{ marginBottom: 40, animation: 'fadeIn 0.5s ease forwards' }}>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 6 }}>
          Welcome back, {displayName}
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 300, letterSpacing: '-1px', color: t.text, lineHeight: 1.2 }}>
            Scan <span style={{ fontWeight: 600 }}>Dashboard</span>
          </h1>
          <button onClick={() => navigate('/scan')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: t.btnPrimary, color: t.btnPrimaryTxt,
            padding: '11px 22px', borderRadius: 6, fontSize: 14, fontWeight: 500,
            fontFamily: 'inherit', border: 'none', cursor: 'pointer',
            transition: 'opacity 0.2s, transform 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
          >
            + New scan
          </button>
        </div>
      </div>

      {scans && scans.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
          {[
            { label: 'Total scans', value: scans.length, mono: false },
            { label: 'Completed', value: completed.length, mono: false },
            { label: 'Avg score', value: avgScore !== null ? avgScore : '—', mono: true },
            { label: 'Total findings', value: totalVulns, mono: false },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              background: t.cardBg, border: `1px solid ${t.cardBorder}`,
              borderRadius: 10, padding: '20px 24px',
              animation: `fadeIn 0.5s ease ${i * 60}ms both`,
            }}>
              <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</p>
              <p style={{ fontSize: 28, fontWeight: 600, color: t.text, fontFamily: stat.mono ? "'DM Mono', monospace" : 'inherit', letterSpacing: stat.mono ? '-1px' : '-0.5px' }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {running.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 24 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#1d4ed8' }}>{running.length} scan{running.length > 1 ? 's' : ''} currently running — this page refreshes automatically.</p>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${t.border}`, borderTopColor: t.text, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14 }}>Loading scans...</p>
        </div>
      )}

      {isError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '16px 20px' }}>
          <p style={{ fontSize: 14, color: '#dc2626' }}>Failed to load scans. Make sure the API is running at {import.meta.env.VITE_API_URL}.</p>
        </div>
      )}

      {!isLoading && !isError && scans?.length === 0 && (
        <div style={{ border: `1px dashed ${t.border}`, borderRadius: 12, padding: '64px 40px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: t.bgTertiary, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 20 }}>🔍</div>
          <p style={{ fontSize: 16, fontWeight: 500, color: t.text, marginBottom: 8 }}>No scans yet</p>
          <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 28 }}>Submit a GitHub repository URL to run your first vulnerability scan.</p>
          <button onClick={() => navigate('/scan')} style={{ background: t.btnPrimary, color: t.btnPrimaryTxt, padding: '11px 24px', borderRadius: 6, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', border: 'none', cursor: 'pointer' }}>
            Start first scan →
          </button>
        </div>
      )}

      {!isLoading && scans && scans.length > 0 && (
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', animation: 'fadeIn 0.5s ease forwards' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: t.bgSecondary }}>
                {['Repository', 'Status', 'Score', 'Findings', ''].map((h, i) => (
                  <th key={h || i} style={{ padding: '12px 20px', fontSize: 11, fontWeight: 600, color: t.textMuted, textAlign: i === 0 ? 'left' : i === 4 ? 'right' : 'center', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${t.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => (
                <ScanRow key={scan.scan_id} scan={scan} t={t} onClick={() => navigate(`/report/${scan.scan_id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}