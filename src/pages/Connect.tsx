import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScan } from '@/hooks/useScan'
import { ADAPTER_MANIFESTS } from '@/lib/adapters'
import type { OrgConnection } from '@/types/health'

const PLATFORMS: Array<{ platform: OrgConnection['platform']; label: string; available: boolean }> = [
  { platform: 'dynamics365', label: 'Dynamics 365 / Dataverse', available: true },
  { platform: 'salesforce', label: 'Salesforce', available: false },
  { platform: 'siebel', label: 'Oracle Siebel', available: false },
  { platform: 'hubspot', label: 'HubSpot', available: false },
]

export function Connect() {
  const navigate = useNavigate()
  const { connect, scan, isConnecting, connectionError } = useScan()

  const [selectedPlatform, setSelectedPlatform] = useState<OrgConnection['platform'] | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})

  const manifest = selectedPlatform ? ADAPTER_MANIFESTS[selectedPlatform] : null

  async function handleConnect() {
    if (!selectedPlatform) return
    try {
      await connect(selectedPlatform, credentials)
      await scan()
      navigate('/dashboard')
    } catch {
      // error shown via store
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-page)' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="8" fill="var(--accent)"/>
              <circle cx="14" cy="14" r="7" stroke="white" strokeWidth="1.5"/>
              <path d="M14 10v4l2.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>Vytal</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Connect your CRM org and get a live health diagnosis
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>

          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Select platform
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
            {PLATFORMS.map(p => (
              <button
                key={p.platform}
                disabled={!p.available}
                onClick={() => { setSelectedPlatform(p.platform); setCredentials({}) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: '10px', border: '0.5px solid',
                  borderColor: selectedPlatform === p.platform ? 'var(--accent)' : 'var(--border)',
                  background: selectedPlatform === p.platform ? 'var(--accent-bg)' : 'transparent',
                  cursor: p.available ? 'pointer' : 'not-allowed',
                  opacity: p.available ? 1 : 0.45,
                  fontSize: '14px', fontWeight: 500,
                  color: selectedPlatform === p.platform ? 'var(--accent-text)' : 'var(--text-primary)',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                }}
              >
                {p.label}
                {!p.available && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>Coming soon</span>}
              </button>
            ))}
          </div>

          {manifest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{ height: '0.5px', background: 'var(--border)', margin: '0 0 4px' }} />
              {manifest.credentialFields.map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    {field.label}{field.required && ' *'}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={credentials[field.key] ?? ''}
                    onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                  {field.helpText && <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-tertiary)' }}>{field.helpText}</p>}
                </div>
              ))}
            </div>
          )}

          {connectionError && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--danger-bg)', border: '0.5px solid var(--danger-border)', marginBottom: '1rem', fontSize: '13px', color: 'var(--danger-text)' }}>
              {connectionError}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={!selectedPlatform || isConnecting}
            style={{
              width: '100%', padding: '10px', borderRadius: '10px',
              background: selectedPlatform ? 'var(--accent)' : 'var(--border)',
              border: 'none', cursor: selectedPlatform && !isConnecting ? 'pointer' : 'not-allowed',
              fontSize: '14px', fontWeight: 500, color: selectedPlatform ? '#fff' : 'var(--text-tertiary)',
              transition: 'opacity 0.15s',
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {isConnecting ? 'Connecting & scanning...' : 'Connect and scan'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '12px', marginBottom: 0 }}>
            Credentials stay in your browser session — never sent to any server except the CRM itself.
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1.5rem' }}>
          <a href="https://github.com/hareev/vytal" style={{ color: 'var(--text-secondary)' }}>github.com/hareev/vytal</a>
          {' · '}Open source · MIT
        </p>
      </div>
    </div>
  )
}
