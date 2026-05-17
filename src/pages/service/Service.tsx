import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useServiceStore } from '@/hooks/useServiceStore'
import type { Ticket, TicketStatus, TicketPriority, TicketMessage } from '@/types/service'

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_ORDER: TicketPriority[] = ['urgent', 'high', 'medium', 'low']
const STATUS_TABS: Array<TicketStatus | 'all'> = ['all', 'open', 'pending', 'resolved', 'closed']

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  urgent: 'var(--danger)',
  high: 'var(--warning)',
  medium: 'var(--accent)',
  low: 'var(--success)',
}

const PRIORITY_TEXT: Record<TicketPriority, { bg: string; color: string }> = {
  urgent: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
  high: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  medium: { bg: 'var(--info-bg)', color: 'var(--info-text)' },
  low: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
}

const STATUS_COLORS: Record<TicketStatus, { bg: string; color: string }> = {
  open: { bg: 'var(--info-bg)', color: 'var(--info-text)' },
  pending: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  resolved: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  closed: { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const s = PRIORITY_TEXT[priority]
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
      {priority}
    </span>
  )
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS_COLORS[status]
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
      {status}
    </span>
  )
}

function slaRemaining(slaDueAt: Date | undefined): { text: string; overdue: boolean } | null {
  if (!slaDueAt) return null
  const due = new Date(slaDueAt)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  if (diffMs < 0) return { text: 'Overdue', overdue: true }
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return { text: `${hours}h ${minutes}m`, overdue: false }
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  border: '0.5px solid var(--border)', background: 'var(--bg-input)',
  fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
}

// ── New ticket modal ──────────────────────────────────────────────────────────
interface NewTicketModalProps {
  onClose: () => void
  onCreate: (data: Omit<Ticket, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => void
}

function NewTicketModal({ onClose, onCreate }: NewTicketModalProps) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [contactSearch, setContactSearch] = useState('')

  function handleCreate() {
    onCreate({ subject, description, priority, status: 'open', tags: [], messages: [] })
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>New ticket</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Subject *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue" style={inputStyle} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide more details…" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)} style={{ ...inputStyle, cursor: 'pointer', textTransform: 'capitalize' }}>
              {PRIORITY_ORDER.map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Contact (search)</label>
            <input type="text" value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search by name or email…" style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={handleCreate} disabled={!subject.trim()} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: subject.trim() ? 'pointer' : 'not-allowed', color: '#fff', opacity: subject.trim() ? 1 : 0.5 }}>Create ticket</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ticket detail panel ───────────────────────────────────────────────────────
interface TicketPanelProps {
  ticket: Ticket
  onClose: () => void
  onUpdate: (id: string, data: Partial<Ticket>) => void
  onAddMessage: (ticketId: string, body: string, isInternal: boolean) => void
  onClose2: (id: string) => void
}

function TicketPanel({ ticket, onClose, onUpdate, onAddMessage, onClose2 }: TicketPanelProps) {
  const [convoTab, setConvoTab] = useState<'conversation' | 'internal'>('conversation')
  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  const messages: TicketMessage[] = ticket.messages ?? []
  const visible = messages.filter(m => convoTab === 'internal' ? m.isInternal : !m.isInternal)

  function handleSend() {
    if (!reply.trim()) return
    onAddMessage(ticket.id, reply.trim(), isInternal)
    setReply('')
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', background: 'var(--bg-card)', borderLeft: '0.5px solid var(--border)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ flex: 1, paddingRight: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '15px', lineHeight: 1.3, marginBottom: '6px' }}>{ticket.subject}</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Priority</label>
            <select
              value={ticket.priority}
              onChange={e => onUpdate(ticket.id, { priority: e.target.value as TicketPriority })}
              style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px', textTransform: 'capitalize', cursor: 'pointer' }}
            >
              {PRIORITY_ORDER.map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Status</label>
            <select
              value={ticket.status}
              onChange={e => onUpdate(ticket.id, { status: e.target.value as TicketStatus })}
              style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px', textTransform: 'capitalize', cursor: 'pointer' }}
            >
              {(['open', 'pending', 'resolved', 'closed'] as TicketStatus[]).map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Description</p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{ticket.description || 'No description provided.'}</p>
      </div>

      {/* Conversation tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        {(['conversation', 'internal'] as const).map(t => (
          <button
            key={t}
            onClick={() => setConvoTab(t)}
            style={{
              flex: 1, padding: '10px', border: 'none', borderBottom: convoTab === t ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              color: convoTab === t ? 'var(--accent-text)' : 'var(--text-secondary)',
              transition: 'all 0.15s', textTransform: 'capitalize',
            }}
          >
            {t === 'internal' ? 'Internal notes' : 'Conversation'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {visible.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '20px' }}>
            No {convoTab === 'internal' ? 'notes' : 'messages'} yet.
          </p>
        ) : (
          visible.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {msg.authorId ?? 'Customer'} · {new Date(msg.createdAt).toLocaleString()}
              </div>
              <div style={{
                padding: '10px 12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5,
                background: msg.isInternal ? 'var(--warning-bg)' : 'var(--bg-secondary)',
                border: '0.5px solid',
                borderColor: msg.isInternal ? 'var(--warning)' : 'var(--border)',
                color: 'var(--text-primary)',
              }}>
                {msg.body}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply area */}
      <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder={isInternal ? 'Add an internal note…' : 'Write a reply…'}
          rows={3}
          style={{ ...inputStyle, resize: 'none', marginBottom: '8px', background: isInternal ? 'var(--warning-bg)' : 'var(--bg-input)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
            Internal note
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => onClose2(ticket.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Close ticket
            </button>
            <button onClick={handleSend} disabled={!reply.trim()} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--accent)', fontSize: '12px', fontWeight: 500, cursor: reply.trim() ? 'pointer' : 'not-allowed', color: '#fff', opacity: reply.trim() ? 1 : 0.5 }}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Service page ──────────────────────────────────────────────────────────────
export function Service() {
  const tickets = useServiceStore(s => s.tickets)
  const loadTickets = useServiceStore(s => s.loadTickets)
  const createTicket = useServiceStore(s => s.createTicket)
  const updateTicket = useServiceStore(s => s.updateTicket)
  const addMessage = useServiceStore(s => s.addMessage)
  const closeTicket = useServiceStore(s => s.closeTicket)

  const [isLoading, setIsLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<TicketStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all')
  const [search, setSearch] = useState('')

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    loadTickets().finally(() => setIsLoading(false))
  }, [])

  // Keep selected ticket in sync if store updates
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.id === selectedTicket.id)
      if (updated) setSelectedTicket(updated)
    }
  }, [tickets])

  const now = new Date()

  const urgentDueToday = tickets.filter(t => {
    if (t.priority !== 'urgent' || !t.slaDueAt) return false
    const due = new Date(t.slaDueAt)
    return due > now && due.toDateString() === now.toDateString()
  }).length

  const overdue = tickets.filter(t => t.slaDueAt && new Date(t.slaDueAt) < now && t.status !== 'closed' && t.status !== 'resolved').length

  const resolvedToday = tickets.filter(t => {
    if (!t.resolvedAt) return false
    return new Date(t.resolvedAt).toDateString() === now.toDateString()
  }).length

  const openCount = tickets.filter(t => t.status === 'open').length

  const filtered = tickets.filter(t => {
    if (statusTab !== 'all' && t.status !== statusTab) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.subject.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Sort by priority then creation date
  const sorted = [...filtered].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority)
    const pb = PRIORITY_ORDER.indexOf(b.priority)
    if (pa !== pb) return pa - pb
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      </div>
    )
  }

  const tabBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: '6px', border: '0.5px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
        fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
        textTransform: 'capitalize',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ padding: '20px 24px', marginRight: selectedTicket ? '440px' : 0, transition: 'margin-right 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Customer Service</h1>
          {openCount > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              {openCount} open
            </span>
          )}
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          + New ticket
        </button>
      </div>

      {/* SLA summary bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'Urgent due today', value: urgentDueToday, color: 'var(--danger-text)', bg: 'var(--danger-bg)' },
          { label: 'Overdue', value: overdue, color: 'var(--warning-text)', bg: 'var(--warning-bg)' },
          { label: 'Resolved today', value: resolvedToday, color: 'var(--success-text)', bg: 'var(--success-bg)' },
        ].map(kpi => (
          <div key={kpi.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', background: kpi.bg, border: '0.5px solid var(--border)' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
            <span style={{ fontSize: '12px', color: kpi.color }}>{kpi.label}</span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {STATUS_TABS.map(s => tabBtn(s === 'all' ? 'All' : s, statusTab === s, () => setStatusTab(s)))}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as TicketPriority | 'all')}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '12px', cursor: 'pointer', outline: 'none', color: 'var(--text-secondary)', textTransform: 'capitalize' }}
        >
          <option value="all">All priorities</option>
          {PRIORITY_ORDER.map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search tickets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', minWidth: '180px' }}
        />
      </div>

      {/* Ticket list */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '36px' }}>🎧</span>
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '14px' }}>No tickets found.</p>
          <button onClick={() => setShowNewModal(true)} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Create your first ticket
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sorted.map(ticket => {
            const sla = slaRemaining(ticket.slaDueAt)
            const isSelected = selectedTicket?.id === ticket.id

            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(prev => prev?.id === ticket.id ? null : ticket)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0',
                  background: 'var(--bg-card)',
                  border: '0.5px solid',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Priority indicator bar */}
                <div style={{ width: '4px', alignSelf: 'stretch', background: PRIORITY_COLORS[ticket.priority], flexShrink: 0 }} />

                <div style={{ flex: 1, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</span>
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {ticket.contactId ? `Contact #${ticket.contactId.slice(0, 8)}` : 'No contact'}
                        {ticket.assigneeId ? ` · @${ticket.assigneeId.slice(0, 6)}` : ''}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* SLA timer */}
                  {sla && (
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: sla.overdue ? 'var(--danger-text)' : 'var(--text-secondary)', background: sla.overdue ? 'var(--danger-bg)' : 'var(--bg-secondary)', padding: '2px 7px', borderRadius: '4px' }}>
                        {sla.overdue ? '⚠ Overdue' : `⏱ ${sla.text}`}
                      </span>
                    </div>
                  )}

                  {/* Assignee avatar */}
                  {ticket.assigneeId && (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', border: '0.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--accent-text)', flexShrink: 0 }}>
                      {ticket.assigneeId.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ticket detail panel */}
      {selectedTicket && (
        <TicketPanel
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={updateTicket}
          onAddMessage={addMessage}
          onClose2={id => { closeTicket(id); setSelectedTicket(null) }}
        />
      )}

      {/* New ticket modal */}
      {showNewModal && (
        <NewTicketModal
          onClose={() => setShowNewModal(false)}
          onCreate={data => createTicket(data)}
        />
      )}
    </div>
  )
}
