import type { ScoredHealthPayload } from '@/types/health'

interface Props {
  scored: ScoredHealthPayload
}

const DIMENSION_ORDER: Array<keyof ScoredHealthPayload['dimensions']> = [
  'schema', 'automation', 'dataQuality', 'security', 'adoption'
]

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--warning)'
  return 'var(--danger)'
}

function riskLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Healthy', color: 'var(--success)' }
  if (score >= 65) return { label: 'Watch', color: 'var(--warning)' }
  if (score >= 50) return { label: 'Needs attention', color: 'var(--warning)' }
  return { label: 'Critical', color: 'var(--danger)' }
}

export function ScoreOverview({ scored }: Props) {
  const { overallScore, dimensions } = scored
  const risk = riskLabel(overallScore)

  // SVG ring params
  const r = 36
  const circ = 2 * Math.PI * r
  const filled = (overallScore / 100) * circ

  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Health score breakdown</span>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 500 }}>
          {risk.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

        {/* Ring */}
        <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0 }}>
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="8"/>
            <circle cx="44" cy="44" r={r} fill="none"
              stroke={scoreColor(overallScore)} strokeWidth="8"
              strokeDasharray={`${filled} ${circ}`}
              strokeDashoffset={circ / 4}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1 }}>{overallScore}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>/100</span>
          </div>
        </div>

        {/* Dimension bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {DIMENSION_ORDER.map(key => {
            const dim = dimensions[key]
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ width: '110px', color: 'var(--text-secondary)', flexShrink: 0 }}>{dim.label}</span>
                <div style={{ flex: 1, height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${dim.score}%`, background: scoreColor(dim.score), borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ width: '28px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 500 }}>{dim.score}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
