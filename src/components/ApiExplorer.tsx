import { useState } from 'react'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface Param {
  name: string
  type: string
  required?: boolean
  description: string
  enum?: string[]
}

export interface Endpoint {
  method: HttpMethod
  path: string
  description: string
  queryParams?: Param[]
  bodyParams?: Param[]
}

export interface EndpointGroup {
  name: string
  description?: string
  endpoints: Endpoint[]
}

export interface ApiExplorerProps {
  title: string
  description: string
  groups: EndpointGroup[]
}

const METHOD_STYLES: Record<HttpMethod, { bg: string; color: string }> = {
  GET:    { bg: 'var(--success-bg)',  color: 'var(--success-text)' },
  POST:   { bg: 'var(--info-bg)',     color: 'var(--info-text)'    },
  PATCH:  { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  DELETE: { bg: 'var(--danger-bg)',  color: 'var(--danger-text)'  },
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const s = METHOD_STYLES[method]
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 0',
      width: '52px',
      textAlign: 'center',
      borderRadius: '4px',
      background: s.bg,
      color: s.color,
      letterSpacing: '0.04em',
      fontFamily: 'monospace',
      flexShrink: 0,
      display: 'inline-block',
    }}>
      {method}
    </span>
  )
}

function ParamTable({ params, title }: { params: Param[]; title: string }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
        {title}
      </p>
      <div style={{ border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        {params.map((p, i) => (
          <div key={p.name} style={{
            display: 'grid',
            gridTemplateColumns: '150px 80px 1fr',
            gap: '8px',
            padding: '8px 12px',
            borderBottom: i < params.length - 1 ? '0.5px solid var(--border)' : 'none',
            background: i % 2 === 0 ? 'transparent' : 'var(--bg-page)',
            alignItems: 'start',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <code style={{ fontSize: '12px', color: 'var(--accent-text)', fontFamily: 'monospace' }}>{p.name}</code>
              {p.required && (
                <span style={{ fontSize: '9px', color: 'var(--danger-text)', fontWeight: 700, letterSpacing: '0.04em' }}>REQ</span>
              )}
            </div>
            <code style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.type}</code>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.description}</span>
              {p.enum && (
                <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {p.enum.map(v => (
                    <code key={v} style={{ fontSize: '10px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '3px', border: '0.5px solid var(--border)', fontFamily: 'monospace' }}>
                      {v}
                    </code>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  const [open, setOpen] = useState(false)
  const hasDetails = (endpoint.queryParams?.length ?? 0) > 0 || (endpoint.bodyParams?.length ?? 0) > 0

  return (
    <div style={{ borderBottom: '0.5px solid var(--border)' }}>
      <button
        onClick={() => hasDetails && setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: hasDetails ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <MethodBadge method={endpoint.method} />
        <code style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'monospace', flex: 1, whiteSpace: 'nowrap' }}>
          {endpoint.path}
        </code>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', flex: 2 }}>
          {endpoint.description}
        </span>
        {hasDetails && (
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
        )}
      </button>

      {open && hasDetails && (
        <div style={{ padding: '0 14px 14px', background: 'var(--bg-secondary)' }}>
          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <ParamTable params={endpoint.queryParams} title="Query Parameters" />
          )}
          {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
            <ParamTable params={endpoint.bodyParams} title="Request Body" />
          )}
        </div>
      )}
    </div>
  )
}

export function ApiExplorer({ title, description, groups }: ApiExplorerProps) {
  const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

  return (
    <div style={{ padding: '32px 40px', maxWidth: '960px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          {description}
        </p>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '14px',
          padding: '8px 14px',
          background: 'var(--bg-card)',
          border: '0.5px solid var(--border)',
          borderRadius: '8px',
          fontSize: '12px',
        }}>
          <span>
            <span style={{ color: 'var(--text-tertiary)' }}>Base URL </span>
            <code style={{ color: 'var(--accent-text)', fontFamily: 'monospace' }}>{baseUrl}</code>
          </span>
          <span style={{ width: '1px', height: '14px', background: 'var(--border)', display: 'inline-block' }} />
          <span>
            <span style={{ color: 'var(--text-tertiary)' }}>Auth </span>
            <code style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Authorization: Bearer &lt;token&gt;</code>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {groups.map(group => (
          <div key={group.name}>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h2 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                {group.name}
              </h2>
              {group.description && (
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{group.description}</span>
              )}
            </div>
            <div style={{
              background: 'var(--bg-card)',
              border: '0.5px solid var(--border)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}>
              {group.endpoints.map((ep, i) => (
                <EndpointRow key={i} endpoint={ep} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
