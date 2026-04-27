import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Plus, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import { watchRounds, listUsers } from '../services/firebaseService'
import { ROLES, ROUND_STATUS } from '../utils/constants'
import RoundCard from '../components/dashboard/RoundCard.jsx'
import EmptyState from '../components/common/EmptyState.jsx'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: ROUND_STATUS.ACTIVE, label: 'Active' },
  { key: ROUND_STATUS.COMPLETED, label: 'Completed' },
  { key: ROUND_STATUS.PAUSED, label: 'Paused' },
]

export default function TestRoundsPage() {
  const { profile } = useAuth()
  const { selected } = useProject()
  const isDev = profile?.role === ROLES.DEVELOPER
  const [rounds, setRounds] = useState([])
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!selected?.id) return setRounds([])
    const off = watchRounds(selected.id, setRounds)
    listUsers().then(setUsers).catch(() => {})
    return () => off && off()
  }, [selected?.id])

  const testerMap = useMemo(
    () => Object.fromEntries(users.map((u) => [u.uid, u])),
    [users]
  )

  const filtered = rounds.filter((r) => {
    if (!isDev && r.assignedTo !== profile?.uid) return false
    if (filter !== 'all' && r.status !== filter) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-h1 mb-1">Test Rounds</h1>
          <p className="text-body-lg text-ink-muted">All rounds for this project.</p>
        </div>
        {isDev && (
          <Link to="/rounds/new" className="btn btn-md btn-primary">
            <Plus size={16} /> New Round
          </Link>
        )}
      </header>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            className="input pl-9 h-9"
            placeholder="Search rounds…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 ml-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                'px-3 py-1.5 rounded text-body-md font-medium transition-colors',
                filter === f.key
                  ? 'bg-primary-container/20 text-primary'
                  : 'text-ink-muted hover:bg-surface-high',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={rounds.length === 0 ? 'No rounds yet' : 'No rounds match'}
          description={
            rounds.length === 0 && isDev
              ? 'Upload a CSV of test cases and create your first round.'
              : rounds.length === 0
              ? 'Waiting for a round to be assigned.'
              : 'Try a different filter or search.'
          }
          action={
            isDev && rounds.length === 0 ? (
              <Link to="/rounds/new" className="btn btn-md btn-primary">
                <Plus size={16} /> Create Round
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {filtered.map((r) => (
            <RoundCard key={r.id} round={r} tester={testerMap[r.assignedTo]} />
          ))}
        </div>
      )}
    </div>
  )
}
