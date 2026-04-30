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
  SkipForward,
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
  const [phase, setPhase] = useState('idle') // 'idle' | 'running' | 'confirm-pass'
  const [note, setNote] = useState('')
  // Frozen elapsed time at the moment the tester clicks PASS, so the time
  // doesn't keep ticking while they write a note.
  const [pendingTaken, setPendingTaken] = useState(0)
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
        // Heal: an earlier build wrote status='skipped' as a terminal status.
        // Skip is now a non-mutating "do later" action; revert any stuck-
        // skipped cases so testers can re-open them.
        for (const tc of all) {
          if (tc.status === 'skipped') {
            await updateTestCase(tc.id, { status: TESTCASE_STATUS.PENDING })
          }
        }
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

  const isComplete =
    !!current &&
    (current.status === TESTCASE_STATUS.PASSED ||
      current.status === TESTCASE_STATUS.FAILED)

  // Persist the in-flight timer to localStorage so a reload (or accidental
  // tab close) doesn't reset progress. Keyed per round+case so switching to a
  // different test doesn't pick up a stale session.
  const sessionKey = current ? `td_run_${roundId}_${current.id}` : null
  const SESSION_TTL_MS = 6 * 60 * 60 * 1000 // 6h sanity cap

  useEffect(() => {
    if (!current) return
    setPhase('idle')
    setElapsed(0)
    setNote('')
    setPendingTaken(0)
    // Don't restore a running session for an already-completed case.
    if (isComplete) return
    const key = `td_run_${roundId}_${current.id}`
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const { startedAt: ts } = JSON.parse(raw)
        if (typeof ts === 'number' && Date.now() - ts < SESSION_TTL_MS) {
          startedAt.current = ts
          setElapsed(Math.floor((Date.now() - ts) / 1000))
          setPhase('running')
          return
        }
        localStorage.removeItem(key)
      } catch {
        localStorage.removeItem(key)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, current?.id, isComplete])

  function handleStart() {
    if (!current || phase !== 'idle') return
    const ts = Date.now()
    startedAt.current = ts
    if (sessionKey) {
      localStorage.setItem(sessionKey, JSON.stringify({ startedAt: ts }))
    }
    setElapsed(0)
    setPhase('running')
  }

  // PASS is a two-step confirm so the tester can optionally jot a note.
  // Click PASS → freeze the timer, swap the footer to a note + Confirm panel.
  function startConfirmPass() {
    if (!current || phase !== 'running') return
    const taken = Math.floor((Date.now() - startedAt.current) / 1000)
    setPendingTaken(taken)
    setPhase('confirm-pass')
  }

  function cancelConfirmPass() {
    if (phase !== 'confirm-pass') return
    setPhase('running')
  }

  async function confirmPass() {
    if (!current || phase !== 'confirm-pass') return
    const trimmedNote = note.trim()
    try {
      await updateTestCase(current.id, {
        status: TESTCASE_STATUS.PASSED,
        executedAt: new Date(),
        executedBy: profile.uid,
        timeTakenSeconds: pendingTaken,
        testerNotes: trimmedNote || null,
      })
      await incrementRoundCounts(roundId, { passed: 1, pending: -1 })
      if (sessionKey) localStorage.removeItem(sessionKey)
      const suffix = trimmedNote ? ' · note saved' : ''
      toast.success(`${current.testId} passed · ${fmtTime(pendingTaken)}${suffix}`)
      advance()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function startFail() {
    if (!current || phase !== 'running') return
    setDrawerOpen(true)
  }

  // Skip leaves the case PENDING (or RETEST) — the tester can come back to
  // it any time today, and if they don't, the carry-over pass on next mount
  // will roll it into tomorrow's batch like any other untested case.
  function markSkip() {
    if (!current || isComplete) return
    if (sessionKey) localStorage.removeItem(sessionKey)
    setPhase('idle')
    setElapsed(0)
    setNote('')
    toast(`${current.testId} skipped — back to it later`)
    advance()
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
      if (sessionKey) localStorage.removeItem(sessionKey)
      setDrawerOpen(false)
      toast.success(`${current.testId} failed · ${fmtTime(taken)}`)
      advance()
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
                {isComplete ? (
                  <div className="flex gap-4 items-stretch">
                    <div
                      className={[
                        'flex-1 h-14 px-4 rounded border flex items-center gap-3',
                        current.status === TESTCASE_STATUS.PASSED
                          ? 'border-secondary/50 bg-secondary-container/15 text-secondary'
                          : 'border-danger/50 bg-danger-container/15 text-danger',
                      ].join(' ')}
                    >
                      {current.status === TESTCASE_STATUS.PASSED ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <XCircle size={18} />
                      )}
                      <span className="text-[15px] font-semibold uppercase tracking-wide">
                        {current.status === TESTCASE_STATUS.PASSED ? 'Passed' : 'Failed'}
                      </span>
                      {Number.isFinite(current.timeTakenSeconds) && (
                        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-body-md text-ink-muted">
                          <Clock size={14} />
                          {fmtTime(current.timeTakenSeconds)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={advance}
                      className="btn h-14 px-6 text-[15px] font-semibold bg-primary-container hover:brightness-110 text-white rounded"
                    >
                      Next test <ChevronRight size={18} />
                    </button>
                  </div>
                ) : phase === 'idle' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={handleStart}
                      className="btn flex-1 h-14 text-[16px] font-semibold bg-primary-container hover:brightness-110 text-white rounded"
                    >
                      <Play size={20} /> START TEST
                    </button>
                    <button
                      onClick={markSkip}
                      className="btn h-14 px-5 text-[14px] font-semibold border border-outline-variant/60 text-ink-muted hover:text-ink hover:border-tertiary/60 hover:bg-tertiary/10 rounded"
                    >
                      <SkipForward size={16} /> Skip
                    </button>
                  </div>
                ) : phase === 'confirm-pass' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-secondary text-body-md">
                      <CheckCircle2 size={16} />
                      <span className="font-semibold">Marking as passed</span>
                      <span className="text-ink-dim">·</span>
                      <span className="font-mono text-ink-muted">{fmtTime(pendingTaken)}</span>
                    </div>
                    <textarea
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note (optional) — e.g. tested only on Pixel 8, slow network"
                      rows={2}
                      className="input w-full min-h-[60px] resize-y text-body-md"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={cancelConfirmPass}
                        className="btn h-14 px-5 text-[14px] font-semibold border border-outline-variant/60 text-ink-muted hover:text-ink rounded"
                      >
                        Back
                      </button>
                      <button
                        onClick={confirmPass}
                        className="btn flex-1 h-14 text-[16px] font-semibold bg-secondary-container hover:brightness-110 text-white rounded"
                      >
                        <CheckCircle2 size={20} /> Submit pass
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={startConfirmPass}
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
                    <button
                      onClick={markSkip}
                      className="btn h-14 px-5 text-[14px] font-semibold border border-outline-variant/60 text-ink-muted hover:text-ink hover:border-tertiary/60 hover:bg-tertiary/10 rounded"
                    >
                      <SkipForward size={16} /> Skip
                    </button>
                  </div>
                )}
              </div>

              <div className="max-w-3xl mx-auto flex items-center gap-6 mt-3 text-[12px] text-ink-dim">
                {phase === 'running' && !isComplete && (
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
