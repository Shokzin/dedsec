import type { ScanReport, VulnerabilityItem } from '../api/scans'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type ChangeStatus = 'new' | 'fixed' | 'unchanged'

export interface ChangedFinding {
  status: ChangeStatus
  /** Versão exibida: a do scan mais recente para new/unchanged, a do anterior para fixed. */
  vuln: VulnerabilityItem
  /** Só para "unchanged": linha no scan anterior, quando o achado mudou de lugar. */
  previousLine?: number
}

export type SeverityCounts = Record<Severity, number> & { total: number }

export interface ScanComparison {
  /** Ordem: new, fixed, unchanged; dentro de cada grupo, por severidade, arquivo e linha. */
  findings: ChangedFinding[]
  counts: Record<ChangeStatus, number>
  before: SeverityCounts
  after: SeverityCounts
  scoreBefore: number | null
  scoreAfter: number | null
  scoreDelta: number | null
  sameRepo: boolean
  verdict: 'improved' | 'regressed' | 'mixed' | 'unchanged'
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const STATUS_ORDER: Record<ChangeStatus, number> = { new: 0, fixed: 1, unchanged: 2 }

export function normalizeSeverity(value: string): Severity {
  return (SEVERITIES as string[]).includes(value) ? (value as Severity) : 'low'
}

export function countBySeverity(list: VulnerabilityItem[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, total: list.length }
  for (const v of list) counts[normalizeSeverity(v.severity)] += 1
  return counts
}

/** Remove barras finais antes do sufixo .git — a ordem importa para "...\/repo.git\/". */
function normalizeRepo(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '')
}

// Linhas mudam sempre que o arquivo é editado, então a identidade de um achado é
// "mesmo arquivo + mesmo problema" (título), nunca o número da linha.
function keyOf(v: VulnerabilityItem): string {
  return `${v.file_path}\u0000${v.title}`
}

function groupByKey(list: VulnerabilityItem[]): Map<string, VulnerabilityItem[]> {
  const map = new Map<string, VulnerabilityItem[]>()
  for (const v of list) {
    const key = keyOf(v)
    const group = map.get(key)
    if (group) group.push(v)
    else map.set(key, [v])
  }
  for (const group of map.values()) group.sort((a, b) => a.line_start - b.line_start)
  return map
}

function byImportance(a: ChangedFinding, b: ChangedFinding): number {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    SEV_ORDER[normalizeSeverity(a.vuln.severity)] - SEV_ORDER[normalizeSeverity(b.vuln.severity)] ||
    a.vuln.file_path.localeCompare(b.vuln.file_path) ||
    a.vuln.line_start - b.vuln.line_start
  )
}

/**
 * Compara duas análises. `base` é a anterior e `head` a mais recente.
 * Mesmo arquivo + mesmo título = mesmo achado. Quando o mesmo achado aparece N vezes
 * numa análise e M na outra, os min(N, M) primeiros (por linha) são "unchanged";
 * a sobra da mais recente é "new" e a sobra da anterior é "fixed".
 */
export function compareScans(base: ScanReport, head: ScanReport): ScanComparison {
  const baseGroups = groupByKey(base.vulnerabilities ?? [])
  const headGroups = groupByKey(head.vulnerabilities ?? [])
  const findings: ChangedFinding[] = []

  for (const [key, headList] of headGroups) {
    const baseList = baseGroups.get(key) ?? []
    headList.forEach((vuln, i) => {
      const previous = baseList[i]
      if (!previous) {
        findings.push({ status: 'new', vuln })
      } else {
        findings.push({
          status: 'unchanged',
          vuln,
          previousLine: previous.line_start !== vuln.line_start ? previous.line_start : undefined,
        })
      }
    })
  }
  for (const [key, baseList] of baseGroups) {
    const headCount = headGroups.get(key)?.length ?? 0
    for (const vuln of baseList.slice(headCount)) findings.push({ status: 'fixed', vuln })
  }
  findings.sort(byImportance)

  const counts: Record<ChangeStatus, number> = { new: 0, fixed: 0, unchanged: 0 }
  for (const f of findings) counts[f.status] += 1

  const scoreBefore = base.score ?? null
  const scoreAfter = head.score ?? null

  let verdict: ScanComparison['verdict'] = 'unchanged'
  if (counts.new > 0 && counts.fixed > 0) verdict = 'mixed'
  else if (counts.fixed > 0) verdict = 'improved'
  else if (counts.new > 0) verdict = 'regressed'

  return {
    findings,
    counts,
    before: countBySeverity(base.vulnerabilities ?? []),
    after: countBySeverity(head.vulnerabilities ?? []),
    scoreBefore,
    scoreAfter,
    scoreDelta: scoreBefore !== null && scoreAfter !== null ? scoreAfter - scoreBefore : null,
    sameRepo: normalizeRepo(base.repo_url) === normalizeRepo(head.repo_url),
    verdict,
  }
}
