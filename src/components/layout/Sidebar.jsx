import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  Bug,
  Users,
  Settings,
  PlayCircle,
  CheckCircle2,
  Archive,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { ROLES } from '../../utils/constants'
import Avatar from '../common/Avatar.jsx'
import logoApp from '../../assets/logo-app.png'

const DEV_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rounds', label: 'Test Rounds', icon: Inbox },
  { to: '/bugs', label: 'Bugs', icon: Bug },
  { to: '/bugs/fixed', label: 'Fixed', icon: CheckCircle2 },
  { to: '/bugs/backlog', label: 'Backlog', icon: Archive },
  { to: '/settings', label: 'Settings', icon: Settings, footer: true },
]

const TESTER_NAV = [
  { to: '/my-tests', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rounds', label: 'My Rounds', icon: PlayCircle },
  { to: '/bugs', label: 'Bugs I Reported', icon: Bug },
]

// /bugs needs to highlight on /bugs and /bugs/<id> but NOT on the dedicated
// Fixed / Backlog routes, which are sub-paths of /bugs but represent
// distinct sidebar destinations. Custom predicate handles the precedence.
const BUG_SUBROUTES = ['/bugs/fixed', '/bugs/backlog']

function isItemActive(item, pathname) {
  if (item.to === '/bugs') {
    if (pathname === '/bugs') return true
    if (pathname.startsWith('/bugs/') && !BUG_SUBROUTES.includes(pathname)) return true
    return false
  }
  if (BUG_SUBROUTES.includes(item.to) || item.to === '/dashboard' || item.to === '/my-tests') {
    return pathname === item.to
  }
  return pathname === item.to || pathname.startsWith(item.to + '/')
}

export default function Sidebar() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const isDev = profile?.role === ROLES.DEVELOPER
  const nav = isDev ? DEV_NAV : TESTER_NAV

  return (
    <aside className="w-[240px] shrink-0 bg-surface-lowest border-r border-outline-variant/60 flex flex-col">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-outline-variant/40">
        <img src={logoApp} alt="TestDesk" className="w-10 h-10 rounded shrink-0 object-cover" />
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
          .map((item) => {
            const active = isItemActive(item, pathname)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'relative flex items-center gap-3 px-3 py-2.5 rounded text-body-md font-medium transition-colors',
                  active
                    ? 'bg-primary-container/15 text-primary'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-high/60',
                ].join(' ')}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
                )}
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
      </nav>

      <div className="px-3 py-3 space-y-1 border-t border-outline-variant/40">
        {nav
          .filter((n) => n.footer)
          .map((item) => {
            const active = isItemActive(item, pathname)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded text-body-md font-medium transition-colors',
                  active
                    ? 'bg-primary-container/15 text-primary'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-high/60',
                ].join(' ')}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}

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
