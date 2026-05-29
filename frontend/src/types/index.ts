export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: 'text-red-400 border-red-400 bg-red-400/10',
  high: 'text-orange-400 border-orange-400 bg-orange-400/10',
  medium: 'text-yellow-400 border-yellow-400 bg-yellow-400/10',
  low: 'text-blue-400 border-blue-400 bg-blue-400/10',
}