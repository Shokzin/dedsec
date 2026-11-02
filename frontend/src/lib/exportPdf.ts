import { jsPDF } from 'jspdf'
import autoTable, { type CellHookData } from 'jspdf-autotable'
import type { ScanReport, VulnerabilityItem } from '../api/scans'

type Severity = 'critical' | 'high' | 'medium' | 'low'
type RGB = [number, number, number]

const SEV_COLOR: Record<Severity, RGB> = {
  critical: [220, 38, 38],
  high: [234, 88, 12],
  medium: [202, 138, 4],
  low: [37, 99, 235],
}
const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const INK: RGB = [24, 24, 27]
const MUTED: RGB = [113, 113, 122]
const LINE: RGB = [228, 228, 231]
const TINT: RGB = [248, 248, 249]
const DARK: RGB = [10, 10, 10]
const WHITE: RGB = [255, 255, 255]

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 16
const TOP = 20
const BOTTOM = 18
const CONTENT_W = PAGE_W - MARGIN * 2
const MAX_SNIPPET_LINES = 10
const MAX_TEXT_LINES = 40
const PT = 0.3528 // 1 pt em mm

function lineHeight(size: number): number {
  return size * PT * 1.3
}

/**
 * As fontes embutidas do PDF só cobrem Latin-1. Qualquer outro caractere
 * (setas, emoji, aspas curvas...) viraria quadrado preto, então trocamos por
 * equivalentes em ASCII ou por "?".
 */
function safe(input: unknown): string {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2026/g, '...')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/gu, '?')
}

function normalizeSeverity(value: string): Severity {
  return value in SEV_COLOR ? (value as Severity) : 'low'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function scoreInfo(score: number): { label: string; color: RGB } {
  if (score >= 80) return { label: 'Secure', color: [34, 197, 94] }
  if (score >= 60) return { label: 'Moderate', color: [245, 158, 11] }
  if (score >= 40) return { label: 'Vulnerable', color: [249, 115, 22] }
  return { label: 'Critical', color: [239, 68, 68] }
}

function repoNameOf(report: ScanReport): string {
  return report.repo_url
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
}

export function reportFileName(report: ScanReport): string {
  const name = repoNameOf(report).replace(/[^a-z0-9._-]+/gi, '-')
  return `dedsec-report-${name}-${new Date().toISOString().slice(0, 10)}.pdf`
}

function sortVulns(list: VulnerabilityItem[]): VulnerabilityItem[] {
  return [...list].sort((a, b) =>
    SEV_ORDER[normalizeSeverity(a.severity)] - SEV_ORDER[normalizeSeverity(b.severity)] ||
    a.file_path.localeCompare(b.file_path) ||
    a.line_start - b.line_start
  )
}

/** Monta o PDF em memória (sem salvar), para poder ser testado fora do navegador. */
export function buildReportPdf(report: ScanReport): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const repoName = safe(repoNameOf(report))
  const vulns = sortVulns(report.vulnerabilities ?? [])
  let y = 0

  doc.setProperties({
    title: `DedSec Security Scan Report - ${repoName}`,
    subject: 'Security scan report',
    creator: 'DedSec',
  })

  // ── helpers ────────────────────────────────────────────────────────────────
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const font = (name: 'helvetica' | 'courier', style: 'normal' | 'bold' | 'italic', size: number) => {
    doc.setFont(name, style)
    doc.setFontSize(size)
  }
  const wrap = (text: string, width: number, maxLines = MAX_TEXT_LINES): string[] => {
    const lines = doc.splitTextToSize(text, width) as string[]
    if (lines.length <= maxLines) return lines
    return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, 90)}...`]
  }
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - BOTTOM) {
      doc.addPage()
      y = TOP
    }
  }
  const sectionTitle = (text: string) => {
    ensureSpace(16)
    font('helvetica', 'bold', 12)
    setText(INK)
    doc.text(text, MARGIN, y)
    setStroke(LINE)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, y + 2.5, PAGE_W - MARGIN, y + 2.5)
    y += 9
  }

  // ── cabeçalho ──────────────────────────────────────────────────────────────
  setFill(DARK)
  doc.rect(0, 0, PAGE_W, 24, 'F')
  setText(WHITE)
  font('helvetica', 'bold', 17)
  doc.text('DedSec', MARGIN, 15)
  font('helvetica', 'normal', 10)
  doc.text('Security Scan Report', PAGE_W - MARGIN, 15, { align: 'right' })

  // ── repositório ────────────────────────────────────────────────────────────
  y = 37
  font('helvetica', 'normal', 8)
  setText(MUTED)
  doc.text('REPOSITORY', MARGIN, y)
  y += 8
  font('helvetica', 'bold', 19)
  setText(INK)
  const titleLines = wrap(repoName, CONTENT_W, 2)
  doc.text(titleLines, MARGIN, y)
  y += titleLines.length * 8
  font('helvetica', 'normal', 9)
  setText(MUTED)
  doc.text(wrap(safe(report.repo_url), CONTENT_W, 1), MARGIN, y)
  y += 11

  // grade de metadados (3 colunas x 2 linhas)
  const meta: Array<[string, string]> = [
    ['SCAN DATE', formatDate(report.created_at)],
    ['FILES SCANNED', String(report.scanned_files ?? '-')],
    ['DURATION', report.scan_duration_seconds != null ? `${report.scan_duration_seconds.toFixed(1)}s` : '-'],
    ['REPORT GENERATED', formatDate(new Date().toISOString())],
    ['SCAN ID', safe(report.scan_id).slice(0, 8)],
    ['STATUS', safe(report.status).replace(/^./, c => c.toUpperCase())],
  ]
  const colW = CONTENT_W / 3
  meta.forEach(([label, value], i) => {
    const x = MARGIN + (i % 3) * colW
    const rowY = y + Math.floor(i / 3) * 13
    font('helvetica', 'normal', 7.5)
    setText(MUTED)
    doc.text(label, x, rowY)
    font('helvetica', 'bold', 10)
    setText(INK)
    doc.text(wrap(value, colW - 4, 1), x, rowY + 5.5)
  })
  y += 13 * 2 + 4

  // ── nota de segurança ─────────────────────────────────────────────────────
  if (report.score != null) {
    const { label, color } = scoreInfo(report.score)
    setStroke(LINE)
    setFill(TINT)
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, 'FD')
    font('helvetica', 'normal', 7.5)
    setText(MUTED)
    doc.text('SECURITY SCORE', MARGIN + 6, y + 8)
    font('helvetica', 'bold', 26)
    setText(color)
    doc.text(String(report.score), MARGIN + 6, y + 21)
    const numW = doc.getTextWidth(String(report.score))
    font('helvetica', 'normal', 10)
    setText(MUTED)
    doc.text('/100', MARGIN + 8 + numW, y + 21)
    font('helvetica', 'bold', 11)
    setText(color)
    doc.text(label, PAGE_W - MARGIN - 6, y + 11, { align: 'right' })
    const barX = MARGIN + 62
    const barW = CONTENT_W - 62 - 6
    setFill(LINE)
    doc.roundedRect(barX, y + 15, barW, 4, 2, 2, 'F')
    setFill(color)
    doc.roundedRect(barX, y + 15, Math.max(4, (barW * Math.min(100, Math.max(0, report.score))) / 100), 4, 2, 2, 'F')
    y += 28 + 8
  }

  // ── contagem por severidade ───────────────────────────────────────────────
  const boxes: Array<{ label: string; value: number; color: RGB }> = [
    { label: 'TOTAL', value: report.total_vulnerabilities ?? vulns.length, color: INK },
    { label: 'CRITICAL', value: report.critical_count ?? 0, color: SEV_COLOR.critical },
    { label: 'HIGH', value: report.high_count ?? 0, color: SEV_COLOR.high },
    { label: 'MEDIUM', value: report.medium_count ?? 0, color: SEV_COLOR.medium },
    { label: 'LOW', value: report.low_count ?? 0, color: SEV_COLOR.low },
  ]
  const gap = 3
  const boxW = (CONTENT_W - gap * 4) / 5
  boxes.forEach((b, i) => {
    const x = MARGIN + i * (boxW + gap)
    setStroke(LINE)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, boxW, 20, 2, 2, 'S')
    font('helvetica', 'normal', 7)
    setText(MUTED)
    doc.text(b.label, x + 4, y + 7)
    font('helvetica', 'bold', 17)
    setText(b.color)
    doc.text(String(b.value), x + 4, y + 16)
  })
  y += 20 + 12

  // ── sem achados ───────────────────────────────────────────────────────────
  if (vulns.length === 0) {
    setStroke(LINE)
    doc.setLineDashPattern([1.5, 1.5], 0)
    doc.roundedRect(MARGIN, y, CONTENT_W, 34, 3, 3, 'S')
    doc.setLineDashPattern([], 0)
    font('helvetica', 'bold', 13)
    setText(INK)
    doc.text('No vulnerabilities found', PAGE_W / 2, y + 15, { align: 'center' })
    font('helvetica', 'normal', 10)
    setText(MUTED)
    doc.text('This repository looks clean across both analysis layers.', PAGE_W / 2, y + 23, { align: 'center' })
    y += 34
  } else {
    // ── tabela-resumo ───────────────────────────────────────────────────────
    sectionTitle('Findings overview')
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
      head: [['#', 'Severity', 'Finding', 'Location', 'CWE']],
      body: vulns.map((v, i) => [
        String(i + 1),
        normalizeSeverity(v.severity).toUpperCase(),
        safe(v.title),
        `${safe(v.file_path)}:${v.line_start}`,
        safe(v.cwe_id ?? '-'),
      ]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: INK, overflow: 'linebreak', lineColor: LINE, lineWidth: { bottom: 0.2 } },
      headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
      columnStyles: {
        0: { cellWidth: 9, textColor: MUTED },
        1: { cellWidth: 19, fontStyle: 'bold' },
        3: { cellWidth: 58, font: 'courier', fontSize: 7.5 },
        4: { cellWidth: 20, fontSize: 8 },
      },
      didParseCell: (data: CellHookData) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = SEV_COLOR[normalizeSeverity(String(data.cell.raw).toLowerCase())]
        }
      },
    })
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 12

    // ── detalhes ────────────────────────────────────────────────────────────
    ensureSpace(70)
    sectionTitle('Finding details')

    vulns.forEach((v, i) => {
      const sev = normalizeSeverity(v.severity)
      const color = SEV_COLOR[sev]

      // medição
      font('helvetica', 'bold', 11)
      const titleL = wrap(`${i + 1}. ${safe(v.title)}`, CONTENT_W - 25, 4)
      font('courier', 'normal', 8.5)
      const lineRange = v.line_end > v.line_start ? `${v.line_start}-${v.line_end}` : `${v.line_start}`
      const locL = wrap(`${safe(v.file_path)}  |  line ${lineRange}`, CONTENT_W, 4)
      font('helvetica', 'normal', 8.5)
      const tags = [v.cwe_id, v.owasp_category].filter(Boolean).map(safe).join('   |   ')
      const tagsL = tags ? wrap(tags, CONTENT_W, 3) : []
      font('helvetica', 'normal', 9.5)
      const descText = safe(v.description).trim()
      const recText = safe(v.recommendation).trim()
      const descL = descText ? wrap(descText, CONTENT_W) : []
      const recL = recText ? wrap(recText, CONTENT_W - 8) : []

      font('courier', 'normal', 7.8)
      let snippetL: string[] = []
      if (v.code_snippet) {
        const raw = safe(v.code_snippet).replace(/\s+$/, '').split('\n')
        const wrapped = raw.flatMap(l => doc.splitTextToSize(l === '' ? ' ' : l, CONTENT_W - 8) as string[])
        snippetL = wrapped.length > MAX_SNIPPET_LINES
          ? [...wrapped.slice(0, MAX_SNIPPET_LINES), '...']
          : wrapped
      }

      const h =
        titleL.length * lineHeight(11) + 3 +
        locL.length * lineHeight(8.5) + 1.5 +
        (tagsL.length ? tagsL.length * lineHeight(8.5) + 1.5 : 0) +
        descL.length * lineHeight(9.5) + 4 +
        (snippetL.length ? snippetL.length * lineHeight(7.8) + 7 : 0) +
        (recL.length ? recL.length * lineHeight(9.5) + 6 : 0) + 8
      ensureSpace(Math.min(h, PAGE_H - TOP - BOTTOM))

      // título com selo de severidade
      setFill(color)
      doc.roundedRect(MARGIN, y - 4.2, 20, 5.8, 1.2, 1.2, 'F')
      font('helvetica', 'bold', 7)
      setText(WHITE)
      doc.text(sev.toUpperCase(), MARGIN + 10, y - 0.3, { align: 'center' })
      font('helvetica', 'bold', 11)
      setText(INK)
      titleL.forEach(l => { doc.text(l, MARGIN + 24, y); y += lineHeight(11) })
      y += 1.5

      // localização
      font('courier', 'normal', 8.5)
      setText(MUTED)
      locL.forEach(l => { doc.text(l, MARGIN, y); y += lineHeight(8.5) })
      if (tagsL.length) {
        font('helvetica', 'normal', 8.5)
        tagsL.forEach(l => { doc.text(l, MARGIN, y); y += lineHeight(8.5) })
      }
      y += 2.5

      // descrição
      font('helvetica', 'normal', 9.5)
      setText(INK)
      descL.forEach(l => { doc.text(l, MARGIN, y); y += lineHeight(9.5) })
      y += 3

      // código
      if (snippetL.length) {
        const boxH = snippetL.length * lineHeight(7.8) + 5
        setFill(TINT)
        setStroke(LINE)
        doc.setLineWidth(0.25)
        doc.roundedRect(MARGIN, y - 1, CONTENT_W, boxH, 1.5, 1.5, 'FD')
        font('courier', 'normal', 7.8)
        setText(INK)
        let ty = y + 2.8
        snippetL.forEach(l => { doc.text(l, MARGIN + 4, ty); ty += lineHeight(7.8) })
        y += boxH + 4
      }

      // recomendação
      if (recL.length) {
        font('helvetica', 'bold', 7.5)
        setText(MUTED)
        doc.text('RECOMMENDATION', MARGIN + 5, y)
        y += lineHeight(7.5) + 0.8
        font('helvetica', 'normal', 9.5)
        setText(INK)
        const recStart = y
        recL.forEach(l => { doc.text(l, MARGIN + 5, y); y += lineHeight(9.5) })
        setFill(color)
        doc.rect(MARGIN, recStart - 5.4, 1.2, y - recStart + 2.5, 'F')
        y += 4
      }

      // separador
      setStroke(LINE)
      doc.setLineWidth(0.25)
      if (i < vulns.length - 1) doc.line(MARGIN, y, PAGE_W - MARGIN, y)
      y += 8
    })

    // aviso final
    ensureSpace(18)
    font('helvetica', 'italic', 8)
    setText(MUTED)
    wrap(
      'This report was generated automatically by DedSec using pattern matching and AST analysis. ' +
      'Automated tools can report false positives: review each finding before acting on it.',
      CONTENT_W, 3,
    ).forEach(l => { doc.text(l, MARGIN, y); y += lineHeight(8) })
  }

  // ── rodapé em todas as páginas ────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    setStroke(LINE)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12)
    font('helvetica', 'normal', 8)
    setText(MUTED)
    doc.text(wrap(`DedSec Security Scan Report - ${repoName}`, 130, 1), MARGIN, PAGE_H - 7)
    doc.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' })
  }

  return doc
}

export function exportReportPdf(report: ScanReport): void {
  buildReportPdf(report).save(reportFileName(report))
}
