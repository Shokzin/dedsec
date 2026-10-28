import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { scansApi } from '../api/scans'
import type { ScanListItem } from '../api/scans'
import { compareScans } from '../lib/compareScans'
import type { ChangeStatus, ChangedFinding } from '../lib/compareScans'
import { useTheme, getTokens } from '../hooks/useTheme'
import AppLayout from '../components/Layout/AppLayout'

type Tokens = ReturnType<typeof getTokens>

const STATUS: Record<ChangeStatus, { label: string; color: string; bg: string; border: string; sign: string }> = {
  fixed:     { label: 'Fixed',     color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', sign: '−' },
  new:       { label: 'New',       color: '#dc2626', bg: '#fef2f2', border: '#fecaca', sign: '+' },
  unchanged: { label: 'Unchanged', color: '#71717a', bg: '#fafafa', border: '#e4e4e7', sign: '=' },
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
}

function repoNameOf(url: string): string {
  return url.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function StatCard({ status, value, t }: { status: ChangeStatus; value: number; t: Tokens }) {
  const cfg = STATUS[status]
  return (
    <div style={{
      background: t.cardBg, border: `1.5px solid ${t.cardBorder}`,
      borderRadius: 10, padding: '16px 18px',
    }}>
      <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {cfg.label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 600, color: cfg.color, letterSpacing: '-0.5px' }}>
        {value}
      </p>
    </div>
  )
}

function ScoreShift({ before, after, t }: { before: number | null; after: number | null; t: Tokens }) {
  if (before === null || after === null) return null
  const delta = after - before
  const color = delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : t.textMuted
  const tone = (s: number) => (s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      background: t.cardBg, border: `1px solid ${t.cardBorder}`,
      borderRadius: 10, padding: '18px 22px', marginBottom: 20,
    }}>
      <div>
        <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Previous</p>
        <p style={{ fontSize: 30, fontWeight: 600, color: tone(before), letterSpacing: '-1px', margin: 0 }}>{before}</p>
      </div>
      <span style={{ fontSize: 22, color: t.textMuted }}>→</span>
      <div>
        <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Current</p>
        <p style={{ fontSize: 30, fontWeight: 600, color: tone(after), letterSpacing: '-1px', margin: 0 }}>{after}</p>
      </div>
      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
        <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Change</p>
        <p style={{ fontSize: 22, fontWeight: 600, color, margin: 0 }}>
          {delta > 0 ? '+' : ''}{delta}
        </p>
      </div>
    </div>
  )
}

function FindingRow({ item, t }: { item: ChangedFinding; t: Tokens }) {
  const cfg = STATUS[item.status]
  const v = item.vuln
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 18px', border: `1px solid ${t.border}`, borderRadius: 9,
      borderLeft: `3px solid ${cfg.color}`,
    }}>
      <span style={{
        fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700,
        color: cfg.color, width: 14, flexShrink: 0, textAlign: 'center',
      }}>{cfg.sign}</span>

      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: SEV_COLOR[v.severity] ?? SEV_COLOR.low,
      }} title={v.severity} />

      <span style={{
        fontSize: 14, color: t.text, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: item.status === 'fixed' ? 'line-through' : 'none',
        opacity: item.status === 'fixed' ? 0.65 : 1,
      }}>{v.title}</span>

      <span style={{
        marginLeft: 'auto', flexShrink: 0, fontSize: 12, color: t.textMuted,
        fontFamily: "'DM Mono', monospace",
      }}>
        {v.file_path?.split('/').pop()}:{v.line_start}
        {item.previousLine !== undefined && (
          <span style={{ opacity: 0.7 }}> (was {item.previousLine})</span>
        )}
      </span>
    </div>
  )
}

export default function ComparePage() {
  const { scanId } = useParams<{ scanId: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const t = getTokens(isDark)
  const [pickedBaseId, setPickedBaseId] = useState<string>('')
  const [showUnchanged, setShowUnchanged] = useState(false)

  const { data: head, isLoading: loadingHead } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: () => scansApi.get(scanId!),
    enabled: Boolean(scanId),
  })

  const { data: list } = useQuery({ queryKey: ['scans'], queryFn: scansApi.list })

  // Análises concluídas do mesmo repositório, anteriores a esta, da mais recente para a mais antiga
  const candidates: ScanListItem[] = (list ?? [])
    .filter(s =>
      s.scan_id !== scanId &&
      s.status === 'completed' &&
      head !== undefined &&
      repoNameOf(s.repo_url).toLowerCase() === repoNameOf(head.repo_url).toLowerCase() &&
      new Date(s.created_at).getTime() <= new Date(head.created_at).getTime()
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const baseId = pickedBaseId || candidates[0]?.scan_id || ''

  const { data: base, isLoading: loadingBase } = useQuery({
    queryKey: ['scan', baseId],
    queryFn: () => scansApi.get(baseId),
    enabled: Boolean(baseId),
  })

  const comparison = base && head ? compareScans(base, head) : null
  const visible = comparison
    ? comparison.findings.filter(f => showUnchanged || f.status !== 'unchanged')
    : []

  if (loadingHead) return (
    <AppLayout>
      <div style={{ textAlign: 'center', padding: '80px 0', color: t.textMuted }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${t.border}`, borderTopColor: t.text, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ fontSize: 14 }}>Loading scans...</p>
      </div>
    </AppLayout>
  )

  if (!head) return (
    <AppLayout>
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ fontSize: 15, color: '#dc2626', marginBottom: 16 }}>Scan not found.</p>
        <button onClick={() => navigate('/dashboard')} style={{ fontSize: 14, color: t.text, background: 'none', border: `1.5px solid ${t.border}`, borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Back to dashboard
        </button>
      </div>
    </AppLayout>
  )

  const name = repoNameOf(head.repo_url)
  const [owner, repo] = name.split('/')

  return (
    <AppLayout>
      <button
        onClick={() => navigate(`/report/${scanId}`)}
        style={{ fontSize: 13, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 20 }}
        onMouseEnter={e => (e.currentTarget.style.color = t.text)}
        onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
      >
        ← Back to report
      </button>

      <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 4 }}>Scan comparison</p>
      <h1 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 300, letterSpacing: '-1px', color: t.text, lineHeight: 1.2, fontFamily: "'DM Mono', monospace", marginBottom: 24 }}>
        <span style={{ color: t.textSecondary }}>{owner}/</span>{repo}
      </h1>

      {candidates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 40px', border: `1px dashed ${t.border}`, borderRadius: 12 }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: t.text, marginBottom: 8 }}>No earlier scan to compare</p>
          <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 20 }}>
            Run this repository again to track how its security evolves.
          </p>
          <button onClick={() => navigate('/scan')} style={{ background: t.btnPrimary, color: t.btnPrimaryTxt, padding: '10px 22px', borderRadius: 6, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', border: 'none', cursor: 'pointer' }}>
            New scan →
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
            <label htmlFor="base-scan" style={{ fontSize: 13, color: t.textMuted }}>Compare against:</label>
            <select
              id="base-scan"
              value={baseId}
              onChange={e => setPickedBaseId(e.target.value)}
              style={{
                background: t.inputBg, color: t.text, border: `1.5px solid ${t.inputBorder}`,
                borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            >
              {candidates.map(s => (
                <option key={s.scan_id} value={s.scan_id}>
                  {formatDate(s.created_at)} — score {s.score ?? '—'} ({s.total_vulnerabilities} findings)
                </option>
              ))}
            </select>
          </div>

          {loadingBase || !comparison ? (
            <p style={{ fontSize: 14, color: t.textMuted, padding: '32px 0' }}>Comparing...</p>
          ) : (
            <>
              <ScoreShift before={comparison.scoreBefore} after={comparison.scoreAfter} t={t} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                <StatCard status="fixed" value={comparison.counts.fixed} t={t} />
                <StatCard status="new" value={comparison.counts.new} t={t} />
                <StatCard status="unchanged" value={comparison.counts.unchanged} t={t} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: t.textMuted }}>
                  {visible.length} finding{visible.length !== 1 ? 's' : ''} shown
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showUnchanged}
                    onChange={e => setShowUnchanged(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Show unchanged findings
                </label>
              </div>

              {visible.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 40px', border: `1px dashed ${t.border}`, borderRadius: 12 }}>
                  <p style={{ fontSize: 15, color: t.text, marginBottom: 6 }}>Nothing changed between these scans</p>
                  <p style={{ fontSize: 13, color: t.textSecondary }}>
                    {comparison.counts.unchanged} finding{comparison.counts.unchanged !== 1 ? 's' : ''} remained the same.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visible.map((item, i) => (
                    <FindingRow key={`${item.status}-${item.vuln.id}-${i}`} item={item} t={t} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </AppLayout>
  )
}
