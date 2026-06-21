import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { IntegrationProvider } from '@/types/integrations'
import { api } from '@/lib/api/client'

const USE_MOCK =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true'

const SETUP_META: Record<IntegrationProvider, {
  label: string
  iconColor: string
  icon: string
  helpSteps: string[]
  scopeNote: string
}> = {
  gmail: {
    label: 'Gmail',
    iconColor: '#EA4335',
    icon: 'G',
    helpSteps: [
      'Go to Google Cloud Console → APIs & Services → Credentials',
      'Create an OAuth 2.0 Client ID (Application type: Web application)',
      'Add the Redirect URI below to "Authorized redirect URIs"',
      'Enable the Gmail API and Google People API for the project',
    ],
    scopeNote: 'Scopes used: gmail.readonly, userinfo.email',
  },
  outlook: {
    label: 'Outlook',
    iconColor: '#0078D4',
    icon: 'O',
    helpSteps: [
      'Go to Azure Portal → Microsoft Entra ID → App registrations',
      'Register a new application',
      'Under "Authentication", add the Redirect URI below as a Web redirect',
      'Under "API permissions", add Mail.Read and offline_access (delegated)',
    ],
    scopeNote: 'Scopes used: Mail.Read, offline_access',
  },
  slack: {
    label: 'Slack',
    iconColor: '#4A154B',
    icon: 'S',
    helpSteps: [
      'Go to api.slack.com/apps → Create New App → From scratch',
      'Under "OAuth & Permissions", add the Redirect URI below',
      'Add Bot Token Scopes: channels:history, im:history, channels:read, users:read',
      'Install the app to your workspace to get the credentials',
    ],
    scopeNote: 'Scopes used: channels:history, im:history, channels:read, users:read',
  },
  teams: {
    label: 'Microsoft Teams',
    iconColor: '#5B5EA6',
    icon: 'T',
    helpSteps: [
      'Go to Azure Portal → Microsoft Entra ID → App registrations',
      'Register a new application',
      'Under "Authentication", add the Redirect URI below as a Web redirect',
      'Under "API permissions", add ChannelMessage.Read.All, Chat.Read (delegated)',
    ],
    scopeNote: 'Scopes used: ChannelMessage.Read.All, Chat.Read, offline_access',
  },
}

export function ProviderSetup() {
  const { provider } = useParams<{ provider: string }>()
  const navigate = useNavigate()

  const meta = provider && SETUP_META[provider as IntegrationProvider]
  const defaultRedirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/integrations/${provider}/callback`
      : ''

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState(defaultRedirectUri)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!meta) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Unknown provider.</p>
      </div>
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!provider) return
    if (USE_MOCK) {
      alert('Integrations require real mode (VITE_USE_MOCK=false) and a live database.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.integrations.configure(provider, { clientId, clientSecret, redirectUri })
      navigate(`/app/integrations?configured=${provider}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '0.5px solid var(--border)',
    background: 'var(--bg-card)',
    fontSize: '13px',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
    outline: 'none',
  }

  return (
    <div style={{ padding: '24px', maxWidth: '560px' }}>
      {/* Back */}
      <button
        onClick={() => navigate('/app/integrations')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '13px', color: 'var(--text-secondary)', padding: 0,
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px',
        }}
      >
        ← Back to Integrations
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: meta.iconColor, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 700, color: '#fff',
        }}>
          {meta.icon}
        </div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 3px' }}>
            Connect {meta.label}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Enter your OAuth app credentials to authorize Vytal.
          </p>
        </div>
      </div>

      {/* Setup instructions */}
      <div style={{
        background: 'var(--bg-secondary)', border: '0.5px solid var(--border)',
        borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          How to get credentials
        </div>
        <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {meta.helpSteps.map((step, i) => (
            <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {step}
            </li>
          ))}
        </ol>
        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          {meta.scopeNote}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: 'var(--danger-bg)', border: '0.5px solid var(--danger-text)',
          fontSize: '13px', color: 'var(--danger-text)',
        }}>
          {error}
        </div>
      )}

      {/* Credentials form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            required
            placeholder={`Paste your ${meta.label} OAuth Client ID`}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
            Client Secret
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            required
            placeholder="Paste your OAuth Client Secret"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
            Redirect URI
          </label>
          <input
            type="text"
            value={redirectUri}
            onChange={e => setRedirectUri(e.target.value)}
            required
            style={{ ...inputStyle, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '12px' }}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '4px 0 0', lineHeight: 1.5 }}>
            Copy this exactly into the "Authorized redirect URIs" field of your OAuth app.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
          <button
            type="submit"
            disabled={saving || !clientId || !clientSecret || !redirectUri}
            style={{
              flex: 1, padding: '9px', borderRadius: '8px',
              border: 'none', background: 'var(--accent)',
              fontSize: '13px', fontWeight: 600, color: '#fff',
              cursor: saving || !clientId || !clientSecret ? 'not-allowed' : 'pointer',
              opacity: saving || !clientId || !clientSecret ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save & continue to OAuth'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/integrations')}
            style={{
              padding: '9px 16px', borderRadius: '8px',
              border: '0.5px solid var(--border)', background: 'transparent',
              fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
