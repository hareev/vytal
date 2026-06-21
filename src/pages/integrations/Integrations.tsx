import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Integration, IntegrationProvider } from '@/types/integrations'
import { api } from '@/lib/api/client'

const USE_MOCK =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true'

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
  const justConfigured = urlParams?.get('configured') as IntegrationProvider | null
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

      {/* Feedback banners */}
      {justConnected && PROVIDER_META[justConnected] && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: 'var(--success-bg)', border: '0.5px solid var(--success-text)',
          fontSize: '13px', color: 'var(--success-text)', fontWeight: 500,
        }}>
          {PROVIDER_META[justConnected].label} connected successfully. Incoming messages will now flow into Channel Capture.
        </div>
      )}
      {justConfigured && PROVIDER_META[justConfigured] && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: 'var(--accent-bg)', border: '0.5px solid var(--accent)',
          fontSize: '13px', color: 'var(--accent)', fontWeight: 500,
        }}>
          {PROVIDER_META[justConfigured].label} credentials saved. Click <strong>Connect</strong> below to complete OAuth authorization.
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
          const integration = integrations.find(i => i.provider === provider)
          const isActive = integration?.status === 'active'
          const isConfigured = integration?.status === 'configuring'

          return (
            <div
              key={provider}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: `0.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                background: isActive ? 'var(--accent-bg)' : 'var(--bg-card)',
              }}
            >
              {/* Provider header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: isActive ? meta.iconColor : 'var(--bg-secondary)',
                  border: isActive ? 'none' : '0.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 700,
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{meta.label}</span>
                    {isActive && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                        borderRadius: '10px', background: 'var(--accent)',
                        color: '#fff', flexShrink: 0,
                      }}>
                        Connected
                      </span>
                    )}
                    {isConfigured && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                        borderRadius: '10px', background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)', border: '0.5px solid var(--border)', flexShrink: 0,
                      }}>
                        Credentials saved
                      </span>
                    )}
                  </div>
                  {isActive ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {integration?.accountLabel ?? 'Active'} · Last sync: {formatRelativeTime(integration?.lastSyncedAt ?? null)}
                    </div>
                  ) : isConfigured ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Ready to authorize via OAuth
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

              {/* Action buttons — 3 states */}
              {isActive ? (
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
              ) : isConfigured ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={USE_MOCK ? '#' : `/api/integrations/${provider}/connect`}
                    onClick={USE_MOCK
                      ? (e) => { e.preventDefault(); alert('Integrations require real mode (VITE_USE_MOCK=false)') }
                      : undefined}
                    style={{
                      flex: 1, display: 'block', padding: '7px', borderRadius: '7px',
                      background: 'var(--accent)', textAlign: 'center',
                      fontSize: '12px', fontWeight: 600, color: '#fff',
                      textDecoration: 'none', cursor: 'pointer',
                    }}
                  >
                    Connect to {meta.label}
                  </a>
                  <Link
                    to={`/app/integrations/${provider}/setup`}
                    style={{
                      padding: '7px 12px', borderRadius: '7px',
                      border: '0.5px solid var(--border)', background: 'transparent',
                      fontSize: '12px', fontWeight: 500,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    Edit
                  </Link>
                </div>
              ) : (
                <Link
                  to={`/app/integrations/${provider}/setup`}
                  style={{
                    display: 'block', padding: '7px', borderRadius: '7px',
                    border: '0.5px solid var(--border)', background: 'transparent',
                    textAlign: 'center', fontSize: '12px', fontWeight: 600,
                    color: 'var(--text-primary)', textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  Set up
                </Link>
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
            ['1', 'Set up', 'Enter your OAuth app credentials from your provider\'s developer console.'],
            ['2', 'Authorize', 'Click "Connect" to complete the OAuth flow — Vytal gets read-only access to your messages.'],
            ['3', 'Auto-capture', 'Incoming messages are pulled into Channel Capture and analyzed by Claude.'],
            ['4', 'Review & route', 'Open Channel Capture, review AI extractions, and accept to route into Sales, Service, or Marketing.'],
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
