import type { AIDiagnosis, ScoredHealthPayload } from '@/types/health'
import { buildHealthReportHtml, buildHealthReportJson, reportFileName } from '@/lib/report/healthReport'

interface Props {
  scored: ScoredHealthPayload
  diagnosis: AIDiagnosis | null
}

const buttonStyle = {
  fontSize: '12px',
  padding: '5px 10px',
  borderRadius: '8px',
  border: '0.5px solid var(--border)',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
} as const

/**
 * Exports the current scan as a client-ready report:
 * - "Export report" downloads a self-contained HTML file (open it and print to PDF),
 * - "Evidence (JSON)" downloads the measured values behind every score.
 * Both are built in the browser from the scan already on screen; nothing is uploaded.
 */
export function ExportReportButtons({ scored, diagnosis }: Props) {
  function exportHtml() {
    download(buildHealthReportHtml(scored, diagnosis), reportFileName(scored, 'html'), 'text/html;charset=utf-8')
  }

  function exportJson() {
    download(buildHealthReportJson(scored, diagnosis), reportFileName(scored, 'json'), 'application/json')
  }

  return (
    <>
      <button
        onClick={exportHtml}
        title={diagnosis ? 'Download a client-ready report. Open it and print to PDF to share.' : 'Download a client-ready report (the AI assessment is not ready yet and will be left out).'}
        style={buttonStyle}
      >
        Export report
      </button>
      <button onClick={exportJson} title="Download the measured values behind every score" style={buttonStyle}>
        Evidence (JSON)
      </button>
    </>
  )
}

function download(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
