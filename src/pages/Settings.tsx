import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { Integration, IntegrationProvider } from '@/types/integrations'
import { api } from '@/lib/api/client'

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

export function Settings() {
  const user = useAuthStore(s => s.user)
  const org = useAuthStore(s => s.org)

  // Read ?tab= from URL on mount
  const defaultTab = (() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab')
      if (p === 'integrations' || p === 'modules' || p === 'api') return p
    }
    return 'workspace'
  })()

  const [activeTab, setActiveTab] = useState<'workspace' | 'modules' | 'api' | 'integrations'>(
    defaultTab as 'workspace' | 'modules' | 'api' | 'integrations',
  )

  if (!user || !org) return null

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'modules', label: 'Modules' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'api', label: 'API' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '720px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Settings</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Manage your workspace, modules, and API access.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '0.5px solid var(--border)', paddingBottom: '0' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 500 : 400,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              marginBottom: '-0.5px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Section title="Workspace details">
            <Field label="Organization name" value={org.name} />
            <Field label="Slug" value={org.slug} />
            <Field label="Plan" value={org.plan} />
          </Section>
          <Section title="Your account">
            <Field label="Name" value={user.name} />
            <Field label="Email" value={user.email} />
            <Field label="Role" value={user.role} />
          </Section>
        </div>
      )}

      {activeTab === 'modules' && (
        <Section title="Active modules">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Toggle modules to control which features are available in the sidebar.
          </p>
          {(Object.entries(org.modules) as [keyof typeof org.modules, boolean][]).map(([mod, enabled]) => (
            <div key={mod} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '0.5px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, textTransform: 'capitalize' }}>
                  {mod === 'health' ? 'Health Monitor' : mod.charAt(0).toUpperCase() + mod.slice(1)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {mod === 'sales' && 'Pipeline, contacts, deals, activities'}
                  {mod === 'marketing' && 'Campaigns, segments, email sequences'}
                  {mod === 'service' && 'Support tickets, SLAs, conversations'}
                  {mod === 'health' && 'CRM health scoring and AI diagnosis'}
                </div>
              </div>
              <div style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: enabled ? 'var(--accent)' : 'var(--border-strong)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: enabled ? '18px' : '2px',
                  transition: 'left 0.15s',
                }} />
              </div>
            </div>
          ))}
        </Section>
      )}

      {activeTab === 'integrations' && <IntegrationsTab />}

      {activeTab === 'api' && (
        <Section title="API access">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Vytal exposes a headless REST API. Configure your environment to point clients at the API server.
          </p>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', marginBottom: '12px' }}>
            <div style={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}># API base URL</div>
            <div>VITE_API_URL=http://localhost:3001</div>
            <div style={{ marginTop: '8px', color: 'var(--text-tertiary)' }}># Database (Neon Postgres)</div>
            <div>DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/vytal?sslmode=require</div>
            <div style={{ marginTop: '8px', color: 'var(--text-tertiary)' }}># Auth secret (generate a strong random string)</div>
            <div>JWT_SECRET=your-secret-here</div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            See the <a href="https://github.com/hareev/vytal" style={{ color: 'var(--accent)' }}>README</a> for full API documentation and self-hosting instructions.
          </p>
        </Section>
      )}
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

const PROVIDER_META: Record<IntegrationProvider, { label: string; description: string; icon: string }> = {
  gmail: {
    label: 'Gmail',
    description: 'Auto-capture inbound emails as Channel Captures',
    icon: 'G',
  },
  outlook: {
    label: 'Outlook',
    description: 'Sync Microsoft Outlook emails to Channel Capture',
    icon: 'O',
  },
  slack: {
    label: 'Slack',
    description: 'Capture Slack messages and threads automatically',
    icon: 'S',
  },
  teams: {
    label: 'Microsoft Teams',
    description: 'Capture Teams chats and channel messages',
    icon: 'T',
  },
}

const ALL_PROVIDERS: IntegrationProvider[] = ['gmail', 'outlook', 'slack', 'teams']

function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

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

  // Read ?connected= or ?error= from URL to show feedback after OAuth redirect
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const justConnected = urlParams?.get('connected') as IntegrationProvider | null
  const oauthError = urlParams?.get('error')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {justConnected && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--success-bg)', border: '0.5px solid var(--success-text)', fontSize: '13px', color: 'var(--success-text)', fontWeight: 500 }}>
          {PROVIDER_META[justConnected]?.label ?? justConnected} connected successfully.
        </div>
      )}
      {oauthError && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--danger-bg)', border: '0.5px solid var(--danger-text)', fontSize: '13px', color: 'var(--danger-text)' }}>
          Connection failed: {oauthError.replace(/_/g, ' ')}
        </div>
      )}

      <Section title="Connected channels">
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Connect your email and chat providers. New messages are automatically captured and analyzed by Claude, then surfaced in Channel Capture for review.
        </p>

        {isLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {ALL_PROVIDERS.map(provider => {
              const meta = PROVIDER_META[provider]
              const connected = integrations.find(i => i.provider === provider)

              return (
                <div
                  key={provider}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: `0.5px solid ${connected ? 'var(--accent)' : 'var(--border)'}`,
                    background: connected ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                  }}
                >
                  {/* Icon + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                      background: connected ? 'var(--accent)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700,
                      color: connected ? '#fff' : 'var(--text-tertiary)',
                    }}>
                      {meta.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.label}</div>
                      {connected ? (
                        <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>
                          {connected.accountLabel ?? 'Connected'}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Not connected</div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                    {meta.description}
                  </p>

                  {/* Action button */}
                  {connected ? (
                    <button
                      onClick={() => handleDisconnect(provider)}
                      disabled={disconnecting === provider}
                      style={{
                        width: '100%', padding: '7px', borderRadius: '7px',
                        border: '0.5px solid var(--border)', background: 'transparent',
                        fontSize: '12px', fontWeight: 500, cursor: disconnecting === provider ? 'not-allowed' : 'pointer',
                        color: 'var(--text-secondary)', opacity: disconnecting === provider ? 0.6 : 1,
                      }}
                    >
                      {disconnecting === provider ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  ) : (
                    <a
                      href={USE_MOCK ? '#' : `/api/integrations/${provider}/connect`}
                      onClick={USE_MOCK ? (e) => { e.preventDefault(); alert('Integrations require real mode (VITE_USE_MOCK=false) and OAuth credentials in .env') } : undefined}
                      style={{
                        display: 'block', width: '100%', padding: '7px',
                        borderRadius: '7px', border: 'none',
                        background: 'var(--accent)', textAlign: 'center',
                        fontSize: '12px', fontWeight: 600, color: '#fff',
                        textDecoration: 'none', cursor: 'pointer', boxSizing: 'border-box',
                      }}
                    >
                      Connect
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="How it works">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            ['Connect', 'Authorize Vytal to read from your email or chat provider via OAuth.'],
            ['Auto-capture', 'Incoming messages are automatically pulled into Channel Capture as raw captures.'],
            ['AI analysis', 'Claude analyzes each message — extracting contacts, action items, deal signals, and sentiment.'],
            ['Review & accept', 'Open the Channel Capture inbox, review the extraction, and accept to file to your CRM.'],
          ].map(([step, desc]) => (
            <div key={step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-bg)', border: '0.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>→</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{step}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--border)', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, textTransform: label === 'Plan' || label === 'Role' ? 'capitalize' : 'none' }}>{value}</span>
    </div>
  )
}
