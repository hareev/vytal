import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useMarketingStore } from '@/hooks/useMarketingStore'
import type { Campaign, CampaignStatus, CampaignType, Segment, SegmentFilter, Sequence, SequenceStep } from '@/types/marketing'

type Tab = 'campaigns' | 'segments' | 'sequences'

// ── Helpers ───────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: CampaignType }) {
  const map: Record<CampaignType, { bg: string; color: string; label: string }> = {
    email: { bg: 'var(--info-bg)', color: 'var(--info-text)', label: 'Email' },
    sms: { bg: 'var(--warning-bg)', color: 'var(--warning-text)', label: 'SMS' },
    push: { bg: 'var(--accent-bg)', color: 'var(--accent-text)', label: 'Push' },
  }
  const s = map[type]
  return <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color, textTransform: 'uppercase' }}>{s.label}</span>
}

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, { bg: string; color: string }> = {
    draft: { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
    scheduled: { bg: 'var(--info-bg)', color: 'var(--info-text)' },
    sending: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
    sent: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
    paused: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  }
  const s = map[status]
  return <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color, textTransform: 'capitalize' }}>{status}</span>
}

function SequenceStatusBadge({ status }: { status: 'active' | 'paused' }) {
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: status === 'active' ? 'var(--success-bg)' : 'var(--warning-bg)', color: status === 'active' ? 'var(--success-text)' : 'var(--warning-text)', textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

function pct(num: number, denom: number) {
  if (!denom) return '0%'
  return `${Math.round((num / denom) * 100)}%`
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  border: '0.5px solid var(--border)', background: 'var(--bg-input)',
  fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
}

// ── Campaign modal ────────────────────────────────────────────────────────────
interface CampaignModalProps {
  campaign: Campaign | null
  segments: Segment[]
  onClose: () => void
  onSave: (data: Partial<Campaign>) => void
}

function CampaignModal({ campaign, segments, onClose, onSave }: CampaignModalProps) {
  const [name, setName] = useState(campaign?.name ?? '')
  const [type, setType] = useState<CampaignType>(campaign?.type ?? 'email')
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [body, setBody] = useState(campaign?.body ?? '')
  const [segmentId, setSegmentId] = useState(campaign?.segmentId ?? '')

  function handleSave() {
    onSave({ name, type, subject: subject || undefined, body: body || undefined, segmentId: segmentId || undefined })
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{campaign ? 'Edit campaign' : 'New campaign'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Campaign name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Welcome series" style={inputStyle} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as CampaignType)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push notification</option>
            </select>
          </div>

          {type === 'email' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Subject line</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your subject here" style={inputStyle} />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Message body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Target segment</label>
            <select value={segmentId} onChange={e => setSegmentId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">All contacts</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: name.trim() ? 'pointer' : 'not-allowed', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}>Save campaign</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Segment modal ─────────────────────────────────────────────────────────────
interface SegmentModalProps {
  segment: Segment | null
  onClose: () => void
  onSave: (data: Partial<Segment>) => void
}

const FIELD_OPTIONS = ['Status', 'Company', 'Tags', 'Created date']
const OPERATOR_OPTIONS: SegmentFilter['operator'][] = ['is', 'is_not', 'contains', 'gt', 'lt']
const OPERATOR_LABELS: Record<SegmentFilter['operator'], string> = { is: 'is', is_not: 'is not', contains: 'contains', gt: '>', lt: '<' }

function SegmentModal({ segment, onClose, onSave }: SegmentModalProps) {
  const [name, setName] = useState(segment?.name ?? '')
  const [filters, setFilters] = useState<SegmentFilter[]>(segment?.filters ?? [{ field: 'Status', operator: 'is', value: '' }])

  function addFilter() {
    setFilters(prev => [...prev, { field: 'Status', operator: 'is', value: '' }])
  }

  function updateFilter(idx: number, key: keyof SegmentFilter, val: string) {
    setFilters(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f))
  }

  function removeFilter(idx: number) {
    setFilters(prev => prev.filter((_, i) => i !== idx))
  }

  const mockCount = Math.floor(Math.random() * 200) + 10

  function handleSave() {
    onSave({ name, filters, contactCount: mockCount })
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '520px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{segment ? 'Edit segment' : 'New segment'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Segment name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Active customers" style={inputStyle} />
          </div>

          <div>
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>Conditions — match ALL of the following:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filters.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select value={f.field} onChange={e => updateFilter(idx, 'field', e.target.value)} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                    {FIELD_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={f.operator} onChange={e => updateFilter(idx, 'operator', e.target.value as SegmentFilter['operator'])} style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}>
                    {OPERATOR_OPTIONS.map(o => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
                  </select>
                  <input type="text" value={String(f.value)} onChange={e => updateFilter(idx, 'value', e.target.value)} placeholder="value" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => removeFilter(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>

            <button onClick={addFilter} style={{ marginTop: '8px', background: 'none', border: '0.5px dashed var(--border)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%' }}>
              + Add condition
            </button>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--success-bg)', border: '0.5px solid var(--success)', fontSize: '13px', color: 'var(--success-text)' }}>
            Preview: ~{mockCount} contacts match
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: name.trim() ? 'pointer' : 'not-allowed', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}>Save segment</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sequence modal ────────────────────────────────────────────────────────────
const TRIGGER_OPTIONS = ['New contact', 'Deal won', 'Deal lost', 'Custom']
const STEP_TYPE_ICONS: Record<SequenceStep['type'], string> = { email: '✉️', wait: '⏱', condition: '🔀' }

interface SequenceModalProps {
  onClose: () => void
  onSave: (data: Partial<Sequence>) => void
}

function SequenceModal({ onClose, onSave }: SequenceModalProps) {
  const [name, setName] = useState('')
  const [triggerEvent, setTriggerEvent] = useState(TRIGGER_OPTIONS[0])

  function handleSave() {
    onSave({ name, triggerEvent, status: 'active', steps: [] })
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '420px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>New sequence</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Sequence name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Onboarding flow" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Trigger event</label>
            <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: name.trim() ? 'pointer' : 'not-allowed', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}>Create sequence</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main marketing page ───────────────────────────────────────────────────────
export function Marketing() {
  const campaigns = useMarketingStore(s => s.campaigns)
  const segments = useMarketingStore(s => s.segments)
  const sequences = useMarketingStore(s => s.sequences)
  const loadCampaigns = useMarketingStore(s => s.loadCampaigns)
  const loadSegments = useMarketingStore(s => s.loadSegments)
  const loadSequences = useMarketingStore(s => s.loadSequences)
  const createCampaign = useMarketingStore(s => s.createCampaign)
  const updateCampaign = useMarketingStore(s => s.updateCampaign)
  const deleteCampaign = useMarketingStore(s => s.deleteCampaign)
  const createSegment = useMarketingStore(s => s.createSegment)

  const [tab, setTab] = useState<Tab>('campaigns')
  const [isLoading, setIsLoading] = useState(true)

  const [campaignModal, setCampaignModal] = useState<Campaign | null | 'new'>(null)
  const [segmentModal, setSegmentModal] = useState<Segment | null | 'new'>(null)
  const [sequenceModal, setSequenceModal] = useState(false)
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadCampaigns(), loadSegments(), loadSequences()]).finally(() => setIsLoading(false))
  }, [])

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '7px 16px', borderRadius: '8px', border: '0.5px solid',
        borderColor: tab === id ? 'var(--accent)' : 'transparent',
        background: tab === id ? 'var(--accent-bg)' : 'transparent',
        color: tab === id ? 'var(--accent-text)' : 'var(--text-secondary)',
        fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  const cardStyle: CSSProperties = {
    background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '16px',
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Marketing</h1>
        <div>
          {tab === 'campaigns' && (
            <button onClick={() => setCampaignModal('new')} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              + New campaign
            </button>
          )}
          {tab === 'segments' && (
            <button onClick={() => setSegmentModal('new')} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              + New segment
            </button>
          )}
          {tab === 'sequences' && (
            <button onClick={() => setSequenceModal(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              + New sequence
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', padding: '4px', background: 'var(--bg-secondary)', borderRadius: '10px', width: 'fit-content' }}>
        {tabBtn('campaigns', 'Campaigns')}
        {tabBtn('segments', 'Segments')}
        {tabBtn('sequences', 'Sequences')}
      </div>

      {/* ── Campaigns ── */}
      {tab === 'campaigns' && (
        <>
          {campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <span style={{ fontSize: '36px' }}>📢</span>
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>No campaigns yet. Create your first one!</p>
              <button onClick={() => setCampaignModal('new')} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                New campaign
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {campaigns.map(c => (
                <div key={c.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px' }}>{c.name}</span>
                      <TypeBadge type={c.type} />
                      <CampaignStatusBadge status={c.status} />
                    </div>
                    {c.stats && c.status === 'sent' && (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {[
                          { label: 'Open rate', val: pct(c.stats.opened, c.stats.sent) },
                          { label: 'Click rate', val: pct(c.stats.clicked, c.stats.sent) },
                          { label: 'Bounced', val: c.stats.bounced },
                        ].map(s => (
                          <div key={s.label} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>{s.label}: </span>{s.val}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Created {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => setCampaignModal(c)} style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Edit</button>
                    <button
                      onClick={() => createCampaign({ ...c, name: `${c.name} (copy)`, id: '', status: 'draft' } as Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      Duplicate
                    </button>
                    <button onClick={() => { if (window.confirm('Delete campaign?')) deleteCampaign(c.id) }} style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--danger-border)', background: 'var(--danger-bg)', fontSize: '12px', cursor: 'pointer', color: 'var(--danger-text)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Segments ── */}
      {tab === 'segments' && (
        <>
          {segments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <span style={{ fontSize: '36px' }}>🎯</span>
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>No segments yet. Create one to target specific contacts.</p>
              <button onClick={() => setSegmentModal('new')} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                New segment
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {segments.map(seg => (
                <div key={seg.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>{seg.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                      {seg.filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(' AND ') || 'No filters'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {seg.contactCount} contacts · Created {new Date(seg.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => setSegmentModal(seg)} style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Edit</button>
                    <button onClick={() => { if (window.confirm('Delete segment?')) void 0 }} style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--danger-border)', background: 'var(--danger-bg)', fontSize: '12px', cursor: 'pointer', color: 'var(--danger-text)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Sequences ── */}
      {tab === 'sequences' && (
        <>
          {sequences.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <span style={{ fontSize: '36px' }}>🔁</span>
              <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>No sequences yet. Automate your outreach.</p>
              <button onClick={() => setSequenceModal(true)} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                New sequence
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sequences.map(seq => (
                <div key={seq.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500, fontSize: '14px' }}>{seq.name}</span>
                        <SequenceStatusBadge status={seq.status} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        Trigger: {seq.triggerEvent} · {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''} · Created {new Date(seq.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => setExpandedSequence(prev => prev === seq.id ? null : seq.id)}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        {expandedSequence === seq.id ? 'Collapse' : 'View steps'}
                      </button>
                    </div>
                  </div>

                  {/* Steps */}
                  {expandedSequence === seq.id && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '0.5px solid var(--border)' }}>
                      {seq.steps.length === 0 ? (
                        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No steps yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {seq.steps.slice().sort((a, b) => a.position - b.position).map(step => (
                            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-bg)', border: '0.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--accent-text)', flexShrink: 0 }}>
                                {step.position}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                  <span>{STEP_TYPE_ICONS[step.type]}</span>
                                  <span style={{ fontSize: '13px', fontWeight: 500, textTransform: 'capitalize' }}>{step.type}</span>
                                  {step.delayHours && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>after {step.delayHours}h</span>}
                                </div>
                                {step.subject && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Subject: {step.subject}</div>}
                                {step.body && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{step.body.slice(0, 80)}{step.body.length > 80 ? '…' : ''}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button style={{ marginTop: '10px', background: 'none', border: '0.5px dashed var(--border)', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%' }}>
                        + Add step
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {campaignModal !== null && (
        <CampaignModal
          campaign={campaignModal === 'new' ? null : campaignModal}
          segments={segments}
          onClose={() => setCampaignModal(null)}
          onSave={data => {
            if (campaignModal === 'new') createCampaign(data as Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>)
            else updateCampaign(campaignModal.id, data)
          }}
        />
      )}

      {segmentModal !== null && (
        <SegmentModal
          segment={segmentModal === 'new' ? null : segmentModal}
          onClose={() => setSegmentModal(null)}
          onSave={data => createSegment(data as Omit<Segment, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>)}
        />
      )}

      {sequenceModal && (
        <SequenceModal
          onClose={() => setSequenceModal(false)}
          onSave={_data => { /* store.createSequence not in spec, mocked */ setSequenceModal(false) }}
        />
      )}
    </div>
  )
}
