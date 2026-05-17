import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useCrmStore } from '@/hooks/useCrmStore'
import type { Contact, ContactStatus, Deal } from '@/types/crm'

const PAGE_SIZE = 20

const fmt = (v: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)

const STATUS_OPTIONS: ContactStatus[] = ['lead', 'prospect', 'customer', 'churned']

function StatusBadge({ status }: { status: ContactStatus }) {
  const map: Record<ContactStatus, { bg: string; color: string }> = {
    lead: { bg: 'var(--info-bg)', color: 'var(--info-text)' },
    prospect: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
    customer: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
    churned: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
  }
  const s = map[status]
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: s.bg, color: s.color, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
      {status}
    </span>
  )
}

// ── Contact form modal ────────────────────────────────────────────────────────
interface ContactFormProps {
  contact: Contact | null
  onClose: () => void
  onSave: (data: Partial<Contact>) => void
}

function ContactModal({ contact, onClose, onSave }: ContactFormProps) {
  const [firstName, setFirstName] = useState(contact?.firstName ?? '')
  const [lastName, setLastName] = useState(contact?.lastName ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [company, setCompany] = useState(contact?.company ?? '')
  const [status, setStatus] = useState<ContactStatus>(contact?.status ?? 'lead')
  const [notes, setNotes] = useState(contact?.notes ?? '')

  const inputStyle: CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    border: '0.5px solid var(--border)', background: 'var(--bg-input)',
    fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
  }

  function handleSave() {
    onSave({ firstName, lastName, email, phone: phone || undefined, company: company || undefined, status, notes: notes || undefined })
    onClose()
  }

  const valid = firstName.trim() && lastName.trim() && email.trim()

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '460px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{contact ? 'Edit contact' : 'Add contact'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>First name *</label>
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Last name *</label>
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Company</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as ContactStatus)} style={{ ...inputStyle, cursor: 'pointer', textTransform: 'capitalize' }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!valid} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: valid ? 'pointer' : 'not-allowed', color: '#fff', opacity: valid ? 1 : 0.5 }}>
            Save contact
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Side panel ────────────────────────────────────────────────────────────────
interface SidePanelProps {
  contact: Contact
  deals: Deal[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

function ContactPanel({ contact, deals, onClose, onEdit, onDelete }: SidePanelProps) {
  const contactDeals = deals.filter(d => d.contactId === contact.id)

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px', background: 'var(--bg-card)', borderLeft: '0.5px solid var(--border)', zIndex: 500, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>{contact.firstName} {contact.lastName}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{contact.company ?? contact.email}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Details */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Details</p>
          {[
            { label: 'Email', value: contact.email },
            { label: 'Phone', value: contact.phone ?? '—' },
            { label: 'Company', value: contact.company ?? '—' },
            { label: 'Status', value: <StatusBadge status={contact.status} /> },
            { label: 'Created', value: new Date(contact.createdAt).toLocaleDateString() },
            { label: 'Updated', value: new Date(contact.updatedAt).toLocaleDateString() },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', textAlign: 'right' }}>
                {typeof row.value === 'string' ? row.value : row.value}
              </span>
            </div>
          ))}
          {contact.notes && (
            <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'var(--bg-secondary)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {contact.notes}
            </div>
          )}
        </div>

        {/* Deals */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Linked deals ({contactDeals.length})
          </p>
          {contactDeals.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No deals linked.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {contactDeals.map(d => (
                <div key={d.id} style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)' }}>
                  <div style={{ fontWeight: 500, fontSize: '13px' }}>{d.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{fmt(d.value, d.currency)} · {d.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Activity log</p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No activity recorded yet.</p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={onEdit} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-primary)' }}>
          Edit
        </button>
        <button onClick={onDelete} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '0.5px solid var(--danger-border)', background: 'var(--danger-bg)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--danger-text)' }}>
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Contacts page ─────────────────────────────────────────────────────────────
export function Contacts() {
  const contacts = useCrmStore(s => s.contacts)
  const deals = useCrmStore(s => s.deals)
  const loadContacts = useCrmStore(s => s.loadContacts)
  const loadDeals = useCrmStore(s => s.loadDeals)
  const loadPipelines = useCrmStore(s => s.loadPipelines)
  const createContact = useCrmStore(s => s.createContact)
  const updateContact = useCrmStore(s => s.updateContact)
  const deleteContact = useCrmStore(s => s.deleteContact)

  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [modalContact, setModalContact] = useState<Contact | null | 'new'>(null)

  useEffect(() => {
    Promise.all([loadContacts(), loadDeals(), loadPipelines()]).finally(() => setIsLoading(false))
  }, [])

  const filtered = contacts.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q || `${c.firstName} ${c.lastName} ${c.email} ${c.company ?? ''}`.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const paginated = filtered.slice(0, page * PAGE_SIZE)

  const handleSave = useCallback(async (data: Partial<Contact>) => {
    if (modalContact === 'new') {
      await createContact(data as Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>)
    } else if (modalContact) {
      await updateContact(modalContact.id, data)
    }
  }, [modalContact, createContact, updateContact])

  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('Delete this contact?')) {
      await deleteContact(id)
      setSelectedContact(null)
    }
  }, [deleteContact])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      </div>
    )
  }

  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: '6px', border: '0.5px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ padding: '20px 24px', marginRight: selectedContact ? '380px' : 0, transition: 'margin-right 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Contacts</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px' }}>{contacts.length}</span>
        </div>
        <button
          onClick={() => setModalContact('new')}
          style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          + Add contact
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search contacts…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ padding: '7px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', minWidth: '200px' }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {filterBtn('All', statusFilter === 'all', () => { setStatusFilter('all'); setPage(1) })}
          {STATUS_OPTIONS.map(s => filterBtn(s.charAt(0).toUpperCase() + s.slice(1), statusFilter === s, () => { setStatusFilter(s); setPage(1) }))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: '36px' }}>👤</span>
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '14px' }}>No contacts found.</p>
          <button onClick={() => setModalContact('new')} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Add your first contact
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 2fr 120px 120px 80px', gap: '0', padding: '10px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-secondary)' }}>
              {['Name', 'Company', 'Email', 'Status', 'Created', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {paginated.map(contact => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(prev => prev?.id === contact.id ? null : contact)}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 2fr 120px 120px 80px', gap: '0', padding: '12px 16px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s', background: selectedContact?.id === contact.id ? 'var(--accent-bg)' : 'transparent' }}
                onMouseEnter={e => { if (selectedContact?.id !== contact.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)' }}
                onMouseLeave={e => { if (selectedContact?.id !== contact.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                  {contact.firstName} {contact.lastName}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{contact.company ?? '—'}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{contact.email}</span>
                <span style={{ display: 'flex', alignItems: 'center' }}><StatusBadge status={contact.status} /></span>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>{new Date(contact.createdAt).toLocaleDateString()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setModalContact(contact); setSelectedContact(null) }} style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 4px' }}>✏️</button>
                  <button onClick={() => handleDelete(contact.id)} style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--danger-text)', cursor: 'pointer', padding: '2px 4px' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length > paginated.length && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button onClick={() => setPage(p => p + 1)} style={{ padding: '8px 20px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Load more ({filtered.length - paginated.length} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Side panel */}
      {selectedContact && (
        <ContactPanel
          contact={selectedContact}
          deals={deals}
          onClose={() => setSelectedContact(null)}
          onEdit={() => { setModalContact(selectedContact); setSelectedContact(null) }}
          onDelete={() => handleDelete(selectedContact.id)}
        />
      )}

      {/* Modal */}
      {modalContact !== null && (
        <ContactModal
          contact={modalContact === 'new' ? null : modalContact}
          onClose={() => setModalContact(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
