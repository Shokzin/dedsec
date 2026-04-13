import apiClient from './client'

export interface VulnerabilityItem {
  id: string
  type: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  file_path: string
  line_start: number
  line_end: number
  code_snippet: string
  recommendation: string
  cwe_id: string | null
  owasp_category: string | null
}

export interface ScanReport {
  scan_id: string
  repo_url: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  security_score: number | null
  total_vulnerabilities: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  vulnerabilities: VulnerabilityItem[]
  scanned_files: number
  scan_duration_seconds: number | null
  created_at: string
  completed_at: string | null
  error_message: string | null
}

export interface ScanListItem {
  scan_id: string
  repo_url: string
  status: string
  security_score: number | null
  total_vulnerabilities: number
  created_at: string
}

export const scansApi = {
  create: async (request: { repo_url: string }) => {
    const { data } = await apiClient.post('/api/v1/scans', request)
    return data
  },
  list: async (): Promise<ScanListItem[]> => {
    const { data } = await apiClient.get('/api/v1/scans')
    return data
  },
  get: async (scanId: string): Promise<ScanReport> => {
    const { data } = await apiClient.get(`/api/v1/scans/${scanId}`)
    return data
  },
}