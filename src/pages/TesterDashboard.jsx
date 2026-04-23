import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, ChevronRight, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import { watchRounds, listTestCasesForRound } from '../services/firebaseService'
import { TESTCASE_STATUS, ROUND_STATUS } from '../utils/constants'
import { isoDate, pct, fmtDate } from '../utils/helpers'
import EmptyState from '../components/common/EmptyState.jsx'
import Badge from '../components/common/Badge.jsx'
import ProgressRing from '../components/common/ProgressRing.jsx'

export default function TesterDashboard() {
  const { profile } = useAuth()
  const { selected } = useProject()
  const [rounds, setRounds] = useState([])
  const [roundCases, setRoundCases] = useState({})

  useEffect(() => {
    if (!selected?.id || !profile?.uid) return setRounds([])
    const off = watchRounds(selected.id, (all) => {
      setRounds(all.filter((r) => r.assignedTo === profile.uid && r.status === ROUND_STATUS.ACTIVE))
    })
    return () => off && off()
  }, [selected?.id, profile?.uid])

  useEffect(() => {
    rounds.forEach(async (r) => {
      if (roundCases[r.id]) return
      const cases = await listTestCasesForRound(r.id)
      setRoundCases((prev) => ({ ...prev, [r.id]: cases }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds])

  const today = isoDate()

  const summary = useMemo(() => {
    const agg = { total: 0, passed: 0, failed: 0, pending: 0, retest: 0, carry: 0 }
    for (const r of rounds) {
      const cases = (roundCases[r.id] || []).filter((c) => c.batchDate === today)
      agg.total += cases.length
      for (const c of cases) {
        if (c.status === TESTCASE_STATUS.PASSED) agg.passed++
        else if (c.status === TESTCASE_STATUS.FAILED) agg.failed++
        else agg.pending++
        if (c.isRetest) agg.retest++
        if (c.isCarryOver) agg.carry++
      }
    }
    return agg
  }, [rounds, roundCases, today])

  if (!selected) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-8">
        <EmptyState icon={PlayCircle} title="No project selected" description="Pick a project from the top bar." />
      </div>
    )
  }

  if (rounds.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-8">
        <header className="mb-8">
          <h1 className="text-h1 mb-1">Today's Batch</h1>
          <p className="text-body-lg text-ink-muted">Run through assigned test cases and report bugs as you go.</p>
        </header>
        <EmptyState
          icon={PlayCircle}
          title="Nothing to test yet"
          description="You have no active rounds on this project. Ask your developer to assign one."
        />
      </div>
    )
  }

  const progress = pct(summary.passed + summary.failed, summary.total)

  return (
    <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
      <header>
        <h1 className="text-h1 mb-1">Today's Batch</h1>
        <p className="text-body-lg text-ink-muted">
          {fmtDate(new Date(), 'EEEE, MMMM d')} — {summary.total} cases on your plate
          {summary.carry > 0 && (
            <span className="text-tertiary">
              {' '}({summary.total - summary.carry - summary.retest} new + {summary.carry} carry-over
              {summary.retest > 0 ? ` + ${summary.retest} retest` : ''})
            </span>
          )}
        </p>
      </header>

      {summary.carry > 0 && (
        <div className="flex items-start gap-3 bg-tertiary/10 border border-tertiary/30 rounded-md p-4">
          <AlertTriangle className="text-tertiary mt-0.5 shrink-0" size={18} />
          <div className="flex-1 text-body-md">
            <div className="font-medium text-tertiary">
              {summary.carry} overdue cases were rolled forward into today
            </div>
            <div className="text-ink-muted mt-0.5">
              These were left pending from earlier days. They show up first in the sequence so you can
              knock them out and catch back up.
            </div>
          </div>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="label-sm mb-1">Today's progress</div>
            <div className="text-h2">
              {summary.passed + summary.failed}<span className="text-ink-dim">/{summary.total}</span>
            </div>
          </div>
          <ProgressRing size={80} strokeWidth={7} progress={progress} showLabel />
        </div>
        <div className="h-2 rounded-full bg-surface-low overflow-hidden flex">
          <div className="h-full bg-secondary" style={{ width: `${pct(summary.passed, summary.total)}%` }} />
          <div className="h-full bg-danger" style={{ width: `${pct(summary.failed, summary.total)}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-4 mt-5">
          <Stat icon={CheckCircle2} tone="secondary" label="Passed" value={summary.passed} />
          <Stat icon={XCircle} tone="danger" label="Failed" value={summary.failed} />
          <Stat icon={Clock} tone="tertiary" label="Pending" value={summary.pending} />
          <Stat icon={History} tone="tertiary" label="Carry-over" value={summary.carry} />
          <Stat icon={RefreshCw} tone="primary" label="Retests" value={summary.retest} />
        </div>
      </div>

      {summary.retest > 0 && (
        <div className="flex items-center gap-3 bg-primary-container/10 border border-primary/30 rounded-md p-4">
          <AlertTriangle className="text-primary" size={18} />
          <div className="flex-1">
            <div className="font-medium">{summary.retest} fixed bugs waiting for retest</div>
            <div className="text-body-md text-ink-muted">They've been injected into today's timeline.</div>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-h3 mb-3">Active rounds</h2>
        <div className="space-y-3">
          {rounds.map((r) => {
            const cases = roundCases[r.id] || []
            const todayCount = cases.filter((c) => c.batchDate === today).length
            const first = cases
              .filter((c) => c.batchDate === today && c.status === TESTCASE_STATUS.PENDING)
              .sort((a, b) => (a.isRetest === b.isRetest ? 0 : a.isRetest ? -1 : 1))[0]
            return (
              <Link
                key={r.id}
                to={`/rounds/${r.id}/execute`}
                className="card card-hover flex items-center gap-4 p-5"
              >
                <div className="w-11 h-11 rounded bg-primary-container/20 flex items-center justify-center text-primary">
                  <PlayCircle size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-body-md text-ink-muted">
                    {todayCount} cases today{' '}
                    {first ? <>• next: <span className="font-mono text-primary">{first.testId}</span></> : ''}
                  </div>
                </div>
                <Badge tone="primary">Round {r.roundNumber}</Badge>
                <ChevronRight className="text-ink-dim" size={18} />
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Stat({ icon: Icon, tone, label, value }) {
  const classes =
    tone === 'secondary'
      ? 'text-secondary bg-secondary/15'
      : tone === 'danger'
      ? 'text-danger bg-danger/15'
      : tone === 'tertiary'
      ? 'text-tertiary bg-tertiary/15'
      : 'text-primary bg-primary/15'
  return (
    <div className="flex items-center gap-3">
      <div className={['w-9 h-9 rounded flex items-center justify-center', classes].join(' ')}>
        <Icon size={16} />
      </div>
      <div>
        <div className="text-h3 font-semibold leading-none">{value}</div>
        <div className="text-[11px] text-ink-dim uppercase tracking-wider mt-1">{label}</div>
      </div>
    </div>
  )
}
