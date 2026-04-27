import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, ChevronRight, History, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
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

      <section className="space-y-6">
        <h2 className="text-h3">Active rounds</h2>
        {rounds.map((r) => {
          const cases = roundCases[r.id] || []
          const days = groupByDay(cases, today)
          const todayCount = cases.filter((c) => c.batchDate === today).length
          const first = cases
            .filter((c) => c.batchDate === today && c.status === TESTCASE_STATUS.PENDING)
            .sort((a, b) => (a.isRetest === b.isRetest ? 0 : a.isRetest ? -1 : 1))[0]
          return (
            <div key={r.id} className="card overflow-hidden">
              <Link
                to={`/rounds/${r.id}/execute`}
                className="flex items-center gap-4 p-5 hover:bg-surface-high/30 transition-colors"
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
              {days.length > 0 && (
                <div className="border-t border-outline-variant/40">
                  <div className="px-5 py-3 flex items-baseline justify-between">
                    <div className="label-sm">Schedule</div>
                    <div className="text-[11px] text-ink-dim">
                      Only today is unlocked. Future days open on their date.
                    </div>
                  </div>
                  <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {days.map((d) => (
                      <DayCell key={d.date} day={d} roundId={r.id} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}

// Build a sorted-by-date list of { date, dayNumber, total, passed, failed,
// pending, when } for one round's cases. `when` is 'past' | 'today' | 'future'.
function groupByDay(cases, todayStr) {
  const map = new Map()
  for (const c of cases) {
    if (!c.batchDate) continue
    if (!map.has(c.batchDate)) {
      map.set(c.batchDate, {
        date: c.batchDate,
        dayNumber: c.batchDay || 0,
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
      })
    }
    const d = map.get(c.batchDate)
    d.total++
    if (c.status === TESTCASE_STATUS.PASSED) d.passed++
    else if (c.status === TESTCASE_STATUS.FAILED) d.failed++
    else d.pending++
    // batchDay drifts when carry-over rewrites batchDate; keep the smallest
    // observed batchDay for the date so labels stay stable.
    if (c.batchDay && (!d.dayNumber || c.batchDay < d.dayNumber)) {
      d.dayNumber = c.batchDay
    }
  }
  const out = [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  return out.map((d, i) => ({
    ...d,
    dayNumber: d.dayNumber || i + 1,
    when: d.date < todayStr ? 'past' : d.date === todayStr ? 'today' : 'future',
  }))
}

function DayCell({ day, roundId }) {
  const isToday = day.when === 'today'
  const isPast = day.when === 'past'
  const isFuture = day.when === 'future'
  const done = day.passed + day.failed
  const progress = pct(done, day.total)

  const inner = (
    <>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="label-sm">Day {day.dayNumber}</div>
        <div className="font-mono text-[11px] text-ink-dim">
          {format(parseISO(day.date), 'MMM d')}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-h3 font-bold">{day.total}</div>
        <div className="text-[11px] text-ink-dim">cases</div>
      </div>
      {isPast && (
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="text-secondary">{day.passed} passed</span>
          {day.failed > 0 && <span className="text-danger">{day.failed} failed</span>}
          {day.pending > 0 && <span className="text-tertiary">{day.pending} skipped</span>}
        </div>
      )}
      {isToday && (
        <>
          <div className="mt-2 h-1 rounded-full bg-surface-low overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-primary font-semibold">
            <PlayCircle size={11} /> {done}/{day.total} · open
          </div>
        </>
      )}
      {isFuture && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-dim">
          <Lock size={11} /> Locked
        </div>
      )}
    </>
  )

  const baseClass = 'rounded-md border p-3 transition-colors block'
  if (isToday) {
    return (
      <Link
        to={`/rounds/${roundId}/execute`}
        className={[baseClass, 'border-primary bg-primary-container/15 hover:bg-primary-container/25'].join(' ')}
      >
        {inner}
      </Link>
    )
  }
  return (
    <div
      className={[
        baseClass,
        isPast
          ? 'border-outline-variant/40 bg-surface-low/40'
          : 'border-outline-variant/40 bg-surface-low/20 opacity-60',
      ].join(' ')}
    >
      {inner}
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
