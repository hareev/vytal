import { useState, useEffect } from 'react'
import type { Integration, IntegrationProvider } from '@/types/integrations'
import { api } from '@/lib/api/client'

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const PROVIDER_META: Record<IntegrationProvider, {
  label: string
  description: string
  icon: string
  iconColor: string
  features: string[]
}> = {
  gmail: {
    label: 'Gmail',
    description: 'Auto-capture inbound emails as Channel Captures. Claude analyzes each message for contacts, deal signals, and action items.',
    icon: 'G',
    iconColor: '#EA4335',
    features: ['Email capture', 'AI extraction', 'Lead routing'],
  },
  outlook: {
    label: 'Outlook',
    description: 'Sync Microsoft Outlook emails into Channel Capture for automatic CRM enrichment.',
    icon: 'O',
    iconColor: '#0078D4',
    features: ['Email capture', 'AI extraction', 'Lead routing'],
  },
  slack: {
    label: 'Slack',
    description: 'Capture Slack messages and threads. Surface support requests and sales signals automatically.',
    icon: 'S',
    iconColor: '#4A154B',
    features: ['Message capture', 'AI analysis', 'Support routing'],
  },
  teams: {
    label: 'Microsoft Teams',
    description: 'Capture Teams chats and channel messages for automatic CRM context.',
    icon: 'T',
    iconColor: '#5B5EA6',
    features: ['Message capture', 'AI analysis', 'Support routing'],
  },
}

const ALL_PROVIDERS: IntegrationProvider[] = ['gmail', 'outlook', 'slack', 'teams']

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'Never'
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<IntegrationProvider | null>(null)
  const [syncing, setSyncing] = useState<IntegrationProvider | null>(null)

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const justConnected = urlParams?.get('connected') as IntegrationProvider | null
  const oauthError = urlParams?.get('error')

  useEffect(() => {
    if (USE_MOCK) {
      setIsLoading(false)
      return
    }
    api.integrations.list()
      .then(setIntegrations)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  async function handleDisconnect(provider: IntegrationProvider) {
    setDisconnecting(provider)
    try {
      await api.integrations.disconnect(provider)
      setIntegrations(prev => prev.filter(i => i.provider !== provider))
    } finally {
      setDisconnecting(null)
    }
  }

  async function handleSync(provider: IntegrationProvider) {
    setSyncing(provider)
    try {
      await api.integrations.sync(provider)
      const updated = await api.integrations.list()
      setIntegrations(updated)
    } finally {
      setSyncing(null)
    }
  }

  const connectedCount = integrations.filter(i => i.status === 'active').length

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Integrations</h1>
          {connectedCount > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 8px',
              borderRadius: '20px', background: 'var(--accent-bg)',
              color: 'var(--accent)', border: '0.5px solid var(--accent)',
            }}>
              {connectedCount} active
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Connect email and chat providers. Incoming messages are automatically captured, analyzed by Claude, and surfaced in Channel Capture.
        </p>
      </div>

      {/* Post-OAuth feedback banners */}
      {justConnected && PROVIDER_META[justConnected] && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: 'var(--success-bg)', border: '0.5px solid var(--success-text)',
          fontSize: '13px', color: 'var(--success-text)', fontWeight: 500,
        }}>
          {PROVIDER_META[justConnected].label} connected successfully. Incoming messages will now flow into Channel Capture.
        </div>
      )}
      {oauthError && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: 'var(--danger-bg)', border: '0.5px solid var(--danger-text)',
          fontSize: '13px', color: 'var(--danger-text)',
        }}>
          Connection failed: {oauthError.replace(/_/g, ' ')}
        </div>
      )}

      {/* Provider cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {isLoading ? (
          <div style={{
            gridColumn: '1 / -1', padding: '40px',
            textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)',
          }}>
            Loading integrations…
          </div>
        ) : ALL_PROVIDERS.map(provider => {
          const meta = PROVIDER_META[provider]
          const connected = integrations.find(i => i.provider === provider)

          return (
            <div
              key={provider}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: `0.5px solid ${connected ? 'var(--accent)' : 'var(--border)'}`,
                background: connected ? 'var(--accent-bg)' : 'var(--bg-card)',
              }}
            >
              {/* Provider header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: connected ? meta.iconColor : 'var(--bg-secondary)',
                  border: connected ? 'none' : '0.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 700,
                  color: connected ? '#fff' : 'var(--text-tertiary)',
                }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{meta.label}</span>
                    {connected && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                        borderRadius: '10px', background: 'var(--accent)',
                        color: '#fff', flexShrink: 0,
                      }}>
                        Connected
                      </span>
                    )}
                  </div>
                  {connected ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {connected.accountLabel ?? 'Active'} · Last sync: {formatRelativeTime(connected.lastSyncedAt)}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Not connected</div>
                  )}
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.6 }}>
                {meta.description}
              </p>

              {/* Feature tags */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {meta.features.map(f => (
                  <span key={f} style={{
                    fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                    background: 'var(--bg-secondary)', border: '0.5px solid var(--border)',
                    color: 'var(--text-secondary)', fontWeight: 500,
                  }}>
                    {f}
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              {connected ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleSync(provider)}
                    disabled={syncing === provider}
                    style={{
                      flex: 1, padding: '7px', borderRadius: '7px',
                      border: 'none', background: 'var(--accent)',
                      fontSize: '12px', fontWeight: 600,
                      cursor: syncing === provider ? 'not-allowed' : 'pointer',
                      color: '#fff', opacity: syncing === provider ? 0.6 : 1,
                    }}
                  >
                    {syncing === provider ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button
                    onClick={() => handleDisconnect(provider)}
                    disabled={disconnecting === provider}
                    style={{
                      padding: '7px 12px', borderRadius: '7px',
                      border: '0.5px solid var(--border)', background: 'transparent',
                      fontSize: '12px', fontWeight: 500,
                      cursor: disconnecting === provider ? 'not-allowed' : 'pointer',
                      color: 'var(--text-secondary)',
                      opacity: disconnecting === provider ? 0.6 : 1,
                    }}
                  >
                    {disconnecting === provider ? '…' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <a
                  href={USE_MOCK ? '#' : `/api/integrations/${provider}/connect`}
                  onClick={USE_MOCK
                    ? (e) => {
                        e.preventDefault()
                        alert('Integrations require real mode (VITE_USE_MOCK=false) and OAuth credentials in .env')
                      }
                    : undefined}
                  style={{
                    display: 'block', padding: '7px', borderRadius: '7px',
                    background: 'var(--accent)', textAlign: 'center',
                    fontSize: '12px', fontWeight: 600, color: '#fff',
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  Connect
                </a>
              )}
            </div>
          )
        })}
      </div>

      {/* How it works */}
      <div style={{
        background: 'var(--bg-card)', border: '0.5px solid var(--border)',
        borderRadius: '12px', padding: '16px 20px',
      }}>
        <div style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px',
        }}>
          How it works
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            ['1', 'Connect', 'Authorize Vytal to read from your email or chat provider via OAuth.'],
            ['2', 'Auto-capture', 'Incoming messages are automatically pulled into Channel Capture as raw captures.'],
            ['3', 'AI analysis', 'Claude analyzes each message — extracting contacts, action items, deal signals, and sentiment.'],
            ['4', 'Review & route', 'Open Channel Capture, review the extraction, and accept to route to Sales, Service, or Marketing.'],
          ].map(([num, step, desc]) => (
            <div key={step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'var(--accent-bg)', border: '0.5px solid var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>{num}</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{step}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
