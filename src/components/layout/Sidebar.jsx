import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  Bug,
  Users,
  Settings,
  PlayCircle,
  Terminal,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { ROLES } from '../../utils/constants'
import Avatar from '../common/Avatar.jsx'

const DEV_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rounds', label: 'Test Rounds', icon: Inbox },
  { to: '/bugs', label: 'Bugs', icon: Bug },
  { to: '/settings', label: 'Settings', icon: Settings, footer: true },
]

const TESTER_NAV = [
  { to: '/my-tests', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rounds', label: 'My Rounds', icon: PlayCircle },
  { to: '/bugs', label: 'Bugs I Reported', icon: Bug },
]

export default function Sidebar() {
  const { profile } = useAuth()
  const isDev = profile?.role === ROLES.DEVELOPER
  const nav = isDev ? DEV_NAV : TESTER_NAV

  return (
    <aside className="w-[240px] shrink-0 bg-surface-lowest border-r border-outline-variant/60 flex flex-col">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-outline-variant/40">
        <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center text-white shrink-0">
          <Terminal size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[16px] font-bold text-primary leading-none">TestDesk</div>
          <div className="font-mono text-[10px] text-ink-dim uppercase tracking-wider mt-1">
            QA Command Center
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav
          .filter((n) => !n.footer)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/my-tests'}
              className={({ isActive }) =>
                [
                  'relative flex items-center gap-3 px-3 py-2.5 rounded text-body-md font-medium transition-colors',
                  isActive
                    ? 'bg-primary-container/15 text-primary'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-high/60',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
                  )}
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
      </nav>

      <div className="px-3 py-3 space-y-1 border-t border-outline-variant/40">
        {nav
          .filter((n) => n.footer)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded text-body-md font-medium transition-colors',
                  isActive
                    ? 'bg-primary-container/15 text-primary'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-high/60',
                ].join(' ')
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}

        <div className="mt-2 bg-surface/80 rounded p-2.5 flex items-center gap-3">
          <Avatar name={profile?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink truncate">{profile?.name || '—'}</div>
            <div className="text-[11px] text-ink-dim truncate capitalize">
              {profile?.role === ROLES.DEVELOPER ? 'Lead Developer' : 'Tester'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
