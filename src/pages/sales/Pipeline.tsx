import { useState, useEffect, useRef } from 'react'
import type { DragEvent, CSSProperties } from 'react'
import { useCrmStore } from '@/hooks/useCrmStore'
import type { Deal, Stage, Contact } from '@/types/crm'

const fmt = (v: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Deal['status'] }) {
  const map: Record<Deal['status'], { bg: string; color: string; label: string }> = {
    open: { bg: 'var(--info-bg)', color: 'var(--info-text)', label: 'Open' },
    won: { bg: 'var(--success-bg)', color: 'var(--success-text)', label: 'Won' },
    lost: { bg: 'var(--danger-bg)', color: 'var(--danger-text)', label: 'Lost' },
  }
  const s = map[status]
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: s.bg, color: s.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {s.label}
    </span>
  )
}

// ── Deal card ─────────────────────────────────────────────────────────────────
interface DealCardProps {
  deal: Deal
  contacts: Contact[]
  onClick: () => void
  onDragStart: (e: DragEvent) => void
}

function DealCard({ deal, contacts, onClick, onDragStart }: DealCardProps) {
  const contact = contacts.find(c => c.id === deal.contactId)
  const contactName = contact ? `${contact.firstName} ${contact.lastName}` : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '0.5px solid var(--border)',
        borderRadius: '10px',
        padding: '12px',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      <div style={{ fontWeight: 500, fontSize: '13px', marginBottom: '6px', color: 'var(--text-primary)', lineHeight: 1.3 }}>{deal.title}</div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent-text)', marginBottom: '8px' }}>{fmt(deal.value, deal.currency)}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {contactName && <span>{contactName}</span>}
          {deal.closeDate && (
            <span style={{ marginLeft: contactName ? '6px' : 0 }}>
              {contactName ? '· ' : ''}
              {new Date(deal.closeDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <StatusBadge status={deal.status} />
      </div>
    </div>
  )
}

// ── Deal modal ────────────────────────────────────────────────────────────────
interface DealModalProps {
  deal: Deal | null
  stages: Stage[]
  contacts: Contact[]
  onClose: () => void
  onSave: (updated: Partial<Deal>) => void
}

function DealModal({ deal, stages, contacts, onClose, onSave }: DealModalProps) {
  const [title, setTitle] = useState(deal?.title ?? '')
  const [value, setValue] = useState(String(deal?.value ?? ''))
  const [stageId, setStageId] = useState(deal?.stageId ?? stages[0]?.id ?? '')
  const [contactId, setContactId] = useState(deal?.contactId ?? '')
  const [closeDate, setCloseDate] = useState(deal?.closeDate ? new Date(deal.closeDate).toISOString().slice(0, 10) : '')
  const [notes, setNotes] = useState(deal?.notes ?? '')

  const inputStyle: CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    border: '0.5px solid var(--border)', background: 'var(--bg-input)',
    fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
  }

  function handleSave() {
    onSave({ title, value: Number(value), stageId, contactId: contactId || undefined, closeDate: closeDate ? new Date(closeDate) : undefined, notes })
    onClose()
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '440px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{deal ? 'Edit deal' : 'New deal'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Deal name" style={inputStyle} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Value (USD)</label>
            <input type="number" min="0" value={value} onChange={e => setValue(e.target.value)} placeholder="0" style={inputStyle} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Stage</label>
            <select value={stageId} onChange={e => setStageId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Contact</label>
            <select value={contactId} onChange={e => setContactId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— None —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Close date</label>
            <input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!title.trim()} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: title.trim() ? 'pointer' : 'not-allowed', color: '#fff', opacity: title.trim() ? 1 : 0.5 }}>
              Save deal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline page ─────────────────────────────────────────────────────────────
export function Pipeline() {
  const deals = useCrmStore(s => s.deals)
  const pipelines = useCrmStore(s => s.pipelines)
  const contacts = useCrmStore(s => s.contacts)
  const loadDeals = useCrmStore(s => s.loadDeals)
  const loadPipelines = useCrmStore(s => s.loadPipelines)
  const loadContacts = useCrmStore(s => s.loadContacts)
  const createDeal = useCrmStore(s => s.createDeal)
  const updateDeal = useCrmStore(s => s.updateDeal)
  const moveDeal = useCrmStore(s => s.moveDeal)

  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')
  const [modalDeal, setModalDeal] = useState<Deal | null | 'new'>(null)
  const [newDealStageId, setNewDealStageId] = useState<string>('')
  const [dragDealId, setDragDealId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const dragOverStageRef = useRef<string | null>(null)

  useEffect(() => {
    Promise.all([loadDeals(), loadPipelines(), loadContacts()]).finally(() => setIsLoading(false))
  }, [])

  const pipeline = pipelines.find(p => p.id === selectedPipelineId) ?? pipelines[0]

  useEffect(() => {
    if (pipelines.length && !selectedPipelineId) {
      const def = pipelines.find(p => p.isDefault) ?? pipelines[0]
      setSelectedPipelineId(def.id)
    }
  }, [pipelines])

  const stages: Stage[] = pipeline?.stages.slice().sort((a, b) => a.position - b.position) ?? []

  const columns = stages.map(stage => ({
    stage,
    deals: deals.filter(d => d.stageId === stage.id && d.status === 'open'),
  }))

  function handleDragStart(e: DragEvent, dealId: string) {
    setDragDealId(dealId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent, stageId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverStageRef.current = stageId
  }

  async function handleDrop(e: DragEvent, stageId: string) {
    e.preventDefault()
    if (dragDealId && dragDealId !== stageId) {
      await moveDeal(dragDealId, stageId)
    }
    setDragDealId(null)
    dragOverStageRef.current = null
  }

  async function handleSaveDeal(data: Partial<Deal>) {
    if (modalDeal === 'new') {
      await createDeal({ ...data, stageId: data.stageId ?? newDealStageId } as Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>)
    } else if (modalDeal) {
      await updateDeal(modalDeal.id, data)
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <span style={{ fontSize: '32px' }}>📋</span>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No pipelines yet. Create one to get started.</p>
      </div>
    )
  }

  const allStages = pipeline.stages

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Sales Pipeline</h1>
          {pipelines.length > 1 && (
            <select
              value={selectedPipelineId}
              onChange={e => setSelectedPipelineId(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}
            >
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
        <button
          onClick={() => { setNewDealStageId(stages[0]?.id ?? ''); setModalDeal('new') }}
          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          + Add deal
        </button>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowX: 'auto', padding: '0 24px 24px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {columns.map(({ stage, deals: stageDeals }) => {
          const total = stageDeals.reduce((acc, d) => acc + d.value, 0)
          return (
            <div
              key={stage.id}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDrop={e => handleDrop(e, stage.id)}
              style={{
                width: '260px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 160px)',
              }}
            >
              {/* Column header */}
              <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px 10px 0 0', padding: '10px 12px', borderBottom: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{stage.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                    {stageDeals.length}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{fmt(total)}</div>
              </div>

              {/* Column body */}
              <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' }}>
                {stageDeals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    contacts={contacts}
                    onClick={() => setModalDeal(deal)}
                    onDragStart={e => handleDragStart(e, deal.id)}
                  />
                ))}

                <button
                  onClick={() => { setNewDealStageId(stage.id); setModalDeal('new') }}
                  style={{ background: 'none', border: '0.5px dashed var(--border)', borderRadius: '8px', padding: '8px', fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer', marginTop: 'auto' }}
                >
                  + Add deal
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modalDeal !== null && (
        <DealModal
          deal={modalDeal === 'new' ? null : modalDeal}
          stages={allStages}
          contacts={contacts}
          onClose={() => setModalDeal(null)}
          onSave={handleSaveDeal}
        />
      )}
    </div>
  )
}
