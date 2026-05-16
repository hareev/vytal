import type { ReactNode } from 'react'
import type { AIDiagnosis, ScoredHealthPayload } from '@/types/health'

// ─── AI Diagnosis Panel ───────────────────────────────────────────────────────

interface DiagProps {
  diagnosis: AIDiagnosis | null
  isLoading: boolean
}

export function AIDiagnosisPanel({ diagnosis, isLoading }: DiagProps) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>AI diagnosis</span>
        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'var(--accent-bg)', color: 'var(--accent-text)', fontWeight: 500 }}>Claude</span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[80, 100, 65].map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '10px', background: 'var(--border)', borderRadius: '4px', width: `${w}%`, marginBottom: '5px' }} />
                <div style={{ height: '9px', background: 'var(--border)', borderRadius: '4px', width: '60%' }} />
              </div>
            </div>
          ))}
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', textAlign: 'center' }}>Generating AI diagnosis…</p>
        </div>
      ) : diagnosis ? (
        <>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
            {diagnosis.summary}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {diagnosis.recommendations.slice(0, 4).map(rec => (
              <div key={rec.rank} style={{ display: 'flex', gap: '10px', padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent-text)', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  {rec.rank}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '2px' }}>{rec.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{rec.rationale}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
                    <EffortBadge label="effort" value={rec.effort} />
                    <EffortBadge label="impact" value={rec.impact} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No diagnosis available. Run a scan to generate AI recommendations.</p>
      )}
    </div>
  )
}

function EffortBadge({ label, value }: { label: string; value: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    high: { bg: 'var(--danger-bg)', text: 'var(--danger-text)' },
    medium: { bg: 'var(--warning-bg)', text: 'var(--warning-text)' },
    low: { bg: 'var(--success-bg)', text: 'var(--success-text)' },
  }
  const c = colors[value] ?? { bg: 'var(--bg-secondary)', text: 'var(--text-tertiary)' }
  return (
    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: c.bg, color: c.text }}>
      {label}: {value}
    </span>
  )
}

// ─── Org Snapshot Panel ───────────────────────────────────────────────────────

interface SnapProps {
  scored: ScoredHealthPayload
}

export function OrgSnapshot({ scored }: SnapProps) {
  const { dimensions } = scored
  const totalFlowIssues = dimensions.automation.issues.length
  const schemaIssues = dimensions.schema.issues

  const schemaStats = [
    { label: 'Custom entities', value: 0, warn: false },
    { label: 'Unused entities', value: schemaIssues.find(i => i.title.includes('unused'))?.affectedCount ?? 0, warn: true },
    { label: 'Deprecated objects', value: schemaIssues.find(i => i.title.includes('deprecated'))?.affectedCount ?? 0, warn: true },
  ]

  const autoStats = [
    { label: 'Flow issues', value: totalFlowIssues, warn: totalFlowIssues > 0 },
    { label: 'Circular deps', value: dimensions.automation.issues.filter(i => i.title.includes('circular')).length, warn: true },
  ]

  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
      <span style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '14px' }}>Org snapshot</span>

      <Section title="Schema">
        {schemaStats.map(s => <StatRow key={s.label} {...s} />)}
      </Section>

      <Section title="Automation">
        {autoStats.map(s => <StatRow key={s.label} {...s} />)}
      </Section>

      <Section title="Security">
        <StatRow label="Dormant admins" value={dimensions.security.issues.find(i => i.title.includes('dormant'))?.affectedCount ?? 0} warn />
        <StatRow label="Audit logging" value={dimensions.security.issues.find(i => i.title.includes('Audit')) ? 'Off' : 'On'} warn={!!dimensions.security.issues.find(i => i.title.includes('Audit'))} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{title}</div>
      {children}
    </div>
  )
}

function StatRow({ label, value, warn }: { label: string; value: number | string; warn: boolean }) {
  const isZero = value === 0 || value === 'On'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: warn && !isZero ? 'var(--danger-text)' : 'var(--text-primary)' }}>{String(value)}</span>
    </div>
  )
}
