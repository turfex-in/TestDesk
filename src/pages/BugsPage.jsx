import { useEffect, useMemo, useState } from 'react'
import { Bug, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import { watchBugs, listUsers } from '../services/firebaseService'
import { ROLES, BUG_STATUS } from '../utils/constants'
import EmptyState from '../components/common/EmptyState.jsx'
import RecentBugs from '../components/dashboard/RecentBugs.jsx'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: BUG_STATUS.OPEN, label: 'Open' },
  { key: BUG_STATUS.IN_PROGRESS, label: 'In Progress' },
  { key: BUG_STATUS.FIXED, label: 'Fixed' },
  { key: BUG_STATUS.RETEST, label: 'Retest' },
  { key: BUG_STATUS.CLOSED, label: 'Closed' },
  { key: BUG_STATUS.REJECTED, label: 'Backlog' },
]

export default function BugsPage({ defaultFilter = 'all', pageTitle, pageDescription }) {
  const { profile } = useAuth()
  const { selected } = useProject()
  const isDev = profile?.role === ROLES.DEVELOPER
  const [bugs, setBugs] = useState([])
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState(defaultFilter)
  const [search, setSearch] = useState('')

  // Pin the filter to the route's default when the route changes — the
  // sidebar links rely on each page (Bugs / Fixed / Backlog) opening to
  // its own tab. Local clicks on the filter row still work afterward.
  useEffect(() => {
    setFilter(defaultFilter)
  }, [defaultFilter])

  useEffect(() => {
    if (!selected?.id) return setBugs([])
    const watchArgs = { projectId: selected.id, limitCount: 200 }
    if (!isDev) watchArgs.reporter = profile?.uid
    const off = watchBugs(watchArgs, setBugs)
    listUsers().then(setUsers).catch(() => {})
    return () => off && off()
  }, [selected?.id, isDev, profile?.uid])

  const filtered = useMemo(() => {
    return bugs.filter((b) => {
      // "All" shows only active work — fixed and backlogged bugs are out
      // of the dev's queue and only show under their own explicit tabs.
      // If the tester retests a fixed case and fails it, the failure
      // creates a new bug which shows up in All again.
      if (
        filter === 'all' &&
        (b.status === BUG_STATUS.REJECTED || b.status === BUG_STATUS.FIXED)
      ) {
        return false
      }
      if (filter !== 'all' && b.status !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!b.title?.toLowerCase().includes(q) && !b.bugId?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [bugs, filter, search])

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-h1 mb-1">{pageTitle || 'Bugs'}</h1>
        <p className="text-body-lg text-ink-muted">
          {pageDescription ||
            (isDev ? 'All reported bugs across rounds.' : 'Bugs you reported.')}
        </p>
      </header>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            className="input pl-9 h-9"
            placeholder="Search by title or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 ml-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                'px-3 py-1.5 rounded text-body-md font-medium transition-colors',
                filter === f.key ? 'bg-primary-container/20 text-primary' : 'text-ink-muted hover:bg-surface-high',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bug}
          title={bugs.length === 0 ? 'No bugs yet' : 'Nothing matches'}
          description={
            bugs.length === 0
              ? 'Testers will report bugs from the execution view, and they will show here in real time.'
              : 'Try a different filter or search.'
          }
        />
      ) : (
        <RecentBugs bugs={filtered} users={users} />
      )}
    </div>
  )
}
