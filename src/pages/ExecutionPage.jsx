import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  User as UserIcon,
  Smartphone,
  Settings,
  HelpCircle,
  ArrowLeft,
  Play,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import {
  getRound,
  watchTestCasesForRound,
  updateTestCase,
  incrementRoundCounts,
  listTestCasesForRound,
} from '../services/firebaseService'
import { computeCarryOvers } from '../services/batchSplitter'
import { TESTCASE_STATUS } from '../utils/constants'
import { isoDate, fmtTime, pct } from '../utils/helpers'
import TestTimeline from '../components/execution/TestTimeline.jsx'
import TestCard from '../components/execution/TestCard.jsx'
import BugReportDrawer from '../components/execution/BugReportDrawer.jsx'
import toast from 'react-hot-toast'

export default function ExecutionPage() {
  const { roundId } = useParams()
  const { profile } = useAuth()
  const { selected } = useProject()
  const navigate = useNavigate()

  const [round, setRound] = useState(null)
  const [cases, setCases] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState('idle') // 'idle' | 'running' | 'done'
  const [finalElapsed, setFinalElapsed] = useState(0)
  const startedAt = useRef(null)

  useEffect(() => {
    getRound(roundId).then(setRound)
    const off = watchTestCasesForRound(roundId, (list) => {
      list.sort((a, b) => {
        if (a.batchDay !== b.batchDay) return a.batchDay - b.batchDay
        const ao = a.batchOrder, bo = b.batchOrder
        if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo
        return (a.testId || '').localeCompare(b.testId || '')
      })
      setCases(list)
    })
    // One-shot: run carry-over on mount
    ;(async () => {
      try {
        const all = await listTestCasesForRound(roundId)
        const patches = computeCarryOvers(all, isoDate())
        for (const p of patches) {
          const { id, ...rest } = p
          await updateTestCase(id, rest)
        }
      } catch (e) {
        // ignore; likely no firebase yet
      }
    })()
    return () => off && off()
  }, [roundId])

  useEffect(() => {
    if (phase !== 'running') return
    const i = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000
    )
    return () => clearInterval(i)
  }, [phase])

  const today = isoDate()
  const todayCases = useMemo(() => cases.filter((c) => c.batchDate === today), [cases, today])
  const todayPending = todayCases.filter((c) => c.status === TESTCASE_STATUS.PENDING || c.status === TESTCASE_STATUS.RETEST)
  const todayDone = todayCases.filter((c) => c.status === TESTCASE_STATUS.PASSED || c.status === TESTCASE_STATUS.FAILED)
  const current = useMemo(() => {
    if (currentId) return todayCases.find((c) => c.id === currentId) || todayPending[0]
    return todayPending[0]
  }, [currentId, todayCases, todayPending])

  useEffect(() => {
    if (current && !currentId) setCurrentId(current.id)
  }, [current, currentId])

  // Reset phase + timer whenever the active test case changes.
  // (startedAt ref is overwritten on Start, so it doesn't need a reset here.)
  const [prevTestId, setPrevTestId] = useState(null)
  const newTestId = current?.id ?? null
  if (newTestId !== prevTestId) {
    setPrevTestId(newTestId)
    setPhase('idle')
    setElapsed(0)
    setFinalElapsed(0)
  }

  function handleStart() {
    if (!current || phase !== 'idle') return
    startedAt.current = Date.now()
    setElapsed(0)
    setPhase('running')
  }

  async function markPass() {
    if (!current || phase !== 'running') return
    const taken = Math.floor((Date.now() - startedAt.current) / 1000)
    try {
      await updateTestCase(current.id, {
        status: TESTCASE_STATUS.PASSED,
        executedAt: new Date(),
        executedBy: profile.uid,
        timeTakenSeconds: taken,
      })
      await incrementRoundCounts(roundId, { passed: 1, pending: -1 })
      setFinalElapsed(taken)
      setPhase('done')
      toast.success(`${current.testId} passed`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  function startFail() {
    if (!current || phase !== 'running') return
    setDrawerOpen(true)
  }

  async function onBugSubmitted() {
    if (!current) return
    const taken = Math.floor((Date.now() - startedAt.current) / 1000)
    try {
      await updateTestCase(current.id, {
        status: TESTCASE_STATUS.FAILED,
        executedAt: new Date(),
        executedBy: profile.uid,
        timeTakenSeconds: taken,
      })
      await incrementRoundCounts(roundId, { failed: 1, pending: -1 })
      setDrawerOpen(false)
      setFinalElapsed(taken)
      setPhase('done')
    } catch (err) {
      toast.error(err.message)
    }
  }

  function advance() {
    const remaining = todayPending.filter((c) => c.id !== current?.id)
    if (remaining.length === 0) {
      toast.success("Today's batch complete!")
      setCurrentId(null)
      return
    }
    setCurrentId(remaining[0].id)
  }

  if (!round) {
    return (
      <div className="h-full flex items-center justify-center text-ink-dim">Loading round…</div>
    )
  }

  const doneCount = todayDone.length
  const totalToday = todayCases.length
  const progress = pct(doneCount, totalToday)
  const testNumber = doneCount + (current ? 1 : 0)

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Top bar */}
      <div className="h-[56px] border-b border-outline-variant/50 flex items-center gap-3 px-5 shrink-0">
        <Link to="/rounds" className="btn btn-sm btn-ghost w-8 p-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2 text-body-md text-ink-muted">
          <span>Round {round.roundNumber}</span>
          <ChevronRight size={14} />
          <span className="text-primary font-medium">{round.name}</span>
        </div>
        <div className="flex-1 flex items-center gap-4 justify-center">
          <span className="text-body-md text-ink-muted">
            Test <span className="text-ink font-semibold">{testNumber}</span> of{' '}
            <span className="text-ink font-semibold">{totalToday}</span>
          </span>
          <div className="flex-1 max-w-md h-1.5 rounded-full bg-surface-low overflow-hidden">
            <div
              className="h-full bg-primary-container transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-body-md text-ink-dim">{progress}%</span>
        </div>
        <button className="btn btn-sm btn-ghost w-8 p-0"><Settings size={16} /></button>
        <button className="btn btn-sm btn-ghost w-8 p-0"><HelpCircle size={16} /></button>
      </div>

      <div className="flex-1 flex min-h-0">
        <TestTimeline
          cases={todayCases}
          currentId={current?.id}
          onSelect={(tc) => setCurrentId(tc.id)}
          version={selected?.code ? `${selected.code} v${round.roundNumber}.0` : null}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto py-8 px-8">
            <div className="max-w-3xl mx-auto">
              {current ? (
                <TestCard tc={current} linkedBug={null} />
              ) : (
                <div className="card p-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-secondary/20 text-secondary flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={24} />
                  </div>
                  <h2 className="text-h2 mb-2">Today's batch complete</h2>
                  <p className="text-body-md text-ink-muted mb-5">
                    You've finished {doneCount} of {totalToday} cases. Great work.
                  </p>
                  <button onClick={() => navigate('/my-tests')} className="btn btn-md btn-secondary">
                    Back to dashboard
                  </button>
                </div>
              )}
            </div>
          </div>

          {current && (
            <div className="border-t border-outline-variant/50 px-8 py-4 shrink-0">
              <div className="max-w-3xl mx-auto">
                {phase === 'idle' && (
                  <button
                    onClick={handleStart}
                    className="btn w-full h-14 text-[16px] font-semibold bg-primary-container hover:brightness-110 text-white rounded"
                  >
                    <Play size={20} /> START TEST
                  </button>
                )}

                {phase === 'running' && (
                  <div className="flex gap-4">
                    <button
                      onClick={markPass}
                      className="btn flex-1 h-14 text-[16px] font-semibold bg-secondary-container hover:brightness-110 text-white rounded"
                    >
                      <CheckCircle2 size={20} /> PASS
                    </button>
                    <button
                      onClick={startFail}
                      className="btn flex-1 h-14 text-[16px] font-semibold bg-danger-container hover:brightness-110 text-white rounded"
                    >
                      <XCircle size={20} /> FAIL
                    </button>
                  </div>
                )}

                {phase === 'done' && (
                  <div className="flex gap-4 items-stretch">
                    <div className="flex-1 h-14 px-4 rounded border border-outline-variant/60 bg-surface-low flex items-center gap-3">
                      <Clock size={16} className="text-ink-muted" />
                      <span className="text-body-md text-ink-muted">Time taken</span>
                      <span className="ml-auto font-mono text-h3 text-ink">{fmtTime(finalElapsed)}</span>
                    </div>
                    <button
                      onClick={advance}
                      className="btn h-14 px-6 text-[15px] font-semibold bg-primary-container hover:brightness-110 text-white rounded"
                    >
                      Next test <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="max-w-3xl mx-auto flex items-center gap-6 mt-3 text-[12px] text-ink-dim">
                {phase === 'running' && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} /> Elapsed: <span className="font-mono text-ink-muted">{fmtTime(elapsed)}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <UserIcon size={12} /> Tester: <span className="text-ink-muted">{profile?.name}</span>
                </span>
                {current.isRetest && (
                  <span className="flex items-center gap-1.5 text-primary">
                    <Smartphone size={12} /> Retest injected
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {drawerOpen && current && (
        <BugReportDrawer
          testCase={current}
          round={round}
          onClose={() => setDrawerOpen(false)}
          onSubmitted={onBugSubmitted}
        />
      )}
    </div>
  )
}
