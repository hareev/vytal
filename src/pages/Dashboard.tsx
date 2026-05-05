import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVytalStore } from '@/hooks/useVytalStore'
import { useScan } from '@/hooks/useScan'
import { ScoreOverview } from '@/components/dashboard/ScoreOverview'
import { IssueList } from '@/components/dashboard/IssueList'
import { AIDiagnosisPanel } from '@/components/dashboard/AIDiagnosisPanel'
import { OrgSnapshot } from '@/components/dashboard/OrgSnapshot'

export function Dashboard() {
  const navigate = useNavigate()
  const { connection, healthData, diagnosis, isScanning, lastScanAt } = useVytalStore()
  const { scan, disconnect } = useScan()

  useEffect(() => {
    if (!connection) navigate('/connect')
  }, [connection, navigate])

  if (!connection || !healthData) return null

  function handleDisconnect() {
    disconnect()
    navigate('/connect')
  }

  const allIssues = Object.values(healthData.dimensions).flatMap(d => d.issues)
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', fontFamily: 'var(--font)' }}>

      {/* Top bar */}
      <div style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="var(--accent)"/>
            <circle cx="14" cy="14" r="7" stroke="white" strokeWidth="1.5"/>
            <path d="M14 10v4l2.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.02em' }}>Vytal</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            {connection.platform === 'dynamics365' ? 'Dynamics 365' : connection.platform} — {connection.orgName}
          </div>
          {lastScanAt && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Scanned {lastScanAt.toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => scan()} disabled={isScanning} style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            {isScanning ? 'Scanning…' : 'Re-scan'}
          </button>
          <button onClick={handleDisconnect} style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            Disconnect
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px', maxWidth: '1280px', margin: '0 auto' }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Overall health', value: `${healthData.overallScore}`, unit: '/100', warn: healthData.overallScore < 70 },
            { label: 'Critical issues', value: `${criticalCount}`, warn: criticalCount > 0 },
            { label: 'Total issues', value: `${allIssues.length}`, warn: allIssues.length > 10 },
            { label: 'Active flows', value: `${healthData.dimensions.automation.issues.length ? healthData.dimensions.automation.issues[0].affectedCount ?? '—' : '—'}`, warn: false },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{kpi.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: kpi.warn ? 'var(--danger-text)' : 'var(--text-primary)' }}>
                {kpi.value}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-tertiary)' }}>{kpi.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <ScoreOverview scored={healthData} />
          <AIDiagnosisPanel diagnosis={diagnosis} isLoading={!diagnosis} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
          <IssueList issues={allIssues} />
          <OrgSnapshot scored={healthData} />
        </div>
      </div>
    </div>
  )
}
