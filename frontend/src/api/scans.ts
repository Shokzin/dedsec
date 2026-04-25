import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScanListItem {
  scan_id: string
  repo_url: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  security_score: number | null
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
  /** List all scans (returns newest first) */
  list: async (): Promise<ScanListItem[]> => {
    const headers = await authHeaders()
    const res = await fetch(`${API}/api/v1/scans`, { headers })
    return handleResponse<ScanListItem[]>(res)
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