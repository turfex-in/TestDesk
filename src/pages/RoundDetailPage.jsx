import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Play, PlayCircle, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import {
  getRound,
  watchTestCasesForRound,
  getUser,
  listRounds,
  deleteRoundCascade,
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
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('testId') || ''
  const { profile } = useAuth()
  const { selected } = useProject()
  const navigate = useNavigate()
  const isDev = profile?.role === ROLES.DEVELOPER

  const [round, setRound] = useState(null)
  const [tester, setTester] = useState(null)
  const [cases, setCases] = useState([])
  const [projectRounds, setProjectRounds] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const counts = await deleteRoundCascade(roundId)
      toast.success(
        `Round deleted (${counts.testCases} cases, ${counts.bugs} bugs, ${counts.batches} batches).`
      )
      navigate('/rounds')
    } catch (err) {
      toast.error(err.message || 'Could not delete round')
      setDeleting(false)
    }
  }

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
          {isDev && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn btn-md btn-secondary text-danger hover:bg-danger/10 border-danger/40"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
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

      <RegressionTable
        testCases={cases}
        maxRounds={Math.max(3, funnelSteps.length)}
        initialSearch={initialFilter}
      />

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 animate-fade-in"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="card p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger/15 text-danger flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-h3 mb-1">Delete this round?</h3>
                <p className="text-body-md text-ink-muted">
                  This permanently deletes the round, its{' '}
                  <span className="font-mono text-ink">{cases.length}</span> test cases,
                  all associated bugs, comments, and daily batches. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-surface-lowest/70 border border-outline-variant/40 rounded p-3 text-body-md text-ink-muted mb-5">
              <div className="font-semibold text-ink mb-1">{round?.name}</div>
              <div>Round {round?.roundNumber} • {round?.module}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="btn btn-md btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-md btn-danger"
              >
                {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                {deleting ? 'Deleting…' : 'Yes, delete round'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
