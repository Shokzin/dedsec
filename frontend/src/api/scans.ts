import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScanListItem {
  scan_id: string
  repo_url: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  score: number | null
  total_vulnerabilities: number
  created_at: string
}

export interface VulnerabilityItem {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  file_path: string
  line_start: number
  line_end: number
  code_snippet?: string
  recommendation: string
  cwe_id?: string
  owasp_category?: string
}

/** Uma página da lista de análises. */
export interface ScanListPage {
  items: ScanListItem[]
  total: number
  limit: number
  offset: number
}

/** Agregados de todas as análises, independentes da página exibida. */
export interface ScanStats {
  total_scans: number
  completed: number
  average_score: number | null
  total_vulnerabilities: number
}

export interface ScanReport extends ScanListItem {
  scanned_files: number
  scan_duration_seconds: number | null
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  error_message: string | null
  vulnerabilities: VulnerabilityItem[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── API ────────────────────────────────────────────────────────────────────────

export const scansApi = {
  /** Lista uma página de análises, da mais recente para a mais antiga. */
  list: async (params: { limit?: number; offset?: number; repoUrl?: string } = {}): Promise<ScanListPage> => {
    const headers = await authHeaders()
    const query = new URLSearchParams()
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.offset !== undefined) query.set('offset', String(params.offset))
    if (params.repoUrl) query.set('repo_url', params.repoUrl)
    const qs = query.toString()
    const res = await fetch(`${API}/api/v1/scans${qs ? `?${qs}` : ''}`, { headers })
    return handleResponse<ScanListPage>(res)
  },

  /** Números agregados de todas as análises do usuário. */
  stats: async (): Promise<ScanStats> => {
    const headers = await authHeaders()
    const res = await fetch(`${API}/api/v1/scans/stats`, { headers })
    return handleResponse<ScanStats>(res)
  },

  /** Get a single scan with full vulnerability details */
  get: async (scanId: string): Promise<ScanReport> => {
    const headers = await authHeaders()
    const res = await fetch(`${API}/api/v1/scans/${scanId}`, { headers })
    return handleResponse<ScanReport>(res)
  },

  /** Start a new scan */
  create: async (body: { repo_url: string }): Promise<{ scan_id: string }> => {
    const headers = await authHeaders()
    const res = await fetch(`${API}/api/v1/scans`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    return handleResponse<{ scan_id: string }>(res)
  },

  /** Delete a scan from history */
  deleteScan: async (scanId: string): Promise<void> => {
    const headers = await authHeaders()
    const res = await fetch(`${API}/api/v1/auth/scans/${scanId}`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail ?? `HTTP ${res.status}`)
    }
  },
}