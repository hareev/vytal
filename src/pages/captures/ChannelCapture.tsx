import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useCaptureStore } from '@/hooks/useCaptureStore'
import type { ChannelCapture as ChannelCaptureType, ChannelType, CaptureStatus, CaptureMetadata } from '@/types/captures'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'Yesterday'
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString()
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Channel Icons (inline SVG) ───────────────────────────────────────────────

function IconEmail({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M1 5l7 5 7-5" />
    </svg>
  )
}

function IconChat({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9L6 14v-3H3a1 1 0 01-1-1V3z" />
    </svg>
  )
}

function IconCall({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h2.5l1 3-1.5 1a8 8 0 004 4l1-1.5 3 1V12a1 1 0 01-1 1C6 13 3 8 3 3a1 1 0 011-1z" />
    </svg>
  )
}

function IconDocument({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1h6l4 4v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
      <path d="M10 1v4h4" />
      <path d="M5 9h6M5 12h4" />
    </svg>
  )
}

function IconSms({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 7h6M5 10h4" />
    </svg>
  )
}

function IconManual({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h10v10H3zM6 6h4M6 9h2" />
    </svg>
  )
}

function IconStar({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 0l1.2 3.6H11L8.1 5.8l1.1 3.6L6 7.3l-3.2 2.1 1.1-3.6L1 3.6h3.8z" />
    </svg>
  )
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l4 4 6-7" />
    </svg>
  )
}

function IconSpin({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M8 2a6 6 0 016 6" />
    </svg>
  )
}

function ChannelIcon({ type, size = 14 }: { type: ChannelType; size?: number }) {
  switch (type) {
    case 'email': return <IconEmail size={size} />
    case 'chat': return <IconChat size={size} />
    case 'call_transcript': return <IconCall size={size} />
    case 'document': return <IconDocument size={size} />
    case 'sms': return <IconSms size={size} />
    case 'manual': return <IconManual size={size} />
  }
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  email: 'Email',
  chat: 'Chat / Slack',
  call_transcript: 'Call Transcript',
  document: 'Document',
  sms: 'SMS',
  manual: 'Manual Entry',
}

const CHANNEL_DESCRIPTIONS: Record<ChannelType, string> = {
  email: 'Paste email content, headers auto-detected',
  chat: 'Paste a Slack, Teams, or chat thread',
  call_transcript: 'Paste a call or meeting transcript',
  document: 'Paste meeting notes or any document',
  sms: 'Paste SMS or text message thread',
  manual: 'Manually describe a conversation or event',
}

// ─── Status Badges ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CaptureStatus, { bg: string; color: string; label: string }> = {
  raw: { bg: 'var(--bg-secondary)', color: 'var(--text-tertiary)', label: 'Raw' },
  processing: { bg: 'var(--warning-bg)', color: 'var(--warning-text)', label: 'Processing' },
  ready: { bg: 'var(--accent-bg)', color: 'var(--accent-text)', label: 'Ready' },
  accepted: { bg: 'var(--success-bg)', color: 'var(--success-text)', label: 'Accepted' },
  dismissed: { bg: 'var(--bg-secondary)', color: 'var(--text-tertiary)', label: 'Dismissed' },
}

function StatusBadge({ status }: { status: CaptureStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
      background: s.bg, color: s.color, letterSpacing: '0.03em', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: '4px',
    }}>
      {status === 'processing' && (
        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', animation: 'pulse 1s ease-in-out infinite' }} />
      )}
      {s.label}
    </span>
  )
}

function ChannelBadge({ type }: { type: ChannelType }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
      background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
      display: 'inline-flex', alignItems: 'center', gap: '5px', letterSpacing: '0.02em',
    }}>
      <ChannelIcon type={type} size={10} />
      {CHANNEL_LABELS[type]}
    </span>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  border: '0.5px solid var(--border)', background: 'var(--bg-input)',
  fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'inherit',
}

// ─── New Capture Modal ────────────────────────────────────────────────────────

type ModalStep = 'channel' | 'content'

interface NewCaptureModalProps {
  onClose: () => void
  onCreate: (data: { channelType: ChannelType; rawContent: string; metadata?: CaptureMetadata }) => Promise<void>
}

function NewCaptureModal({ onClose, onCreate }: NewCaptureModalProps) {
  const [step, setStep] = useState<ModalStep>('channel')
  const [channelType, setChannelType] = useState<ChannelType>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Email fields
  const [emailFrom, setEmailFrom] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  // Chat fields
  const [chatParticipants, setChatParticipants] = useState('')
  // Call fields
  const [callDuration, setCallDuration] = useState('')
  const [callParticipants, setCallParticipants] = useState('')
  // Document fields
  const [docFileName, setDocFileName] = useState('')
  // Common
  const [body, setBody] = useState('')

  async function handleSubmit() {
    if (!body.trim()) return
    setIsSubmitting(true)
    try {
      let metadata: CaptureMetadata = {}
      if (channelType === 'email') {
        metadata = { from: emailFrom || undefined, subject: emailSubject || undefined }
      } else if (channelType === 'chat') {
        metadata = { participants: chatParticipants ? chatParticipants.split(',').map(p => p.trim()) : undefined }
      } else if (channelType === 'call_transcript') {
        metadata = {
          duration: callDuration ? parseInt(callDuration, 10) : undefined,
          participants: callParticipants ? callParticipants.split(',').map(p => p.trim()) : undefined,
        }
      } else if (channelType === 'document') {
        metadata = { fileName: docFileName || undefined }
      }
      await onCreate({ channelType, rawContent: body, metadata })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const CHANNEL_TYPES: ChannelType[] = ['email', 'chat', 'call_transcript', 'document', 'sms', 'manual']

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', width: '100%', maxWidth: step === 'channel' ? '580px' : '560px', border: '0.5px solid var(--border)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {step === 'content' && (
                <button onClick={() => setStep('channel')} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px 4px', fontSize: '13px' }}>← Back</button>
              )}
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                {step === 'channel' ? 'New Capture — Choose Channel' : `New ${CHANNEL_LABELS[channelType]} Capture`}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {step === 'channel' ? 'Select the type of conversation to capture' : 'Paste the content below and we\'ll extract the key details'}
          </p>
        </div>

        {/* Step 1: Channel Selector */}
        {step === 'channel' && (
          <div style={{ padding: '20px 24px 24px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {CHANNEL_TYPES.map(ct => (
                <button
                  key={ct}
                  onClick={() => { setChannelType(ct); setStep('content') }}
                  style={{
                    padding: '16px 12px', borderRadius: '10px', border: '0.5px solid',
                    borderColor: channelType === ct ? 'var(--accent)' : 'var(--border)',
                    background: channelType === ct ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                  }}
                >
                  <span style={{ color: channelType === ct ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    <ChannelIcon type={ct} size={20} />
                  </span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: channelType === ct ? 'var(--accent-text)' : 'var(--text-primary)', marginBottom: '3px' }}>
                      {CHANNEL_LABELS[ct]}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                      {CHANNEL_DESCRIPTIONS[ct]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Content form */}
        {step === 'content' && (
          <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
            {/* Email-specific fields */}
            {channelType === 'email' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>From</label>
                  <input type="text" value={emailFrom} onChange={e => setEmailFrom(e.target.value)} placeholder="sender@example.com" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Subject</label>
                  <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject line" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Email body *</label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Paste the email content here…" rows={8} style={{ ...inputStyle, resize: 'vertical', minHeight: '200px' }} />
                </div>
              </>
            )}

            {/* Chat-specific fields */}
            {channelType === 'chat' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Participants (comma-separated)</label>
                  <input type="text" value={chatParticipants} onChange={e => setChatParticipants(e.target.value)} placeholder="Alice, Bob, Carol" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Paste chat thread *</label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Paste the chat conversation here…" rows={9} style={{ ...inputStyle, resize: 'vertical', minHeight: '200px' }} />
                </div>
              </>
            )}

            {/* Call-specific fields */}
            {channelType === 'call_transcript' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Duration (minutes)</label>
                    <input type="number" value={callDuration} onChange={e => setCallDuration(e.target.value)} placeholder="45" style={inputStyle} min={0} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Participants</label>
                    <input type="text" value={callParticipants} onChange={e => setCallParticipants(e.target.value)} placeholder="Alice, Bob" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Paste transcript *</label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Paste the call transcript here…" rows={9} style={{ ...inputStyle, resize: 'vertical', minHeight: '200px' }} />
                </div>
              </>
            )}

            {/* Document-specific fields */}
            {channelType === 'document' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>File name (optional)</label>
                  <input type="text" value={docFileName} onChange={e => setDocFileName(e.target.value)} placeholder="meeting-notes.txt" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Paste document content *</label>
                  <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Paste the document or notes here…" rows={9} style={{ ...inputStyle, resize: 'vertical', minHeight: '200px' }} />
                </div>
              </>
            )}

            {/* SMS / Manual — just body */}
            {(channelType === 'sms' || channelType === 'manual') && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  {channelType === 'sms' ? 'Paste SMS thread *' : 'Describe the conversation *'}
                </label>
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={channelType === 'sms' ? 'Paste SMS messages here…' : 'Describe the conversation or event…'} rows={9} style={{ ...inputStyle, resize: 'vertical', minHeight: '200px' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!body.trim() || isSubmitting}
                style={{
                  flex: 2, padding: '10px', borderRadius: '8px', border: 'none',
                  background: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: !body.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                  color: '#fff', opacity: !body.trim() || isSubmitting ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {isSubmitting ? <><IconSpin size={14} /> Analyzing…</> : 'Capture & Analyze'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Capture List Item ────────────────────────────────────────────────────────

interface CaptureListItemProps {
  capture: ChannelCaptureType
  isSelected: boolean
  onClick: () => void
}

function CaptureListItem({ capture, isSelected, onClick }: CaptureListItemProps) {
  const { extraction, status, channelType, createdAt, metadata } = capture

  let firstLine: string
  if (status === 'processing') {
    firstLine = 'Processing…'
  } else if (extraction?.summary) {
    firstLine = truncate(extraction.summary, 60)
  } else if (metadata.subject) {
    firstLine = truncate(metadata.subject, 60)
  } else if (metadata.fileName) {
    firstLine = truncate(metadata.fileName, 60)
  } else {
    firstLine = CHANNEL_LABELS[channelType]
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderBottom: '0.5px solid var(--border)',
        cursor: 'pointer',
        background: isSelected ? 'var(--accent-bg)' : 'transparent',
        borderLeft: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
        transition: 'all 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Channel icon */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
          background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
          color: isSelected ? '#fff' : 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
        }}>
          <ChannelIcon type={channelType} size={13} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Summary line */}
          <div style={{ fontSize: '13px', color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)', fontWeight: status === 'ready' ? 500 : 400, lineHeight: 1.3, marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {firstLine}
          </div>
          {/* Status + date row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <StatusBadge status={status} />
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{relativeDate(createdAt)}</span>
          </div>
          {/* Ready indicator */}
          {status === 'ready' && (
            <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent)', fontWeight: 500 }}>
              <IconStar size={10} />
              Ready to accept
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Processing Animation ─────────────────────────────────────────────────────

function ProcessingAnimation() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: 'var(--accent)', opacity: 0.8,
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Analyzing conversation…</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Claude is extracting contacts, action items, and insights</div>
      </div>
    </div>
  )
}

// ─── AI Badge ─────────────────────────────────────────────────────────────────

function AIBadge() {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
      background: 'linear-gradient(135deg, var(--accent-bg), var(--bg-secondary))',
      color: 'var(--accent)', border: '0.5px solid var(--accent)', letterSpacing: '0.04em',
      display: 'inline-flex', alignItems: 'center', gap: '4px',
    }}>
      <IconStar size={9} />AI
    </span>
  )
}

// ─── Section Card (with accent left-border) ───────────────────────────────────

function SectionCard({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: '10px', border: '0.5px solid var(--border)',
      background: 'var(--bg-card)',
      borderLeft: '3px solid var(--accent)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px 8px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>{title}</span>
        {badge}
      </div>
      <div style={{ padding: '12px 14px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Capture Detail Panel ─────────────────────────────────────────────────────

interface CaptureDetailProps {
  capture: ChannelCaptureType
  onAccept: () => Promise<void>
  onDismiss: () => Promise<void>
  onReprocess: () => Promise<void>
  isProcessing: boolean
}

function CaptureDetail({ capture, onAccept, onDismiss, onReprocess, isProcessing }: CaptureDetailProps) {
  const { status, channelType, extraction, createdAt, metadata, linkedActivityId, linkedContactIds } = capture
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [justAccepted, setJustAccepted] = useState(false)

  async function handleAccept() {
    setIsAccepting(true)
    try {
      await onAccept()
      setJustAccepted(true)
    } finally {
      setIsAccepting(false)
    }
  }

  async function handleDismiss() {
    setIsDismissing(true)
    try {
      await onDismiss()
    } finally {
      setIsDismissing(false)
    }
  }

  const sentimentColor: Record<string, string> = {
    positive: 'var(--success-text)',
    negative: 'var(--danger-text)',
    neutral: 'var(--text-secondary)',
    urgent: 'var(--warning-text)',
  }
  const sentimentBg: Record<string, string> = {
    positive: 'var(--success-bg)',
    negative: 'var(--danger-bg)',
    neutral: 'var(--bg-secondary)',
    urgent: 'var(--warning-bg)',
  }
  const intentColor: Record<string, string> = {
    sales: 'var(--success-text)',
    support: 'var(--info-text)',
    feedback: 'var(--accent-text)',
    general: 'var(--text-secondary)',
    onboarding: 'var(--warning-text)',
  }
  const intentBg: Record<string, string> = {
    sales: 'var(--success-bg)',
    support: 'var(--info-bg)',
    feedback: 'var(--accent-bg)',
    general: 'var(--bg-secondary)',
    onboarding: 'var(--warning-bg)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Detail header */}
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <ChannelBadge type={channelType} />
          <StatusBadge status={status} />
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{relativeDate(createdAt)}</span>
          {metadata.subject && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{metadata.subject}"</span>
          )}
        </div>
        {/* Action buttons */}
        {(status === 'ready' || status === 'raw' || status === 'processing') && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {status === 'ready' && (
              <>
                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: isAccepting ? 'not-allowed' : 'pointer', opacity: isAccepting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isAccepting ? <><IconSpin size={12} /> Accepting…</> : <><IconCheck size={12} /> Accept</>}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={isDismissing}
                  style={{ padding: '7px 14px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', fontWeight: 500, cursor: isDismissing ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', opacity: isDismissing ? 0.7 : 1 }}
                >
                  Dismiss
                </button>
              </>
            )}
            <button
              onClick={onReprocess}
              disabled={isProcessing}
              style={{ padding: '7px 14px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', fontWeight: 500, cursor: isProcessing ? 'not-allowed' : 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isProcessing ? <><IconSpin size={11} /> Re-analyzing…</> : 'Re-process'}
            </button>
          </div>
        )}
      </div>

      {/* Detail body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Accepted state */}
        {status === 'accepted' && !justAccepted && (
          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--success-bg)', border: '0.5px solid var(--success-text)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconCheck size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success-text)', marginBottom: '3px' }}>Filed to CRM</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {linkedActivityId ? `Linked activity: ${linkedActivityId}` : 'Accepted and linked to CRM records'}
                {linkedContactIds.length > 0 && ` · ${linkedContactIds.length} contact${linkedContactIds.length > 1 ? 's' : ''} linked`}
              </div>
            </div>
          </div>
        )}

        {/* Just accepted success state */}
        {justAccepted && (
          <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--success-bg)', border: '0.5px solid var(--success-text)', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', color: 'var(--success-text)' }}>
              <IconCheck size={28} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--success-text)', marginBottom: '4px' }}>Filed to CRM</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>This capture has been accepted and linked to your CRM records</div>
          </div>
        )}

        {/* Processing / raw state */}
        {(status === 'processing' || (status === 'raw' && !extraction)) && (
          <ProcessingAnimation />
        )}

        {/* Dismissed state */}
        {status === 'dismissed' && (
          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>This capture was dismissed</div>
          </div>
        )}

        {/* Extraction cards — shown when ready or accepted */}
        {extraction && (status === 'ready' || status === 'accepted') && (
          <>
            {/* Summary card */}
            <SectionCard title="AI Summary" badge={<AIBadge />}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{extraction.summary}</p>
            </SectionCard>

            {/* Intent + Sentiment row */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 14px', borderRadius: '8px', background: intentBg[extraction.intent] ?? 'var(--bg-secondary)', border: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Intent</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: intentColor[extraction.intent] ?? 'var(--text-secondary)', textTransform: 'capitalize' }}>{extraction.intent}</div>
              </div>
              <div style={{ padding: '8px 14px', borderRadius: '8px', background: sentimentBg[extraction.sentiment] ?? 'var(--bg-secondary)', border: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Sentiment</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: sentimentColor[extraction.sentiment] ?? 'var(--text-secondary)', textTransform: 'capitalize' }}>{extraction.sentiment}</div>
              </div>
            </div>

            {/* Topics */}
            {extraction.topics.length > 0 && (
              <SectionCard title="Topics">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {extraction.topics.map(topic => (
                    <span key={topic} style={{ padding: '3px 10px', borderRadius: '20px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Contacts matched */}
            {extraction.contacts.length > 0 && (
              <SectionCard title="Contacts">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {extraction.contacts.map((contact, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: contact.existingContactId ? 'var(--accent-bg)' : 'var(--bg-secondary)', border: '0.5px solid', borderColor: contact.existingContactId ? 'var(--accent)' : 'var(--border)' }}>
                      {/* Avatar */}
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: contact.existingContactId ? 'var(--accent)' : 'var(--bg-card)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: contact.existingContactId ? '#fff' : 'var(--text-secondary)', flexShrink: 0 }}>
                        {initials(contact.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{contact.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                          {[contact.role, contact.company, contact.email].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {contact.existingContactId ? (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconCheck size={11} /> Matched
                          </span>
                        ) : (
                          <button style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '3px 8px', cursor: 'not-allowed', opacity: 0.6 }}>
                            + Add to CRM
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Action items */}
            {extraction.actionItems.length > 0 && (
              <SectionCard title="Action Items">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {extraction.actionItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '0.5px solid', borderColor: item.completed ? 'var(--success-text)' : 'var(--border)', background: item.completed ? 'var(--success-bg)' : 'transparent', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.completed && <IconCheck size={10} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: item.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: item.completed ? 'line-through' : 'none', lineHeight: 1.4 }}>{item.description}</div>
                        {(item.owner || item.dueHint) && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            {[item.owner && `Owner: ${item.owner}`, item.dueHint && `Due: ${item.dueHint}`].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Deal signals */}
            {extraction.dealSignals.length > 0 && (
              <SectionCard title="Deal Signals">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {extraction.dealSignals.map((signal, i) => (
                    <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'var(--success-bg)', border: '0.5px solid var(--success-text)' }}>
                      {signal.mentionedValue && (
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success-text)', marginBottom: '4px' }}>{signal.mentionedValue}</div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {signal.mentionedTimeline && <span>Timeline: {signal.mentionedTimeline}</span>}
                        {signal.stageSuggestion && <span>· Stage: <strong>{signal.stageSuggestion}</strong></span>}
                        {signal.existingDealId && (
                          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>· Matched deal #{signal.existingDealId}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Key points */}
            {extraction.keyPoints.length > 0 && (
              <SectionCard title="Key Points">
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {extraction.keyPoints.map((point, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{point}</li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Accept CTA at bottom for ready captures */}
            {status === 'ready' && !justAccepted && (
              <div style={{ paddingTop: '4px', paddingBottom: '8px' }}>
                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  style={{
                    width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                    background: 'var(--accent)', color: '#fff', fontSize: '14px', fontWeight: 600,
                    cursor: isAccepting ? 'not-allowed' : 'pointer', opacity: isAccepting ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {isAccepting ? <><IconSpin size={16} /> Accepting…</> : <><IconCheck size={14} /> Accept & File to CRM</>}
                </button>
              </div>
            )}
          </>
        )}

        {/* Raw content preview — collapsible at bottom */}
        {(status === 'ready' || status === 'accepted') && (
          <details style={{ borderRadius: '8px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            <summary style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer', background: 'var(--bg-secondary)', userSelect: 'none' }}>
              Raw content
            </summary>
            <pre style={{ margin: 0, padding: '12px 14px', fontSize: '11px', color: 'var(--text-tertiary)', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '200px', overflowY: 'auto' }}>
              {capture.rawContent}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  const CHANNEL_TYPES: ChannelType[] = ['email', 'chat', 'call_transcript', 'document', 'sms', 'manual']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '24px', padding: '40px' }}>
      {/* Visual: channel icons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {CHANNEL_TYPES.map(ct => (
          <div key={ct} style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            <ChannelIcon type={ct} size={18} />
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Select a capture or create a new one</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Paste any conversation — email, Slack, call transcript, or document — and Claude automatically extracts contacts, action items, deal signals, and key insights.
        </p>
      </div>
      <button
        onClick={onNew}
        style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
      >
        New Capture
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'inbox' | 'accepted' | 'dismissed'

export function ChannelCapture() {
  const captures = useCaptureStore(s => s.captures)
  const activeCapture = useCaptureStore(s => s.activeCapture)
  const isLoading = useCaptureStore(s => s.isLoading)
  const isProcessing = useCaptureStore(s => s.isProcessing)
  const loadCaptures = useCaptureStore(s => s.loadCaptures)
  const createCapture = useCaptureStore(s => s.createCapture)
  const processCapture = useCaptureStore(s => s.processCapture)
  const acceptCapture = useCaptureStore(s => s.acceptCapture)
  const dismissCapture = useCaptureStore(s => s.dismissCapture)
  const setActiveCapture = useCaptureStore(s => s.setActiveCapture)

  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    loadCaptures()
  }, [loadCaptures])

  // Filtered captures
  const filtered = captures.filter(c => {
    if (filterTab === 'inbox') return c.status === 'ready' || c.status === 'raw' || c.status === 'processing'
    if (filterTab === 'accepted') return c.status === 'accepted'
    if (filterTab === 'dismissed') return c.status === 'dismissed'
    return true
  })

  const inboxCount = captures.filter(c => c.status === 'ready' || c.status === 'raw' || c.status === 'processing').length
  const readyCount = captures.filter(c => c.status === 'ready').length

  // Sync active capture from store when list updates
  useEffect(() => {
    if (activeCapture) {
      const updated = captures.find(c => c.id === activeCapture.id)
      if (updated && updated !== activeCapture) setActiveCapture(updated)
    }
  }, [captures])

  const TABS: Array<{ key: FilterTab; label: string; count?: number }> = [
    { key: 'all', label: 'All', count: captures.length },
    { key: 'inbox', label: 'Inbox', count: inboxCount },
    { key: 'accepted', label: 'Accepted' },
    { key: 'dismissed', label: 'Dismissed' },
  ]

  return (
    <>
      {/* Global keyframe styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>

      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* ── Left panel ── */}
        <div style={{ width: '340px', flexShrink: 0, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Left panel header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--accent)' }}>
                  Channel Capture
                </h1>
                {readyCount > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <IconStar size={10} />
                    {readyCount} ready to accept
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowNewModal(true)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                + New
              </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '2px' }}>
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  style={{
                    flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none',
                    background: filterTab === tab.key ? 'var(--accent-bg)' : 'transparent',
                    color: filterTab === tab.key ? 'var(--accent-text)' : 'var(--text-tertiary)',
                    fontSize: '11px', fontWeight: filterTab === tab.key ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.1s', whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span style={{ marginLeft: '4px', fontSize: '10px', background: filterTab === tab.key ? 'var(--accent)' : 'var(--bg-secondary)', color: filterTab === tab.key ? '#fff' : 'var(--text-tertiary)', padding: '1px 5px', borderRadius: '10px' }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Capture list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                <IconSpin size={16} /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                No captures{filterTab !== 'all' ? ` in ${filterTab}` : ''} yet.
              </div>
            ) : (
              filtered.map(capture => (
                <CaptureListItem
                  key={capture.id}
                  capture={capture}
                  isSelected={activeCapture?.id === capture.id}
                  onClick={() => setActiveCapture(activeCapture?.id === capture.id ? null : capture)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
          {activeCapture ? (
            <CaptureDetail
              capture={activeCapture}
              onAccept={() => acceptCapture(activeCapture.id)}
              onDismiss={() => dismissCapture(activeCapture.id)}
              onReprocess={() => processCapture(activeCapture.id)}
              isProcessing={isProcessing}
            />
          ) : (
            <EmptyState onNew={() => setShowNewModal(true)} />
          )}
        </div>
      </div>

      {/* New capture modal */}
      {showNewModal && (
        <NewCaptureModal
          onClose={() => setShowNewModal(false)}
          onCreate={async (data) => {
            await createCapture(data)
          }}
        />
      )}
    </>
  )
}
