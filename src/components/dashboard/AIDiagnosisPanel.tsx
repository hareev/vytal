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
  const { raw } = scored
  const audit = raw.security.auditLogEnabled

  const schemaStats = [
    { label: 'Total entities', value: shown(raw.schema.totalEntities), warn: false },
    { label: 'Custom entities', value: shown(raw.schema.customEntities), warn: false },
    { label: 'Unused entities', value: shown(raw.schema.unusedEntities), warn: true },
    { label: 'Deprecated objects', value: shown(raw.schema.deprecatedObjects), warn: true },
  ]

  const autoStats = [
    { label: 'Active flows', value: shown(raw.automation.activeFlows), warn: false },
    { label: 'Inactive flows', value: shown(raw.automation.inactiveFlows), warn: true },
    { label: 'Circular deps', value: shown(raw.automation.circularDependencies), warn: true },
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
        <StatRow label="Admin users" value={shown(raw.security.adminUsers)} warn={false} />
        <StatRow label="Dormant admins" value={shown(raw.security.dormantAdmins)} warn />
        <StatRow label="Audit logging" value={audit === null ? NOT_MEASURED : audit ? 'On' : 'Off'} warn={audit === false} />
      </Section>
    </div>
  )
}

const NOT_MEASURED = 'Not measured'

function shown(value: number | null): number | string {
  return value === null ? NOT_MEASURED : value
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
  const unmeasured = value === NOT_MEASURED
  const color = unmeasured ? 'var(--text-tertiary)' : warn && !isZero ? 'var(--danger-text)' : 'var(--text-primary)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: unmeasured ? 400 : 500, color }}>{String(value)}</span>
    </div>
  )
}
