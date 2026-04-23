import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Play, PlayCircle } from 'lucide-react'
import {
  getRound,
  watchTestCasesForRound,
  getUser,
  listRounds,
} from '../services/firebaseService'
import { useAuth } from '../context/AuthContext.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import { ROLES } from '../utils/constants'
import FunnelOverview from '../components/rounds/FunnelOverview.jsx'
import RegressionTable from '../components/rounds/RegressionTable.jsx'
import Badge from '../components/common/Badge.jsx'
import toast from 'react-hot-toast'

export default function RoundDetailPage() {
  const { roundId } = useParams()
  const { profile } = useAuth()
  const { selected } = useProject()
  const isDev = profile?.role === ROLES.DEVELOPER

  const [round, setRound] = useState(null)
  const [tester, setTester] = useState(null)
  const [cases, setCases] = useState([])
  const [projectRounds, setProjectRounds] = useState([])

  useEffect(() => {
    getRound(roundId).then((r) => {
      setRound(r)
      if (r?.assignedTo) getUser(r.assignedTo).then(setTester)
    })
    const off = watchTestCasesForRound(roundId, setCases)
    return () => off && off()
  }, [roundId])

  useEffect(() => {
    if (selected?.id) listRounds(selected.id).then(setProjectRounds)
  }, [selected?.id])

  const funnelSteps = useMemo(() => {
    // Build funnel from all rounds in this project with the same module
    const siblings = projectRounds
      .filter((r) => r.module === round?.module)
      .sort((a, b) => a.roundNumber - b.roundNumber)
    return siblings.map((r) => ({
      roundNumber: r.roundNumber,
      total: r.totalCases,
      passed: r.passed,
      failed: r.failed,
      date: r.startDate,
      testerName: tester?.name,
    }))
  }, [projectRounds, round?.module, tester])

  const allPassed = funnelSteps.length > 0 && funnelSteps.every((s) => s.failed === 0 && s.passed === s.total)
  const daysElapsed = funnelSteps.length
    ? funnelSteps.reduce((acc, s) => acc + 2, 0)
    : 0

  function exportReport() {
    const header = ['Test ID', 'Title', 'Module', 'Priority', 'Status', 'Round 1', 'Round 2', 'Round 3']
    const rows = cases.map((tc) => [
      tc.testId,
      JSON.stringify(tc.title || ''),
      tc.module,
      tc.priority,
      tc.status,
      tc.roundResults?.round1 || '',
      tc.roundResults?.round2 || '',
      tc.roundResults?.round3 || '',
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `round-${round?.roundNumber || 'report'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported')
  }

  if (!round) {
    return <div className="h-full flex items-center justify-center text-ink-dim">Loading round…</div>
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/rounds" className="btn btn-sm btn-ghost">
            <ArrowLeft size={16} />
          </Link>
          <div className="text-body-md text-ink-muted">
            Modules › <span className="text-primary">{round.module}</span>
          </div>
        </div>
        <Badge tone="primary">
          {funnelSteps.length} Round{funnelSteps.length === 1 ? '' : 's'} • {daysElapsed} days •{' '}
          {allPassed ? '100% Resolution' : 'In progress'}
        </Badge>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 mb-1">Test Rounds — {round.name}</h1>
          <p className="text-body-lg text-ink-muted">
            Continuous integration testing pipeline for {round.module}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportReport} className="btn btn-md btn-secondary">
            <Download size={14} /> Export Report
          </button>
          {!isDev && (
            <Link to={`/rounds/${roundId}/execute`} className="btn btn-md btn-primary">
              <PlayCircle size={16} /> Start Testing
            </Link>
          )}
          {isDev && (
            <Link to="/rounds/new" className="btn btn-md btn-primary">
              <Play size={16} /> Start New Round
            </Link>
          )}
        </div>
      </div>

      <FunnelOverview steps={funnelSteps.length ? funnelSteps : [{
        roundNumber: round.roundNumber,
        total: round.totalCases,
        passed: round.passed,
        failed: round.failed,
        date: round.startDate,
        testerName: tester?.name,
      }]} allPassed={allPassed} />

      <RegressionTable testCases={cases} maxRounds={Math.max(3, funnelSteps.length)} />
    </div>
  )
}
