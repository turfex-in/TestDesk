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
import { ROLES, TESTCASE_STATUS } from '../utils/constants'
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

  // Ground-truth current-round stats derived from the actual test cases.
  // Stored counters (round.passed/failed/pending) drift after retests +
  // carry-over, which is what produced the "215 PASS / 5 FAIL / -7 PEND"
  // display. Derive everything from `cases` so the numbers add up.
  const currentStats = useMemo(() => {
    let passed = 0
    let failed = 0
    let pending = 0
    let retest = 0
    let carry = 0
    for (const c of cases) {
      if (c.status === TESTCASE_STATUS.PASSED) passed++
      else if (c.status === TESTCASE_STATUS.FAILED) failed++
      else pending++
      if (c.isRetest) retest++
      if (c.isCarryOver) carry++
    }
    const total = cases.length
    return { total, passed, failed, pending, retest, carry }
  }, [cases])

  const funnelSteps = useMemo(() => {
    // Build funnel from sibling rounds in this module. Dedupe by roundNumber
    // (the seed data sometimes contains two rounds both numbered 1) so the
    // funnel doesn't render "Round 1 → Round 1" with two different totals.
    const byNumber = new Map()
    for (const r of projectRounds) {
      if (r.module !== round?.module) continue
      const existing = byNumber.get(r.roundNumber)
      // Prefer the newest if there's a tie.
      if (!existing || (r.startDate || '') > (existing.startDate || '')) {
        byNumber.set(r.roundNumber, r)
      }
    }
    const siblings = [...byNumber.values()].sort(
      (a, b) => (a.roundNumber || 0) - (b.roundNumber || 0)
    )
    return siblings.map((r) => {
      // For the round currently open, use the ground-truth derived stats.
      // For siblings we have to trust the (drifty) stored counters because
      // we don't have their case lists loaded.
      const isCurrent = r.id === roundId
      const total = isCurrent ? currentStats.total : r.totalCases || 0
      const rawPassed = isCurrent ? currentStats.passed : r.passed || 0
      const rawFailed = isCurrent ? currentStats.failed : r.failed || 0
      const clampedPassed = Math.max(0, Math.min(rawPassed, total))
      const clampedFailed = Math.max(0, Math.min(rawFailed, Math.max(0, total - clampedPassed)))
      return {
        roundNumber: r.roundNumber,
        total,
        passed: clampedPassed,
        failed: clampedFailed,
        date: r.startDate,
        testerName: tester?.name,
      }
    })
  }, [projectRounds, round?.module, roundId, currentStats, tester])

  const allPassed = funnelSteps.length > 0 && funnelSteps.every((s) => s.failed === 0 && s.passed === s.total)
  const daysElapsed = funnelSteps.length * 2

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
