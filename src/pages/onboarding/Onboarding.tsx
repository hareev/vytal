import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'

type Platform = 'dynamics365' | 'salesforce' | 'siebel' | 'hubspot'

interface ModuleSelection {
  sales: boolean
  marketing: boolean
  service: boolean
  health: boolean
}

interface InviteRow {
  email: string
  role: 'admin' | 'member'
}

const INDUSTRIES = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Retail',
  'Manufacturing',
  'Professional Services',
  'Other',
]

const TEAM_SIZES = ['Solo', '2–10', '11–50', '51–200', '200+']

const CRM_OPTIONS: Array<{ id: Platform; label: string; color: string }> = [
  { id: 'dynamics365', label: 'Dynamics 365', color: '#00a4ef' },
  { id: 'salesforce', label: 'Salesforce', color: '#00a1e0' },
  { id: 'siebel', label: 'Oracle Siebel', color: '#c74634' },
  { id: 'hubspot', label: 'HubSpot', color: '#ff7a59' },
]

const MODULE_OPTIONS: Array<{ key: keyof ModuleSelection; icon: string; title: string; desc: string }> = [
  { key: 'sales', icon: '💼', title: 'Sales CRM', desc: 'Contacts, deals, pipeline, activities' },
  { key: 'marketing', icon: '📢', title: 'Marketing', desc: 'Campaigns, segments, email sequences' },
  { key: 'service', icon: '🎧', title: 'Customer Service', desc: 'Support tickets, SLAs, knowledge base' },
  { key: 'health', icon: '📊', title: 'Health Monitor', desc: 'CRM health scoring and AI diagnosis' },
]

const TOTAL_STEPS = 5

function StepDots({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2rem' }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? '24px' : '8px',
            height: '8px',
            borderRadius: '4px',
            background: i === current ? 'var(--accent)' : i < current ? 'var(--accent)' : 'var(--border)',
            opacity: i < current ? 0.4 : 1,
            transition: 'all 0.25s',
          }}
        />
      ))}
    </div>
  )
}

function StepLabel({ step }: { step: number }) {
  const labels = ['Workspace', 'Modules', 'Connect CRM', 'Invite Team', 'All done']
  return (
    <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Step {step + 1} of {TOTAL_STEPS} — {labels[step]}
    </p>
  )
}

export function Onboarding() {
  const navigate = useNavigate()
  const org = useAuthStore(s => s.org)

  const [step, setStep] = useState(0)

  // Step 1 state
  const [companyName, setCompanyName] = useState(org?.name ?? '')
  const [industry, setIndustry] = useState('')
  const [teamSize, setTeamSize] = useState('')

  // Step 2 state
  const [modules, setModules] = useState<ModuleSelection>({ sales: true, marketing: true, service: true, health: true })

  // Step 3 state
  const [selectedCrm, setSelectedCrm] = useState<Platform | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})

  // Step 4 state
  const [invites, setInvites] = useState<InviteRow[]>([
    { email: '', role: 'member' },
    { email: '', role: 'member' },
    { email: '', role: 'member' },
  ])

  function toggleModule(key: keyof ModuleSelection) {
    setModules(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function addInviteRow() {
    setInvites(prev => [...prev, { email: '', role: 'member' }])
  }

  function updateInvite(idx: number, field: keyof InviteRow, value: string) {
    setInvites(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  function handleFinish() {
    navigate('/app')
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '0.5px solid var(--border)',
    background: 'var(--bg-input)',
    fontSize: '13px',
    color: 'var(--text-primary)',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const selectStyle: CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const primaryBtn: CSSProperties = {
    width: '100%',
    padding: '10px',
    borderRadius: '10px',
    background: 'var(--accent)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    transition: 'opacity 0.15s',
    marginTop: '4px',
  }

  const skipLink: CSSProperties = {
    display: 'block',
    textAlign: 'center',
    marginTop: '12px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    width: '100%',
  }

  const enabledModules = (Object.keys(modules) as Array<keyof ModuleSelection>).filter(k => modules[k])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-page)' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="8" fill="var(--accent)"/>
              <circle cx="14" cy="14" r="7" stroke="white" strokeWidth="1.5"/>
              <path d="M14 10v4l2.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>Vytal</span>
          </div>
        </div>

        <StepLabel step={step} />
        <StepDots current={step} />

        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '1.75rem' }}>

          {/* ── Step 0: Workspace ── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '4px' }}>Welcome to Vytal 👋</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Let&apos;s get your workspace set up in a few quick steps.</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  What&apos;s your company called? *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Industry
                </label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} style={selectStyle}>
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Team size
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {TEAM_SIZES.map(sz => (
                    <button
                      key={sz}
                      onClick={() => setTeamSize(sz)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '0.5px solid',
                        borderColor: teamSize === sz ? 'var(--accent)' : 'var(--border)',
                        background: teamSize === sz ? 'var(--accent-bg)' : 'transparent',
                        color: teamSize === sz ? 'var(--accent-text)' : 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep(1)}
                disabled={!companyName.trim()}
                style={{ ...primaryBtn, opacity: !companyName.trim() ? 0.5 : 1, cursor: !companyName.trim() ? 'not-allowed' : 'pointer' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 1: Modules ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '4px' }}>What will you use Vytal for?</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Select the modules you need — you can change this later.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {MODULE_OPTIONS.map(mod => (
                  <button
                    key={mod.key}
                    onClick={() => toggleModule(mod.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '0.5px solid',
                      borderColor: modules[mod.key] ? 'var(--accent)' : 'var(--border)',
                      background: modules[mod.key] ? 'var(--accent-bg)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '24px', lineHeight: 1 }}>{mod.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: modules[mod.key] ? 'var(--accent-text)' : 'var(--text-primary)' }}>{mod.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>{mod.desc}</div>
                    </div>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '4px',
                      border: '1.5px solid',
                      borderColor: modules[mod.key] ? 'var(--accent)' : 'var(--border)',
                      background: modules[mod.key] ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {modules[mod.key] && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(2)} style={primaryBtn}>
                Continue
              </button>
            </div>
          )}

          {/* ── Step 2: Connect CRM ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '4px' }}>Already using a CRM?</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Connect your existing CRM to import data automatically.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {CRM_OPTIONS.map(crm => (
                  <button
                    key={crm.id}
                    onClick={() => setSelectedCrm(prev => prev === crm.id ? null : crm.id)}
                    style={{
                      padding: '16px 12px',
                      borderRadius: '10px',
                      border: '0.5px solid',
                      borderColor: selectedCrm === crm.id ? 'var(--accent)' : 'var(--border)',
                      background: selectedCrm === crm.id ? 'var(--accent-bg)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: crm.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{crm.label[0]}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: selectedCrm === crm.id ? 'var(--accent-text)' : 'var(--text-primary)' }}>
                      {crm.label}
                    </span>
                  </button>
                ))}
              </div>

              {selectedCrm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)' }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
                    {CRM_OPTIONS.find(c => c.id === selectedCrm)?.label} credentials
                  </p>

                  {selectedCrm === 'dynamics365' && (
                    <>
                      {[
                        { key: 'orgUrl', label: 'Organisation URL', placeholder: 'https://your-org.crm.dynamics.com', type: 'url' },
                        { key: 'clientId', label: 'Client ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text' },
                        { key: 'clientSecret', label: 'Client Secret', placeholder: '••••••••', type: 'password' },
                        { key: 'tenantId', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text' },
                      ].map(field => (
                        <div key={field.key}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>{field.label}</label>
                          <input
                            type={field.type}
                            placeholder={field.placeholder}
                            value={credentials[field.key] ?? ''}
                            onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                    </>
                  )}

                  {selectedCrm !== 'dynamics365' && (
                    <>
                      {[
                        { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://your-org.my.crm.com', type: 'url' },
                        { key: 'apiKey', label: 'API Key / Access Token', placeholder: '••••••••', type: 'password' },
                      ].map(field => (
                        <div key={field.key}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>{field.label}</label>
                          <input
                            type={field.type}
                            placeholder={field.placeholder}
                            value={credentials[field.key] ?? ''}
                            onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                    </>
                  )}

                  <button onClick={() => setStep(3)} style={primaryBtn}>
                    Connect &amp; continue
                  </button>
                </div>
              )}

              {!selectedCrm && (
                <button onClick={() => setStep(3)} style={primaryBtn}>
                  Continue
                </button>
              )}

              <button onClick={() => setStep(3)} style={skipLink}>
                Skip for now
              </button>
            </div>
          )}

          {/* ── Step 3: Invite team ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '4px' }}>Who else needs access?</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Invite your team — they&apos;ll receive an email to join.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invites.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="email"
                      placeholder={`teammate${idx + 1}@company.com`}
                      value={row.email}
                      onChange={e => updateInvite(idx, 'email', e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <select
                      value={row.role}
                      onChange={e => updateInvite(idx, 'role', e.target.value)}
                      style={{ ...selectStyle, width: '110px', flexShrink: 0 }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </div>
                ))}
              </div>

              <button
                onClick={addInviteRow}
                style={{ background: 'none', border: '0.5px dashed var(--border)', borderRadius: '8px', padding: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%', transition: 'border-color 0.15s' }}
              >
                + Add another
              </button>

              <button onClick={() => setStep(4)} style={primaryBtn}>
                Send invites &amp; continue
              </button>
              <button onClick={() => setStep(4)} style={skipLink}>
                Skip for now
              </button>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>

              {/* Animated checkmark */}
              <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                  <circle
                    cx="40" cy="40" r="36"
                    fill="var(--success-bg)"
                    stroke="var(--success)"
                    strokeWidth="2"
                    style={{
                      strokeDasharray: '226',
                      strokeDashoffset: '0',
                      animation: 'dash-in 0.5s ease forwards',
                    }}
                  />
                  <path
                    d="M24 40l12 12 20-22"
                    stroke="var(--success)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: '50',
                      strokeDashoffset: '0',
                      animation: 'check-in 0.4s 0.3s ease forwards',
                    }}
                  />
                </svg>
                <style>{`
                  @keyframes dash-in { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                  @keyframes check-in { from { opacity: 0; } to { opacity: 1; } }
                `}</style>
              </div>

              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '8px' }}>Your workspace is ready.</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Here&apos;s what you&apos;ve enabled:</p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {MODULE_OPTIONS.filter(m => enabledModules.includes(m.key)).map(mod => (
                  <div
                    key={mod.key}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: 'var(--accent-bg)', border: '0.5px solid var(--accent)', fontSize: '13px', fontWeight: 500, color: 'var(--accent-text)' }}
                  >
                    <span>{mod.icon}</span>
                    <span>{mod.title}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleFinish}
                style={{ ...primaryBtn, padding: '12px 32px', width: 'auto', fontSize: '15px' }}
              >
                Go to dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
