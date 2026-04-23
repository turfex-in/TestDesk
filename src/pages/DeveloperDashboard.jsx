import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FolderPlus } from 'lucide-react'
import { useProject } from '../context/ProjectContext.jsx'
import {
  watchRounds,
  watchBugs,
  listUsers,
} from '../services/firebaseService'
import StatCards from '../components/dashboard/StatCards.jsx'
import RoundCard from '../components/dashboard/RoundCard.jsx'
import RecentBugs from '../components/dashboard/RecentBugs.jsx'
import EmptyState from '../components/common/EmptyState.jsx'

export default function DeveloperDashboard() {
  const { selected } = useProject()
  const [rounds, setRounds] = useState([])
  const [bugs, setBugs] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!selected?.id) {
      setRounds([])
      setBugs([])
      return
    }
    const offRounds = watchRounds(selected.id, setRounds)
    const offBugs = watchBugs({ projectId: selected.id, limitCount: 10 }, setBugs)
    listUsers().then(setUsers).catch(() => {})
    return () => {
      offRounds && offRounds()
      offBugs && offBugs()
    }
  }, [selected?.id])

  const stats = useMemo(() => {
    const totals = rounds.reduce(
      (acc, r) => {
        acc.total += r.totalCases || 0
        acc.passed += r.passed || 0
        acc.failed += r.failed || 0
        acc.pending += r.pending ?? Math.max(0, (r.totalCases || 0) - (r.passed || 0) - (r.failed || 0))
        return acc
      },
      { total: 0, passed: 0, failed: 0, pending: 0 }
    )
    return totals
  }, [rounds])

  const activeRounds = rounds.filter((r) => r.status === 'active')
  const testerMap = Object.fromEntries(users.filter((u) => u.role === 'tester').map((u) => [u.uid, u]))

  if (!selected) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-8">
        <EmptyState
          icon={FolderPlus}
          title="No project selected"
          description="Create or switch to a project from the top bar to see this dashboard."
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 mb-1">QA Performance Hub</h1>
          <p className="text-body-lg text-ink-muted">Live overview of quality metrics and testing progress.</p>
        </div>
        <div className="chip bg-secondary/15 text-secondary border border-secondary/30 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" /> System Online
        </div>
      </header>

      <StatCards stats={stats} />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2">Active Test Rounds</h2>
          <Link to="/rounds/new" className="btn btn-sm btn-primary">
            <Plus size={14} /> New Round
          </Link>
        </div>
        {activeRounds.length === 0 ? (
          <EmptyState
            title="No active rounds"
            description="Create a round to start tracking test execution for this project."
            action={
              <Link to="/rounds/new" className="btn btn-md btn-primary">
                <Plus size={16} /> Create first round
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {activeRounds.map((r) => (
              <RoundCard key={r.id} round={r} tester={testerMap[r.assignedTo]} />
            ))}
          </div>
        )}
      </section>

      <section>
        <RecentBugs bugs={bugs} users={users} />
      </section>
    </div>
  )
}
