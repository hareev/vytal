import { useEffect, useState, type CSSProperties } from 'react'
import { useCrmReviewStore } from '@/hooks/useCrmReviewStore'
import type { CrmSubmission, CrmVerdict, CrmFeaturesDetected, CreateCrmSubmissionInput } from '@/types/crmReview'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ---------------------------------------------------------------------------
// Verdict config
// ---------------------------------------------------------------------------

const VERDICT_CONFIG: Record<CrmVerdict, { label: string; bg: string; color: string }> = {
  looks_good: { label: 'Looks Good', bg: '#d1fae5', color: '#065f46' },
  needs_improvement: { label: 'Needs Work', bg: '#fef3c7', color: '#92400e' },
  not_a_crm: { label: 'Not a CRM', bg: '#fee2e2', color: '#991b1b' },
}

const FEATURE_LABELS: Record<keyof CrmFeaturesDetected, string> = {
  contactManagement: 'Contact Management',
  dealPipeline: 'Deal Pipeline',
  activityTracking: 'Activity Tracking',
  userAuth: 'Authentication',
  search: 'Search',
  reporting: 'Reporting',
  emailIntegration: 'Email Integration',
  tags: 'Tags / Labels',
}

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

function VerdictBadge({ verdict }: { verdict: CrmVerdict }) {
  const cfg = VERDICT_CONFIG[verdict]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: CrmSubmission['status'] }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Pending', bg: 'var(--bg-secondary)', color: 'var(--text-tertiary)' },
    analyzing: { label: 'Analyzing…', bg: '#eff6ff', color: '#1d4ed8' },
    failed: { label: 'Failed', bg: '#fee2e2', color: '#991b1b' },
    completed: { label: 'Done', bg: '#d1fae5', color: '#065f46' },
  }
  const c = cfg[status] ?? cfg.pending
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 600,
      background: c.bg,
      color: c.color,
    }}>
      {status === 'analyzing' && (
        <span style={{ display: 'inline-flex', gap: '2px' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: '4px', height: '4px', borderRadius: '50%',
              background: 'currentColor',
              animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </span>
      )}
      {c.label}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '13px', fontWeight: 700, color, minWidth: '36px', textAlign: 'right' }}>{score}/100</span>
    </div>
  )
}

function FeatureChecklist({ features }: { features: CrmFeaturesDetected }) {
  const entries = Object.entries(FEATURE_LABELS) as [keyof CrmFeaturesDetected, string][]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
      {entries.map(([key, label]) => {
        const has = features[key]
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: has ? '#10b981' : 'var(--text-tertiary)', fontSize: '14px', lineHeight: 1 }}>
              {has ? '✓' : '✗'}
            </span>
            <span style={{ color: has ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Submission list item
// ---------------------------------------------------------------------------

function SubmissionListItem({
  submission,
  isActive,
  onClick,
}: {
  submission: CrmSubmission
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: isActive ? 'var(--bg-secondary)' : 'transparent',
        border: 'none',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
        padding: '10px 12px 10px 10px',
        cursor: 'pointer',
        transition: 'all 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {truncate(submission.crm_name, 32)}
        </span>
        {submission.verdict ? (
          <VerdictBadge verdict={submission.verdict} />
        ) : (
          <StatusBadge status={submission.status} />
        )}
      </div>

      {submission.score != null && (
        <div style={{ marginBottom: '4px' }}>
          <ScoreBar score={submission.score} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {submission.submitter_name ?? 'Anonymous'}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {relativeDate(submission.created_at)}
        </span>
      </div>

      {submission.ai_report?.techStack?.length ? (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
          {submission.ai_report.techStack.slice(0, 3).map((tech) => (
            <span key={tech} style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-tertiary)',
              border: '0.5px solid var(--border)',
            }}>
              {tech}
            </span>
          ))}
          {submission.ai_report.techStack.length > 3 && (
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>+{submission.ai_report.techStack.length - 3}</span>
          )}
        </div>
      ) : null}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Submission form (right panel — default state)
// ---------------------------------------------------------------------------

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: '4px',
}

function SubmissionForm({ onSubmitted }: { onSubmitted: () => void }) {
  const isSubmitting = useCrmReviewStore((s) => s.isSubmitting)
  const error = useCrmReviewStore((s) => s.error)
  const createSubmission = useCrmReviewStore((s) => s.createSubmission)

  const [form, setForm] = useState<CreateCrmSubmissionInput>({
    crmName: '',
    repoUrl: '',
    appUrl: '',
    description: '',
    builtFor: '',
  })
  const [urlError, setUrlError] = useState('')

  function handleChange(field: keyof CreateCrmSubmissionInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'repoUrl' || field === 'appUrl') setUrlError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.repoUrl?.trim() && !form.appUrl?.trim()) {
      setUrlError('Provide at least one of GitHub URL or Live App URL.')
      return
    }
    try {
      await createSubmission({
        crmName: form.crmName,
        repoUrl: form.repoUrl?.trim() || undefined,
        appUrl: form.appUrl?.trim() || undefined,
        description: form.description,
        builtFor: form.builtFor?.trim() || undefined,
      })
      onSubmitted()
    } catch {
      // error shown via store
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          Validate Your CRM
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 28px', lineHeight: 1.6 }}>
          Share your standalone CRM and Vytal's AI will review it — checking for core CRM features,
          code structure, and fit with your stated use case.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={labelStyle}>CRM Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              required
              value={form.crmName}
              onChange={(e) => handleChange('crmName', e.target.value)}
              placeholder="e.g. MiniCRM, SalesTrack, ContactFlow"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>GitHub Repository URL</label>
            <input
              type="url"
              value={form.repoUrl}
              onChange={(e) => handleChange('repoUrl', e.target.value)}
              placeholder="https://github.com/you/your-crm"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Live App URL</label>
            <input
              type="url"
              value={form.appUrl}
              onChange={(e) => handleChange('appUrl', e.target.value)}
              placeholder="https://your-crm.vercel.app"
              style={inputStyle}
            />
            {urlError && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--danger)' }}>{urlError}</p>
            )}
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Provide at least one of the above. GitHub repos get deeper analysis.
            </p>
          </div>

          <div>
            <label style={labelStyle}>What did you build this for? <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea
              required
              minLength={10}
              rows={3}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="e.g. A lightweight CRM for freelancers to track client projects and follow-ups."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Target users / use case (optional)</label>
            <textarea
              rows={3}
              value={form.builtFor}
              onChange={(e) => handleChange('builtFor', e.target.value)}
              placeholder="e.g. Solo consultants who need a simple way to track leads without complexity."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: isSubmitting ? 'var(--text-tertiary)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              alignSelf: 'flex-start',
            }}
          >
            {isSubmitting && (
              <span style={{
                width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }} />
            )}
            {isSubmitting ? 'Submitting…' : 'Submit for Validation'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analyzing state
// ---------------------------------------------------------------------------

function AnalyzingPanel({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '16px', padding: '40px',
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: 'var(--accent)',
            animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        AI is analyzing your CRM…
      </p>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, textAlign: 'center', maxWidth: '320px' }}>
        This takes 10–30 seconds. The page polls automatically every 5 seconds.
      </p>
      <button
        onClick={onRefresh}
        style={{
          padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        Refresh now
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------

function SectionCard({ title, children, accentColor }: { title: string; children: React.ReactNode; accentColor?: string }) {
  return (
    <div style={{
      borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${accentColor ?? 'var(--accent)'}`,
        fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {title}
      </div>
      <div style={{ padding: '14px' }}>
        {children}
      </div>
    </div>
  )
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>None identified.</p>
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <span style={{ color, marginTop: '2px', flexShrink: 0 }}>●</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function SubmissionDetail({
  submission,
  onReanalyze,
}: {
  submission: CrmSubmission
  onReanalyze: () => void
}) {
  const refreshActiveSubmission = useCrmReviewStore((s) => s.refreshActiveSubmission)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg-card)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              {submission.crm_name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {submission.verdict ? (
                <VerdictBadge verdict={submission.verdict} />
              ) : (
                <StatusBadge status={submission.status} />
              )}
              {submission.score != null && (
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Score: <strong style={{ color: 'var(--text-primary)' }}>{submission.score}/100</strong>
                </span>
              )}
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                by {submission.submitter_name ?? 'Anonymous'} · {relativeDate(submission.created_at)}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {submission.repo_url && (
              <a
                href={submission.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)',
                  fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                Repo
              </a>
            )}
            {submission.app_url && (
              <a
                href={submission.app_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)',
                  fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="7"/>
                  <path d="M1 8h14M8 1c-2 2-3 4.5-3 7s1 5 3 7M8 1c2 2 3 4.5 3 7s-1 5-3 7"/>
                </svg>
                Live App
              </a>
            )}
            {(submission.status === 'completed' || submission.status === 'failed') && (
              <button
                onClick={onReanalyze}
                style={{
                  padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)',
                  background: 'transparent', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                Re-analyze
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Description */}
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Purpose:</strong> {submission.description}
          {submission.built_for && (
            <span> · <strong style={{ color: 'var(--text-primary)' }}>Built for:</strong> {submission.built_for}</span>
          )}
        </div>

        {/* Analyzing state */}
        {submission.status === 'analyzing' && (
          <AnalyzingPanel onRefresh={refreshActiveSubmission} />
        )}

        {/* Failed state */}
        {submission.status === 'failed' && (
          <div style={{ padding: '14px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b', fontSize: '13px' }}>
            <strong>Analysis failed:</strong> {submission.error ?? 'Unknown error'}
          </div>
        )}

        {/* Completed with AI report */}
        {submission.status === 'completed' && submission.ai_report && (() => {
          const report = submission.ai_report
          return (
            <>
              {/* Score */}
              <SectionCard title="Score">
                <ScoreBar score={report.score} />
              </SectionCard>

              {/* Summary */}
              <SectionCard title="AI Assessment">
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                  {report.summary}
                </p>
                {report.useCaseFit && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Use Case Fit
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {report.useCaseFit}
                    </p>
                  </div>
                )}
              </SectionCard>

              {/* Tech stack */}
              {report.techStack?.length > 0 && (
                <SectionCard title="Tech Stack">
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {report.techStack.map((tech) => (
                      <span key={tech} style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
                        background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                        border: '0.5px solid var(--border)',
                      }}>
                        {tech}
                      </span>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Features */}
              {report.featuresDetected && (
                <SectionCard title="Features Detected">
                  <FeatureChecklist features={report.featuresDetected} />
                </SectionCard>
              )}

              {/* Strengths & Gaps */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <SectionCard title="Strengths" accentColor="#10b981">
                  <BulletList items={report.strengths ?? []} color="#10b981" />
                </SectionCard>
                <SectionCard title="Gaps" accentColor="#ef4444">
                  <BulletList items={report.gaps ?? []} color="#ef4444" />
                </SectionCard>
              </div>

              {/* Recommendations */}
              {(report.recommendations?.length ?? 0) > 0 && (
                <SectionCard title="Recommendations" accentColor="#6366f1">
                  <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {report.recommendations.map((rec, i) => (
                      <li key={i} style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {rec}
                      </li>
                    ))}
                  </ol>
                </SectionCard>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty right panel
// ---------------------------------------------------------------------------

function EmptyPanel({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '12px', padding: '40px', color: 'var(--text-tertiary)',
    }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
        <path d="M24 3L6 12v12c0 9 7.5 16.5 18 21 10.5-4.5 18-12 18-21V12L24 3z"/>
        <path d="M15 24l6 6 12-12"/>
      </svg>
      <p style={{ margin: 0, fontSize: '14px' }}>Select a CRM from the list or submit yours</p>
      <button
        onClick={onSubmit}
        style={{
          padding: '8px 18px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontSize: '13px',
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        Submit Your CRM
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function CrmValidator() {
  const submissions = useCrmReviewStore((s) => s.submissions)
  const activeSubmission = useCrmReviewStore((s) => s.activeSubmission)
  const isLoading = useCrmReviewStore((s) => s.isLoading)
  const loadSubmissions = useCrmReviewStore((s) => s.loadSubmissions)
  const setActiveSubmission = useCrmReviewStore((s) => s.setActiveSubmission)
  const reanalyzeSubmission = useCrmReviewStore((s) => s.reanalyzeSubmission)
  const refreshActiveSubmission = useCrmReviewStore((s) => s.refreshActiveSubmission)

  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  // Poll every 5s while analyzing
  useEffect(() => {
    if (!activeSubmission || activeSubmission.status !== 'analyzing') return
    const timer = setInterval(refreshActiveSubmission, 5000)
    return () => clearInterval(timer)
  }, [activeSubmission?.id, activeSubmission?.status, refreshActiveSubmission])

  function handleSelectSubmission(sub: CrmSubmission) {
    setActiveSubmission(sub)
    setShowForm(false)
  }

  function handleOpenForm() {
    setActiveSubmission(null)
    setShowForm(true)
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-page)' }}>

        {/* Left panel — directory list */}
        <div style={{
          width: '340px',
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRight: '0.5px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Left header */}
          <div style={{ padding: '16px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>CRM Validator</h2>
              <button
                onClick={handleOpenForm}
                style={{
                  padding: '5px 12px', borderRadius: '7px', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Submit
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {isLoading ? 'Loading…' : `${submissions.length} CRM${submissions.length === 1 ? '' : 's'} in directory`}
            </p>
          </div>

          {/* Submission list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading && submissions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Loading…
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                No CRMs submitted yet. Be the first!
              </div>
            ) : (
              submissions.map((sub) => (
                <SubmissionListItem
                  key={sub.id}
                  submission={sub}
                  isActive={activeSubmission?.id === sub.id}
                  onClick={() => handleSelectSubmission(sub)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        {showForm ? (
          <SubmissionForm onSubmitted={() => setShowForm(false)} />
        ) : activeSubmission ? (
          <SubmissionDetail
            submission={activeSubmission}
            onReanalyze={() => reanalyzeSubmission(activeSubmission.id)}
          />
        ) : (
          <EmptyPanel onSubmit={handleOpenForm} />
        )}
      </div>
    </>
  )
}
