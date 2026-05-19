import { NavLink, useLocation } from 'react-router-dom'
import type { Org, User } from '@/types/auth'

interface NavItem {
  label: string
  path: string
  icon: () => JSX.Element
  module: keyof Org['modules'] | null
  children?: { label: string; path: string }[]
}

function IconHealth() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="1,8 4,8 5,4 7,12 9,6 11,9 12,8 15,8" />
    </svg>
  )
}
function IconSales() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="3" height="5" /><rect x="6.5" y="6" width="3" height="8" /><rect x="11" y="3" width="3" height="11" />
    </svg>
  )
}
function IconMarketing() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L4 6H2a1 1 0 00-1 1v2a1 1 0 001 1h2l8 4V2z" />
      <path d="M4 6v4" />
    </svg>
  )
}
function IconService() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1C4.69 1 2 3.69 2 7v2a2 2 0 002 2h1V7a3 3 0 016 0v4h1a2 2 0 002-2V7c0-3.31-2.69-6-6-6z" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
    </svg>
  )
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Onboarding & Scan',
    path: '/app/health',
    icon: IconHealth,
    module: 'health',
  },
  {
    label: 'Sales',
    path: '/app/sales',
    icon: IconSales,
    module: 'sales',
  },
  {
    label: 'Marketing',
    path: '/app/marketing',
    icon: IconMarketing,
    module: 'marketing',
  },
  {
    label: 'Service',
    path: '/app/service',
    icon: IconService,
    module: 'service',
  },
]

interface SidebarProps {
  org: Org
  user: User
  onLogout: () => void
}

export function Sidebar({ org, user, onLogout }: SidebarProps) {
  const location = useLocation()

  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      height: '100vh',
      position: 'sticky',
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-card)',
      borderRight: '0.5px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Logo + org */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="var(--accent)" />
            <circle cx="14" cy="14" r="7" stroke="white" strokeWidth="1.5" />
            <path d="M14 10v4l2.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.02em' }}>Vytal</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          borderRadius: '8px',
          background: 'var(--bg-secondary)',
          border: '0.5px solid var(--border)',
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {org.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {org.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{org.plan} plan</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {NAV_ITEMS.map(item => {
          if (item.module && !org.modules[item.module]) return null
          const isParentActive = location.pathname.startsWith(item.path)

          return (
            <div key={item.path} style={{ marginBottom: '2px' }}>
              <NavLink
                to={item.path}
                end={!!item.children}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 8px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: (isActive || (item.children && isParentActive)) ? 'var(--accent)' : 'var(--text-secondary)',
                  background: (isActive || (item.children && isParentActive)) ? 'var(--accent-bg)' : 'transparent',
                  transition: 'all 0.1s',
                  textDecoration: 'none',
                })}
              >
                <item.icon />
                {item.label}
              </NavLink>

              {item.children && isParentActive && (
                <div style={{ marginLeft: '24px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {item.children.map(child => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      end
                      style={({ isActive }) => ({
                        display: 'block',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                        background: isActive ? 'var(--accent-bg)' : 'transparent',
                        textDecoration: 'none',
                        fontWeight: isActive ? 500 : 400,
                      })}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom: settings + user */}
      <div style={{ padding: '8px', borderTop: '0.5px solid var(--border)' }}>
        <NavLink
          to="/app/settings"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 8px',
            borderRadius: '8px',
            fontSize: '13px',
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: isActive ? 'var(--accent-bg)' : 'transparent',
            textDecoration: 'none',
            marginBottom: '4px',
          })}
        >
          <IconSettings />
          Settings
        </NavLink>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 8px',
          borderRadius: '8px',
          cursor: 'pointer',
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--accent-bg)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{user.role}</div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
