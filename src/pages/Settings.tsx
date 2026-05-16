import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'

export function Settings() {
  const user = useAuthStore(s => s.user)
  const org = useAuthStore(s => s.org)
  const [activeTab, setActiveTab] = useState<'workspace' | 'modules' | 'api'>('workspace')

  if (!user || !org) return null

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'modules', label: 'Modules' },
    { id: 'api', label: 'API & Integrations' },
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
