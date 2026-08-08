import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCustomersStore } from '@/hooks/useCustomersStore'
import type { AccountContact, AccountDeal, AccountSignal, AccountIntelligence } from '@/types/customers'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'customer':  return 'var(--success)'
    case 'prospect':  return 'var(--accent)'
    case 'lead':      return 'var(--warning)'
    case 'churned':   return 'var(--danger)'
    default:          return 'var(--text-muted)'
  }
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function churnColor(risk: AccountIntelligence['churnRisk']): string {
  return risk === 'high' ? 'var(--danger)' : risk === 'medium' ? 'var(--warning)' : 'var(--success)'
}

function signalSourceColor(source: AccountSignal['source']): string {
  switch (source) {
    case 'capture':  return '#67e8f9'
    case 'deal':     return '#4ade80'
    case 'ticket':   return '#fbbf24'
    case 'activity': return '#c4b5fd'
    default:         return 'var(--text-muted)'
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ContactRow({ contact }: { contact: AccountContact }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 0',
      borderBottom: '0.5px solid var(--border)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'var(--bg-elevated)',
        border: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: 'var(--accent)',
      }}>
        {contact.name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          {contact.name}
          {contact.title && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
              {contact.title}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.email}
        </div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
        background: `${statusColor(contact.status)}1a`,
        color: statusColor(contact.status),
        border: `1px solid ${statusColor(contact.status)}33`,
        flexShrink: 0,
      }}>
        {statusLabel(contact.status)}
      </span>
    </div>
  )
}

function DealRow({ deal }: { deal: AccountDeal }) {
  const isDone = deal.status === 'won' || deal.status === 'lost'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: 'var(--bg-elevated)',
      border: '0.5px solid var(--border)',
      borderRadius: 8, marginBottom: 8,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: deal.status === 'won' ? 'var(--success)' : deal.status === 'lost' ? 'var(--danger)' : 'var(--accent)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>{deal.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{deal.stage}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--text)' }}>
          ${deal.value.toLocaleString()}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{deal.status}</div>
      </div>
    </div>
  )
}

function SignalRow({ signal }: { signal: AccountSignal }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 0', borderBottom: '0.5px solid var(--border)',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        background: `${signalSourceColor(signal.source)}1a`,
        color: signalSourceColor(signal.source),
        border: `1px solid ${signalSourceColor(signal.source)}33`,
        textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: 1,
      }}>
        {signal.source}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{signal.summary}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{signal.capturedAt}</div>
    </div>
  )
}

function IntelligencePanel({
  intelligence,
  isAnalyzing,
  onGenerate,
  error,
}: {
  intelligence?: AccountIntelligence
  isAnalyzing: boolean
  onGenerate: () => void
  error: string | null
}) {
  if (isAnalyzing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing account intelligence…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!intelligence) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>🧠</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No intelligence generated yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.6 }}>
          Claude will analyze all contacts, deals, and signals for this account and surface actionable intelligence.
        </div>
        {error && (
          <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
        <button onClick={onGenerate} style={{
          padding: '10px 24px', borderRadius: 8,
          background: 'var(--accent)', color: '#fff',
          border: 'none', fontWeight: 600, fontSize: 13,
          cursor: 'pointer',
        }}>
          Generate Intelligence
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary */}
      <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>Account Summary</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, margin: 0 }}>{intelligence.intelligenceSummary}</p>
      </div>

      {/* Company profile */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>Company Profile</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 8px' }}>{intelligence.companyProfile}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {intelligence.industry && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>
              {intelligence.industry}
            </span>
          )}
          {intelligence.estimatedSize && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>
              {intelligence.estimatedSize}
            </span>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Churn Risk</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: churnColor(intelligence.churnRisk), textTransform: 'capitalize' }}>
            {intelligence.churnRisk}
          </div>
        </div>
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Expansion Signal</div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(intelligence.expansionSignal * 100)}%`, background: 'var(--success)', borderRadius: 100 }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{Math.round(intelligence.expansionSignal * 100)}%</div>
        </div>
      </div>

      {/* Product interests */}
      {intelligence.productInterests.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>Product Interests</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {intelligence.productInterests.map((p) => (
              <span key={p} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', color: '#93c5fd' }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tools detected */}
      {intelligence.toolsDetected.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>Tools Detected</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {intelligence.toolsDetected.map((t) => (
              <span key={t} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#67e8f9' }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {intelligence.recommendedActions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>Recommended Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {intelligence.recommendedActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
        Generated {intelligence.generatedAt instanceof Date ? intelligence.generatedAt.toLocaleString() : String(intelligence.generatedAt)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Customers() {
  const { companySlug } = useParams<{ companySlug: string }>()
  const navigate = useNavigate()

  const searchResults    = useCustomersStore((s) => s.searchResults)
  const recentAccounts   = useCustomersStore((s) => s.recentAccounts)
  const activeAccount    = useCustomersStore((s) => s.activeAccount)
  const isSearching      = useCustomersStore((s) => s.isSearching)
  const isLoadingAccount = useCustomersStore((s) => s.isLoadingAccount)
  const isAnalyzing      = useCustomersStore((s) => s.isAnalyzing)
  const error            = useCustomersStore((s) => s.error)
  const searchCompanies  = useCustomersStore((s) => s.searchCompanies)
  const loadAccount      = useCustomersStore((s) => s.loadAccount)
  const generateIntelligence = useCustomersStore((s) => s.generateIntelligence)
  const clearSearch      = useCustomersStore((s) => s.clearSearch)

  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'intelligence'>('overview')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load account when slug is present
  useEffect(() => {
    if (companySlug) {
      loadAccount(companySlug)
      setActiveTab('overview')
    } else {
      clearSearch()
    }
  }, [companySlug, loadAccount, clearSearch])

  // Debounced search
  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void searchCompanies(value)
    }, 300)
  }

  // ─── Search/landing view ──────────────────────────────────────────────────

  if (!companySlug) {
    const displayList = query.trim() ? searchResults : recentAccounts
    const isEmpty = !query.trim() && recentAccounts.length === 0

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px 40px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Customers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Search for a company to view contacts, deals, and AI-generated account intelligence.
          </p>
        </div>

        {/* Search bar */}
        <div style={{ width: '100%', maxWidth: 560, position: 'relative', marginBottom: 32 }}>
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M11 11l3 3" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search for a company…"
            style={{
              width: '100%', padding: '12px 16px 12px 40px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10, fontSize: 14,
              color: 'var(--text)', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {isSearching && (
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>

        {/* Results / recents */}
        <div style={{ width: '100%', maxWidth: 560 }}>
          {isEmpty ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Type a company name to search your CRM data</div>
            </div>
          ) : (
            <>
              {!query.trim() && recentAccounts.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 10 }}>Recent</div>
              )}
              {query.trim() && !isSearching && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  No companies found for "{query}"
                </div>
              )}
              {displayList.map((account) => (
                <button
                  key={account.companySlug}
                  onClick={() => navigate(`/app/customers/${account.companySlug}`)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', marginBottom: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: 'var(--accent)',
                  }}>
                    {account.companyName.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{account.companyName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {account.contactCount} contact{account.contactCount !== 1 ? 's' : ''}
                      {account.dealCount > 0 && ` · ${account.dealCount} deal${account.dealCount !== 1 ? 's' : ''}`}
                      {account.openDealValue > 0 && ` · $${account.openDealValue.toLocaleString()} pipeline`}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                    background: `${statusColor(account.primaryStatus)}1a`,
                    color: statusColor(account.primaryStatus),
                    border: `1px solid ${statusColor(account.primaryStatus)}33`,
                    flexShrink: 0,
                  }}>
                    {statusLabel(account.primaryStatus)}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── Account detail view ──────────────────────────────────────────────────

  if (isLoadingAccount || !activeAccount) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        {isLoadingAccount
          ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading account…</div>
          : <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error ?? 'Account not found'}</div>
        }
      </div>
    )
  }

  const openDealValue = activeAccount.deals.filter((d) => d.status === 'open').reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left panel: contacts ─────────────────────────────────────────────── */}
      <div style={{
        width: 280, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)',
        borderRight: '0.5px solid var(--border)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border)' }}>
          <button
            onClick={() => navigate('/app/customers')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 12, padding: '0 0 10px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 10L4 6l4-4" />
            </svg>
            Back to search
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: 'var(--accent)',
            }}>
              {activeAccount.companyName.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{activeAccount.companyName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {activeAccount.contacts.length} contacts · {activeAccount.deals.length} deals
              </div>
            </div>
          </div>
        </div>

        {/* Contact list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', padding: '12px 0 4px' }}>
            Contacts ({activeAccount.contacts.length})
          </div>
          {activeAccount.contacts.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
          {activeAccount.contacts.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No contacts</div>
          )}
        </div>
      </div>

      {/* ── Right panel: tabs ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Tab bar + action */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg-card)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex' }}>
            {(['overview', 'signals', 'intelligence'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '14px 16px', fontSize: 13, fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                  borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTab === 'intelligence' && activeAccount.intelligence && (
            <button
              onClick={() => void generateIntelligence()}
              disabled={isAnalyzing}
              style={{
                fontSize: 12, fontWeight: 600, padding: '6px 14px',
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 7, cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              Refresh Intelligence
            </button>
          )}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* KPI strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Contacts', value: activeAccount.contacts.length },
                  { label: 'Open Deals', value: activeAccount.deals.filter((d) => d.status === 'open').length },
                  { label: 'Pipeline Value', value: openDealValue > 0 ? `$${openDealValue.toLocaleString()}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Deals */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                  Deals ({activeAccount.deals.length})
                </div>
                {activeAccount.deals.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No deals associated with this account.</div>
                ) : (
                  activeAccount.deals.map((deal) => <DealRow key={deal.id} deal={deal} />)
                )}
              </div>

              {/* Quick intelligence CTA if not yet generated */}
              {!activeAccount.intelligence && (
                <div style={{
                  padding: '16px 18px', border: '1px dashed var(--border)', borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ fontSize: 24 }}>🧠</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Generate Account Intelligence</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Claude will analyse all data for this account and surface insights.</div>
                  </div>
                  <button
                    onClick={() => { setActiveTab('intelligence'); void generateIntelligence() }}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: 'var(--accent)', color: '#fff',
                      border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Analyze
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Signals tab */}
          {activeTab === 'signals' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Activity Signals ({activeAccount.signals.length})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Events from captures, deals, and activities linked to this account.
              </div>
              {activeAccount.signals.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '30px 0', textAlign: 'center' }}>
                  No signals captured yet. Accept Channel Captures linked to this account to surface signals here.
                </div>
              ) : (
                activeAccount.signals.map((signal, i) => <SignalRow key={i} signal={signal} />)
              )}
            </div>
          )}

          {/* Intelligence tab */}
          {activeTab === 'intelligence' && (
            <IntelligencePanel
              intelligence={activeAccount.intelligence}
              isAnalyzing={isAnalyzing}
              onGenerate={() => void generateIntelligence()}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  )
}
