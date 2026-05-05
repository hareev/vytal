import type { Issue, IssueSeverity } from '@/types/health'

interface Props {
  issues: Issue[]
}

const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

const SEVERITY_STYLE: Record<IssueSeverity, { bg: string; text: string; label: string }> = {
  critical: { bg: 'var(--danger-bg)', text: 'var(--danger-text)', label: 'Critical' },
  high:     { bg: 'var(--warning-bg)', text: 'var(--warning-text)', label: 'High' },
  medium:   { bg: 'var(--info-bg)', text: 'var(--info-text)', label: 'Medium' },
  low:      { bg: 'var(--bg-secondary)', text: 'var(--text-secondary)', label: 'Low' },
  info:     { bg: 'var(--bg-secondary)', text: 'var(--text-tertiary)', label: 'Info' },
}

export function IssueList({ issues }: Props) {
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  )

  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Issues</span>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{issues.length} total</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {sorted.slice(0, 8).map(issue => {
          const style = SEVERITY_STYLE[issue.severity]
          return (
            <div key={issue.id} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                <SeverityIcon severity={issue.severity} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>{issue.title}</span>
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: style.bg, color: style.text, fontWeight: 500, flexShrink: 0 }}>
                    {style.label}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{issue.description}</p>
                {issue.remediationHint && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                    Fix: {issue.remediationHint}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {issues.length > 8 && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px', marginBottom: 0 }}>
          +{issues.length - 8} more issues
        </p>
      )}
    </div>
  )
}

function SeverityIcon({ severity }: { severity: IssueSeverity }) {
  const colors: Record<IssueSeverity, string> = {
    critical: 'var(--danger-text)',
    high: 'var(--warning-text)',
    medium: 'var(--info-text)',
    low: 'var(--text-tertiary)',
    info: 'var(--text-tertiary)',
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={colors[severity]} strokeWidth="1.5">
      {severity === 'critical' && <><path d="M8 2L14 13H2L8 2Z"/><path d="M8 6v3M8 10.5v.5"/></>}
      {severity === 'high' && <><circle cx="8" cy="8" r="5"/><path d="M8 5v3M8 9.5v.5"/></>}
      {(severity === 'medium' || severity === 'low' || severity === 'info') && <><circle cx="8" cy="8" r="5"/><path d="M8 7v4M8 5.5v.5"/></>}
    </svg>
  )
}
