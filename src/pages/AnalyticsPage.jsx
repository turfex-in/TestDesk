import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Bug,
  Clock,
  Wrench,
  TrendingUp,
  AlertTriangle,
  History,
  Hourglass,
  Sparkles,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { evaluateTesterEffectiveness, aiReady } from '../services/aiService'
import Avatar from '../components/common/Avatar.jsx'
import { useProject } from '../context/ProjectContext.jsx'
import {
  listTestCasesForProject,
  listBugsForProject,
  listRounds,
  listUsers,
} from '../services/firebaseService'
import { TESTCASE_STATUS, BUG_STATUS, BUG_STATUS_LABEL } from '../utils/constants'
import { fmtTime, pct } from '../utils/helpers'
import Badge from '../components/common/Badge.jsx'
import EmptyState from '../components/common/EmptyState.jsx'

export default function AnalyticsPage() {
  const { selected } = useProject()
  const [searchParams] = useSearchParams()
  const scopeRoundId = searchParams.get('round') || null
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState([])
  const [bugs, setBugs] = useState([])
  const [rounds, setRounds] = useState([])
  const [users, setUsers] = useState([])
  const [aiEvals, setAiEvals] = useState(null) // null = not run, [] = empty, [...] = results
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!selected?.id) {
      setCases([])
      setBugs([])
      setRounds([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      listTestCasesForProject(selected.id),
      listBugsForProject(selected.id),
      listRounds(selected.id),
      listUsers(),
    ])
      .then(([tcs, bgs, rds, usrs]) => {
        if (cancelled) return
        setCases(tcs)
        setBugs(bgs)
        setRounds(rds)
        setUsers(usrs)
      })
      .catch(() => {
        // swallow — empty state will render
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected?.id])

  const stats = useMemo(
    () => computeStats(cases, bugs, users, rounds, scopeRoundId),
    [cases, bugs, users, rounds, scopeRoundId]
  )

  const scopeRound = useMemo(
    () => (scopeRoundId ? rounds.find((r) => r.id === scopeRoundId) || null : null),
    [rounds, scopeRoundId]
  )
  const scopeTester = useMemo(
    () => (scopeRound ? users.find((u) => u.uid === scopeRound.assignedTo) || null : null),
    [scopeRound, users]
  )

  // Reset any cached AI assessment when the scope changes — the underlying
  // numbers are different so a stale evaluation would mislead.
  useEffect(() => {
    setAiEvals(null)
  }, [scopeRoundId, selected?.id])

  async function runAiAssessment() {
    if (aiLoading) return
    if (!stats.testers.length) {
      toast.error('No tester activity to evaluate yet.')
      return
    }
    setAiLoading(true)
    try {
      const n = stats.testers.length
      const teamBaselines = {
        avg_cases_per_tester: Math.round(
          stats.testers.reduce((a, t) => a + t.cases, 0) / n
        ),
        avg_pass_rate_pct: Math.round(
          stats.testers.reduce((a, t) => a + t.passRate, 0) / n
        ),
        avg_seconds_per_case: stats.avgSecPerCase,
        avg_bugs_per_tester: Math.round(
          stats.testers.reduce((a, t) => a + t.bugsReported, 0) / n
        ),
        avg_active_days: Math.round(
          stats.testers.reduce((a, t) => a + t.activeDays, 0) / n
        ),
        avg_active_minutes: Math.round(
          stats.testers.reduce((a, t) => a + t.totalActiveMinutes, 0) / n
        ),
        avg_description_length_chars: Math.round(
          stats.testers.reduce((a, t) => a + t.avgDescLen, 0) / n
        ),
      }
      const payload = {
        projectName: selected?.name || 'Unknown',
        teamBaselines,
        testers: stats.testers.map((t) => ({
          name: t.name,
          cases_executed: t.cases,
          pass_rate_pct: t.passRate,
          avg_seconds_per_case: t.avgSec,
          active_days: t.activeDays,
          total_active_minutes: t.totalActiveMinutes,
          bugs_reported: t.bugsReported,
          bugs_critical: t.bugsCritical,
          bugs_high: t.bugsHigh,
          bugs_fixed: t.bugsFixed,
          bugs_backlogged: t.bugsBacklogged,
          bug_fix_rate_pct: t.bugFixRate,
          bug_backlog_rate_pct: t.bugBacklogRate,
          avg_description_length_chars: t.avgDescLen,
          screenshot_attach_rate_pct: t.screenshotPct,
          sample_bugs: t.sampleBugs,
        })),
      }
      const evals = await evaluateTesterEffectiveness(payload)
      setAiEvals(evals)
    } catch (err) {
      toast.error(err.message || 'Could not get AI assessment')
    } finally {
      setAiLoading(false)
    }
  }

  if (!selected) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8">
        <EmptyState
          icon={BarChart3}
          title="No project selected"
          description="Pick a project from the top bar to see its analytics."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8 text-ink-dim">Loading analytics…</div>
    )
  }

  if (cases.length === 0 && bugs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-8">
        <header className="mb-6">
          <h1 className="text-h1 mb-1">Analytics</h1>
          <p className="text-body-lg text-ink-muted">{selected.name}</p>
        </header>
        <EmptyState
          icon={BarChart3}
          title="Nothing to analyze yet"
          description="Run a few test cases and report some bugs — analytics will populate as soon as there's data."
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
      <header>
        {scopeRoundId && (
          <Link
            to="/analytics"
            className="text-[12px] text-ink-dim hover:text-primary inline-flex items-center gap-1 mb-2"
          >
            ← Project analytics
          </Link>
        )}
        <h1 className="text-h1 mb-1">
          {scopeRound ? scopeRound.name : 'Analytics'}
        </h1>
        <p className="text-body-lg text-ink-muted">
          {scopeRound ? (
            <>
              {selected.name} · Lead:{' '}
              <span className="text-ink">{scopeTester?.name || '—'}</span>
              {' · '}
              {stats.executed} executed · {stats.bugsTotal} bug
              {stats.bugsTotal === 1 ? '' : 's'}
            </>
          ) : (
            <>
              {selected.name} · {rounds.length} round{rounds.length === 1 ? '' : 's'} ·{' '}
              {cases.length} test case{cases.length === 1 ? '' : 's'} · {bugs.length} bug
              {bugs.length === 1 ? '' : 's'}
            </>
          )}
        </p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={CheckCircle2}
          tone="secondary"
          label="Pass rate"
          value={`${stats.passRate}%`}
          sub={`${stats.passed} / ${stats.executed} executed`}
        />
        <KpiCard
          icon={Bug}
          tone="danger"
          label="Open bugs"
          value={stats.bugsOpen}
          sub={`${stats.bugsTotal} total · ${stats.bugsFixed} fixed · ${stats.bugsBacklog} backlog`}
        />
        <KpiCard
          icon={Clock}
          tone="primary"
          label="Avg time / test"
          value={stats.avgSecPerCase ? fmtTime(stats.avgSecPerCase) : '—'}
          sub={`${stats.casesWithTime} cases timed`}
        />
        <KpiCard
          icon={Wrench}
          tone="tertiary"
          label="Avg time to fix"
          value={stats.avgFixHours != null ? `${stats.avgFixHours}h` : '—'}
          sub={`${stats.fixedWithDuration} bugs measured`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Test execution mix">
          <StackBar
            segments={[
              { label: 'Passed', value: stats.passed, tone: 'secondary' },
              { label: 'Failed', value: stats.failed, tone: 'danger' },
              { label: 'Retest', value: stats.retest, tone: 'primary' },
              { label: 'Pending', value: stats.pending, tone: 'tertiary' },
            ]}
          />
        </Card>

        <Card title="Bug status mix">
          <StackBar
            segments={[
              { label: BUG_STATUS_LABEL.open, value: stats.bugStatusCounts.open, tone: 'danger' },
              {
                label: BUG_STATUS_LABEL.in_progress,
                value: stats.bugStatusCounts.in_progress,
                tone: 'tertiary',
              },
              { label: BUG_STATUS_LABEL.fixed, value: stats.bugStatusCounts.fixed, tone: 'secondary' },
              { label: BUG_STATUS_LABEL.retest, value: stats.bugStatusCounts.retest, tone: 'primary' },
              { label: BUG_STATUS_LABEL.closed, value: stats.bugStatusCounts.closed, tone: 'ink-muted' },
              {
                label: BUG_STATUS_LABEL.rejected,
                value: stats.bugStatusCounts.rejected,
                tone: 'ink-dim',
              },
            ]}
          />
        </Card>
      </div>

      <Card
        title="Failure rate by module"
        subtitle="How often a case in this module fails on first execution. High = unstable."
        icon={AlertTriangle}
      >
        {stats.modules.length === 0 ? (
          <Empty text="No executed cases yet." />
        ) : (
          <ul className="space-y-2.5">
            {stats.modules.map((m) => (
              <li key={m.name} className="flex items-center gap-3">
                <div className="w-44 truncate text-body-md">{m.name}</div>
                <div className="flex-1 h-2 rounded-full bg-surface-low overflow-hidden">
                  <div
                    className={[
                      'h-full',
                      m.failRate >= 30
                        ? 'bg-danger'
                        : m.failRate >= 15
                        ? 'bg-tertiary'
                        : 'bg-secondary',
                    ].join(' ')}
                    style={{ width: `${m.failRate}%` }}
                  />
                </div>
                <div className="w-32 text-right text-body-md">
                  <span
                    className={[
                      'font-mono',
                      m.failRate >= 30
                        ? 'text-danger'
                        : m.failRate >= 15
                        ? 'text-tertiary'
                        : 'text-secondary',
                    ].join(' ')}
                  >
                    {m.failRate}%
                  </span>
                  <span className="text-ink-dim ml-2">
                    {m.failed}/{m.executed}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Bug severity mix">
          {stats.bugsTotal === 0 ? (
            <Empty text="No bugs reported." />
          ) : (
            <ul className="space-y-2.5">
              {['Critical', 'High', 'Medium', 'Low'].map((sev) => {
                const n = stats.severityCounts[sev] || 0
                const p = pct(n, stats.bugsTotal)
                return (
                  <li key={sev} className="flex items-center gap-3">
                    <div className="w-20 text-body-md">
                      <Badge
                        tone={
                          sev === 'Critical'
                            ? 'danger'
                            : sev === 'High'
                            ? 'tertiary'
                            : sev === 'Medium'
                            ? 'primary'
                            : 'secondary'
                        }
                        size="sm"
                        dot
                      >
                        {sev}
                      </Badge>
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-surface-low overflow-hidden">
                      <div
                        className={[
                          'h-full',
                          sev === 'Critical'
                            ? 'bg-danger'
                            : sev === 'High'
                            ? 'bg-tertiary'
                            : sev === 'Medium'
                            ? 'bg-primary'
                            : 'bg-secondary',
                        ].join(' ')}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-body-md font-mono">
                      {n}{' '}
                      <span className="text-ink-dim text-[11px]">
                        ({p}%)
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Tester productivity"
          subtitle="Cases executed, pass rate, run time, engagement, and bug-report depth per tester."
          icon={TrendingUp}
        >
          {stats.testers.length === 0 ? (
            <Empty text="No executed cases yet." />
          ) : (
            <table className="w-full text-body-md">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-dim">
                  <th className="pb-2 font-semibold">Tester</th>
                  <th className="pb-2 font-semibold text-right" title="Test cases executed">Cases</th>
                  <th className="pb-2 font-semibold text-right" title="Pass rate">Pass</th>
                  <th className="pb-2 font-semibold text-right" title="Average seconds per case">Avg</th>
                  <th className="pb-2 font-semibold text-right" title="Days active on TestDesk · approx total active time">Active</th>
                  <th className="pb-2 font-semibold text-right" title="Bugs reported · average description length in characters">Bugs</th>
                </tr>
              </thead>
              <tbody>
                {stats.testers.map((t) => (
                  <tr key={t.uid} className="border-t border-outline-variant/30">
                    <td className="py-2 truncate">{t.name}</td>
                    <td className="py-2 text-right font-mono">{t.cases}</td>
                    <td className="py-2 text-right">
                      <span
                        className={[
                          'font-mono',
                          t.passRate >= 80
                            ? 'text-secondary'
                            : t.passRate >= 60
                            ? 'text-tertiary'
                            : 'text-danger',
                        ].join(' ')}
                      >
                        {t.passRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-ink-muted">
                      {t.avgSec ? fmtTime(t.avgSec) : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-[11px] text-ink-muted">
                      {t.activeDays
                        ? (
                          <>
                            <span className="text-ink">{t.activeDays}d</span>
                            <span className="text-ink-dim ml-1">
                              {t.totalActiveMinutes >= 60
                                ? `${Math.round(t.totalActiveMinutes / 60)}h`
                                : `${t.totalActiveMinutes}m`}
                            </span>
                          </>
                        )
                        : '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-[11px]">
                      {t.bugsReported ? (
                        <>
                          <span className="text-ink">{t.bugsReported}</span>
                          <span
                            className={[
                              'ml-1',
                              t.avgDescLen >= 100
                                ? 'text-secondary'
                                : t.avgDescLen >= 40
                                ? 'text-tertiary'
                                : 'text-danger',
                            ].join(' ')}
                            title={`Avg ${t.avgDescLen} chars · ${t.screenshotPct}% with screenshots`}
                          >
                            {t.avgDescLen}c
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-dim">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card
          title="Regressions"
          subtitle="Cases that passed in an earlier round and failed in a later one. The signal you actually want — what broke since last time."
          icon={History}
        >
          {stats.regressions.length === 0 ? (
            <Empty
              text={
                stats.recoveries.length > 0
                  ? `No regressions. ${stats.recoveries.length} case(s) recovered (failed → passed) since the previous round.`
                  : 'No regressions yet — needs at least two rounds with overlapping test IDs to detect anything.'
              }
            />
          ) : (
            <>
              <div className="mb-3 text-body-md text-ink-muted">
                <span className="font-semibold text-danger">{stats.regressions.length}</span>{' '}
                regression{stats.regressions.length === 1 ? '' : 's'} detected
                {stats.recoveries.length > 0 && (
                  <span className="text-ink-dim">
                    {' '}· {stats.recoveries.length} recovered
                  </span>
                )}
              </div>
              <ul className="space-y-2 max-h-[320px] overflow-y-auto">
                {stats.regressions.slice(0, 12).map((r, i) => (
                  <li
                    key={`${r.testId}-${i}`}
                    className="border border-danger/30 bg-danger-container/5 rounded-md px-3 py-2"
                  >
                    <Link
                      to={`/rounds/${r.roundId}?testId=${encodeURIComponent(r.testId)}`}
                      className="block hover:opacity-80"
                    >
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-mono text-[12px] text-primary">{r.testId}</span>
                        <span className="truncate text-body-md flex-1">{r.title}</span>
                      </div>
                      <div className="text-[11px] text-ink-dim">
                        Passed in{' '}
                        <span className="text-secondary">
                          {r.fromRound?.name || `Round ${r.fromRound?.roundNumber || '?'}`}
                        </span>
                        {' → '}
                        Failed in{' '}
                        <span className="text-danger">
                          {r.toRound?.name || `Round ${r.toRound?.roundNumber || '?'}`}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
                {stats.regressions.length > 12 && (
                  <li className="text-[12px] text-ink-dim text-center pt-1">
                    +{stats.regressions.length - 12} more
                  </li>
                )}
              </ul>
            </>
          )}
        </Card>

        <Card
          title="Oldest open bugs"
          subtitle="Bugs sitting in your queue the longest. Triage debt — close, fix, or backlog."
          icon={Hourglass}
        >
          {stats.openBugsAged.length === 0 ? (
            <Empty text="No open bugs. Nice." />
          ) : (
            <ul className="space-y-2 max-h-[320px] overflow-y-auto">
              {stats.openBugsAged.map(({ bug, ageDays }) => (
                <li
                  key={bug.id}
                  className="border border-outline-variant/40 rounded-md px-3 py-2 hover:bg-surface-high/30"
                >
                  <Link to={`/bugs/${bug.id}`} className="block">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-mono text-[12px] text-primary">
                        {bug.bugId || bug.id.slice(0, 6)}
                      </span>
                      <span className="truncate text-body-md flex-1">{bug.title}</span>
                      <span
                        className={[
                          'font-mono text-[12px] shrink-0',
                          ageDays >= 14
                            ? 'text-danger'
                            : ageDays >= 7
                            ? 'text-tertiary'
                            : 'text-ink-muted',
                        ].join(' ')}
                      >
                        {ageDays}d
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-dim flex items-center gap-2">
                      <Badge
                        tone={
                          bug.severity === 'Critical'
                            ? 'danger'
                            : bug.severity === 'High'
                            ? 'tertiary'
                            : bug.severity === 'Medium'
                            ? 'primary'
                            : 'secondary'
                        }
                        size="sm"
                      >
                        {bug.severity}
                      </Badge>
                      <span>{BUG_STATUS_LABEL[bug.status] || bug.status}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="AI tester effectiveness"
        subtitle="QA-lead read on each tester. Looks at TestDesk usage time, run speed, and the actual text of recent bug reports — not just volume."
        icon={Sparkles}
      >
        {!aiReady() ? (
          <Empty text="Gemini API key not configured. Set VITE_GEMINI_API_KEY in .env to enable AI assessment." />
        ) : stats.testers.length === 0 ? (
          <Empty text="No tester activity yet." />
        ) : aiEvals === null ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body-md text-ink-muted">
              Sends each tester's metrics to Gemini —{' '}
              <span className="text-ink">cases, pass rate, avg run time,</span>{' '}
              <span className="text-ink">days active on TestDesk, total time spent,</span>{' '}
              <span className="text-ink">bug fix-rate vs backlog-rate,</span>{' '}
              and <span className="text-ink">two recent bug-report descriptions verbatim</span>{' '}
              so it can grade whether reports are detailed or terse "broken"
              one-liners. Returns a 1–10 score, strengths, weaknesses, and a
              concrete action per tester. Burns one API call.
            </p>
            <button
              onClick={runAiAssessment}
              disabled={aiLoading}
              className="btn btn-md btn-primary"
            >
              {aiLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              {aiLoading ? 'Analyzing…' : 'Analyze with AI'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-dim">
                Generated from {stats.testers.length} tester
                {stats.testers.length === 1 ? '' : 's'}. Re-run after fresh data.
              </span>
              <button
                onClick={runAiAssessment}
                disabled={aiLoading}
                className="btn btn-sm btn-ghost"
              >
                {aiLoading ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                Re-run
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {aiEvals.map((e, i) => (
                <TesterEvaluation key={`${e.name}-${i}`} evaluation={e} />
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function TesterEvaluation({ evaluation }) {
  const score = Math.max(1, Math.min(10, Number(evaluation.score) || 0))
  const tone =
    score >= 8 ? 'secondary' : score >= 6 ? 'primary' : score >= 4 ? 'tertiary' : 'danger'
  const ringClass =
    tone === 'secondary'
      ? 'border-secondary/60 bg-secondary-container/15 text-secondary'
      : tone === 'primary'
      ? 'border-primary/60 bg-primary-container/15 text-primary'
      : tone === 'tertiary'
      ? 'border-tertiary/60 bg-tertiary/15 text-tertiary'
      : 'border-danger/60 bg-danger-container/15 text-danger'
  return (
    <div className="border border-outline-variant/40 rounded-md p-4 bg-surface-low/40">
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={evaluation.name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{evaluation.name}</div>
        </div>
        <div
          className={[
            'w-12 h-12 rounded-full border-2 flex items-center justify-center font-mono text-h3 font-bold shrink-0',
            ringClass,
          ].join(' ')}
        >
          {score}
        </div>
      </div>
      {evaluation.strengths?.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim mb-1">Strengths</div>
          <div className="flex flex-wrap gap-1.5">
            {evaluation.strengths.map((s, i) => (
              <Badge key={i} tone="secondary" size="sm" uppercase={false}>
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {evaluation.weaknesses?.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-dim mb-1">Weaknesses</div>
          <div className="flex flex-wrap gap-1.5">
            {evaluation.weaknesses.map((w, i) => (
              <Badge key={i} tone="danger" size="sm" uppercase={false}>
                {w}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {evaluation.recommendation && (
        <div className="mt-3 pt-3 border-t border-outline-variant/30 text-body-md text-ink">
          <span className="text-[10px] uppercase tracking-wider text-ink-dim mr-2">
            Action
          </span>
          {evaluation.recommendation}
        </div>
      )}
    </div>
  )
}

function computeStats(cases, bugs, users, rounds = [], scopeRoundId = null) {
  // When scoped to a round, almost everything filters to that round's
  // cases / bugs. Regression detection is the exception — it needs the
  // full project history to compare across rounds, then filters to ones
  // that landed in this round.
  const scopedCases = scopeRoundId
    ? cases.filter((c) => c.roundId === scopeRoundId)
    : cases
  const scopedBugs = scopeRoundId
    ? bugs.filter((b) => b.roundId === scopeRoundId)
    : bugs

  const passed = scopedCases.filter((c) => c.status === TESTCASE_STATUS.PASSED).length
  const failed = scopedCases.filter((c) => c.status === TESTCASE_STATUS.FAILED).length
  const retest = scopedCases.filter((c) => c.status === TESTCASE_STATUS.RETEST).length
  const pending = scopedCases.filter((c) => c.status === TESTCASE_STATUS.PENDING).length
  const executed = passed + failed
  const passRate = executed ? Math.round((passed / executed) * 100) : 0

  const timed = scopedCases
    .map((c) => Number(c.timeTakenSeconds))
    .filter((s) => Number.isFinite(s) && s > 0)
  const avgSecPerCase = timed.length
    ? Math.round(timed.reduce((a, b) => a + b, 0) / timed.length)
    : 0

  // Failure rate per module (only counts executed cases — pending excluded)
  const moduleMap = new Map()
  for (const c of scopedCases) {
    const key = c.module || '(no module)'
    if (!moduleMap.has(key)) moduleMap.set(key, { name: key, executed: 0, failed: 0 })
    if (c.status === TESTCASE_STATUS.PASSED || c.status === TESTCASE_STATUS.FAILED) {
      const m = moduleMap.get(key)
      m.executed += 1
      if (c.status === TESTCASE_STATUS.FAILED) m.failed += 1
    }
  }
  const modules = [...moduleMap.values()]
    .filter((m) => m.executed > 0)
    .map((m) => ({ ...m, failRate: Math.round((m.failed / m.executed) * 100) }))
    .sort((a, b) => b.failRate - a.failRate || b.failed - a.failed)
    .slice(0, 12)

  // Bug counts by status + severity
  const bugStatusCounts = {
    open: 0,
    in_progress: 0,
    fixed: 0,
    retest: 0,
    closed: 0,
    rejected: 0,
  }
  const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  let bugsFixed = 0
  let bugsBacklog = 0
  for (const b of scopedBugs) {
    if (bugStatusCounts[b.status] != null) bugStatusCounts[b.status] += 1
    if (severityCounts[b.severity] != null) severityCounts[b.severity] += 1
    if (b.status === BUG_STATUS.FIXED) bugsFixed += 1
    if (b.status === BUG_STATUS.REJECTED) bugsBacklog += 1
  }
  const bugsTotal = scopedBugs.length
  const bugsOpen =
    bugStatusCounts.open + bugStatusCounts.in_progress + bugStatusCounts.retest

  // Average time-to-fix (in hours)
  const fixDurations = scopedBugs
    .map((b) => {
      const created = toMillis(b.createdAt)
      const fixed = toMillis(b.fixedAt)
      if (!created || !fixed || fixed < created) return null
      return (fixed - created) / 3600000
    })
    .filter((h) => h != null && h >= 0)
  const avgFixHours = fixDurations.length
    ? Math.round((fixDurations.reduce((a, b) => a + b, 0) / fixDurations.length) * 10) / 10
    : null

  // Tester productivity (only testers who actually executed something)
  const userById = new Map(users.map((u) => [u.uid, u]))
  const testerMap = new Map()
  for (const c of scopedCases) {
    if (c.status !== TESTCASE_STATUS.PASSED && c.status !== TESTCASE_STATUS.FAILED) continue
    if (!c.executedBy) continue
    if (!testerMap.has(c.executedBy)) {
      testerMap.set(c.executedBy, {
        uid: c.executedBy,
        name: userById.get(c.executedBy)?.name || 'Unknown',
        cases: 0,
        passed: 0,
        secs: [],
      })
    }
    const t = testerMap.get(c.executedBy)
    t.cases += 1
    if (c.status === TESTCASE_STATUS.PASSED) t.passed += 1
    const s = Number(c.timeTakenSeconds)
    if (Number.isFinite(s) && s > 0) t.secs.push(s)
  }
  // Per-tester bug-side stats (reported by them within the scope), used by
  // both the productivity card and the AI effectiveness assessment.
  // Also collects raw description samples so the LLM can grade *quality*
  // (not just count) — "broken" vs a structured walkthrough.
  const bugStatsByUid = new Map()
  for (const b of scopedBugs) {
    if (!b.reportedBy) continue
    if (!bugStatsByUid.has(b.reportedBy)) {
      bugStatsByUid.set(b.reportedBy, {
        total: 0,
        critical: 0,
        high: 0,
        fixed: 0,
        backlogged: 0,
        descLengthSum: 0,
        withScreenshots: 0,
        bugs: [],
      })
    }
    const s = bugStatsByUid.get(b.reportedBy)
    s.total += 1
    if (b.severity === 'Critical') s.critical += 1
    else if (b.severity === 'High') s.high += 1
    if (b.status === BUG_STATUS.FIXED || b.status === BUG_STATUS.CLOSED) s.fixed += 1
    if (b.status === BUG_STATUS.REJECTED) s.backlogged += 1
    const description = `${b.actualBehavior || ''} ${b.additionalNotes || ''}`.trim()
    s.descLengthSum += description.length
    if (Array.isArray(b.screenshots) && b.screenshots.length > 0) s.withScreenshots += 1
    s.bugs.push(b)
  }

  // Per-tester engagement: how many distinct days they were active and a
  // rough total active time. Activity events come from test executions,
  // bug reports, and comments. Same-day events form a session — we cap each
  // session at 8 hours so a stray late-night ping doesn't claim a full day.
  const activityByUid = new Map()
  function recordActivity(uid, ts) {
    if (!uid || !ts) return
    if (!activityByUid.has(uid)) activityByUid.set(uid, [])
    activityByUid.get(uid).push(ts)
  }
  for (const c of scopedCases) {
    const ts = toMillis(c.executedAt)
    if (ts && c.executedBy) recordActivity(c.executedBy, ts)
  }
  for (const b of scopedBugs) {
    const ts = toMillis(b.createdAt)
    if (ts && b.reportedBy) recordActivity(b.reportedBy, ts)
  }
  function sessionStatsFor(uid) {
    const events = activityByUid.get(uid) || []
    if (!events.length) return { activeDays: 0, totalMinutes: 0 }
    const byDay = new Map()
    for (const ts of events) {
      const day = new Date(ts).toISOString().slice(0, 10)
      if (!byDay.has(day)) byDay.set(day, [ts, ts])
      const [min, max] = byDay.get(day)
      byDay.set(day, [Math.min(min, ts), Math.max(max, ts)])
    }
    let totalMs = 0
    for (const [, [min, max]] of byDay) {
      // Cap each day at 8h so a single afternoon doesn't bloat to 24h.
      // Floor at 5min so a single-event day still counts as engagement.
      const dur = Math.min(8 * 3600000, Math.max(5 * 60000, max - min))
      totalMs += dur
    }
    return {
      activeDays: byDay.size,
      totalMinutes: Math.round(totalMs / 60000),
    }
  }

  const testers = [...testerMap.values()]
    .map((t) => {
      const bs = bugStatsByUid.get(t.uid) || {
        total: 0,
        critical: 0,
        high: 0,
        fixed: 0,
        backlogged: 0,
        descLengthSum: 0,
        withScreenshots: 0,
        bugs: [],
      }
      const fixRate = bs.total ? Math.round((bs.fixed / bs.total) * 100) : 0
      const backlogRate = bs.total ? Math.round((bs.backlogged / bs.total) * 100) : 0
      const avgDescLen = bs.total ? Math.round(bs.descLengthSum / bs.total) : 0
      const screenshotPct = bs.total ? Math.round((bs.withScreenshots / bs.total) * 100) : 0
      // Two most recent bug-report descriptions, trimmed — the LLM uses
      // these to judge whether reports are useful or terse "broken" notes.
      const sampleBugs = [...bs.bugs]
        .sort((a, b) => (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0))
        .slice(0, 2)
        .map((b) => ({
          severity: b.severity || 'Unknown',
          title: (b.title || '').slice(0, 100),
          description: (b.actualBehavior || '').slice(0, 300),
          has_screenshots: Array.isArray(b.screenshots) && b.screenshots.length > 0,
        }))
      const session = sessionStatsFor(t.uid)
      return {
        uid: t.uid,
        name: t.name,
        cases: t.cases,
        passRate: t.cases ? Math.round((t.passed / t.cases) * 100) : 0,
        avgSec: t.secs.length
          ? Math.round(t.secs.reduce((a, b) => a + b, 0) / t.secs.length)
          : 0,
        bugsReported: bs.total,
        bugsCritical: bs.critical,
        bugsHigh: bs.high,
        bugsFixed: bs.fixed,
        bugsBacklogged: bs.backlogged,
        bugFixRate: fixRate,
        bugBacklogRate: backlogRate,
        avgDescLen,
        screenshotPct,
        sampleBugs,
        activeDays: session.activeDays,
        totalActiveMinutes: session.totalMinutes,
      }
    })
    .sort((a, b) => b.cases - a.cases)

  // Regression detection: a test case (matched by stable testId across
  // rounds) that PASSED in an earlier round and then FAILED in a later one.
  // Recoveries (FAILED → PASSED) are also tracked but separately, so the
  // dev can see "fixed since" alongside "broke since".
  const roundOrder = new Map()
  const sortedRounds = [...rounds].sort(
    (a, b) => (toMillis(a.createdAt) || 0) - (toMillis(b.createdAt) || 0)
  )
  sortedRounds.forEach((r, i) => roundOrder.set(r.id, { index: i, round: r }))

  const byTestId = new Map()
  for (const c of cases) {
    if (!c.testId) continue
    if (c.status !== TESTCASE_STATUS.PASSED && c.status !== TESTCASE_STATUS.FAILED) continue
    if (!byTestId.has(c.testId)) byTestId.set(c.testId, [])
    byTestId.get(c.testId).push(c)
  }

  const regressions = []
  const recoveries = []
  for (const [testId, executions] of byTestId) {
    if (executions.length < 2) continue
    executions.sort(
      (a, b) =>
        (roundOrder.get(a.roundId)?.index ?? -1) -
        (roundOrder.get(b.roundId)?.index ?? -1)
    )
    for (let i = 1; i < executions.length; i++) {
      const prev = executions[i - 1]
      const curr = executions[i]
      const prevRound = roundOrder.get(prev.roundId)?.round
      const currRound = roundOrder.get(curr.roundId)?.round
      if (
        prev.status === TESTCASE_STATUS.PASSED &&
        curr.status === TESTCASE_STATUS.FAILED
      ) {
        regressions.push({
          testId,
          title: curr.title || prev.title,
          fromRound: prevRound,
          toRound: currRound,
          caseId: curr.id,
          roundId: curr.roundId,
        })
      } else if (
        prev.status === TESTCASE_STATUS.FAILED &&
        curr.status === TESTCASE_STATUS.PASSED
      ) {
        recoveries.push({
          testId,
          title: curr.title || prev.title,
          fromRound: prevRound,
          toRound: currRound,
        })
      }
    }
  }
  // Most-recent regressions first
  regressions.sort(
    (a, b) =>
      (toMillis(b.toRound?.createdAt) || 0) - (toMillis(a.toRound?.createdAt) || 0)
  )
  // When scoped to a round, only show regressions that landed in this round
  // (the FAILED side). Recoveries follow the same rule.
  const scopedRegressions = scopeRoundId
    ? regressions.filter((r) => r.roundId === scopeRoundId)
    : regressions
  const scopedRecoveries = scopeRoundId
    ? recoveries.filter((r) => r.toRound?.id === scopeRoundId)
    : recoveries

  // Oldest open bugs — bugs that have been sitting in the active queue the
  // longest without being closed, fixed, or backlogged. A signal of triage
  // debt.
  const now = Date.now()
  const openBugs = scopedBugs
    .filter(
      (b) =>
        b.status === BUG_STATUS.OPEN ||
        b.status === BUG_STATUS.IN_PROGRESS ||
        b.status === BUG_STATUS.RETEST
    )
    .map((b) => {
      const created = toMillis(b.createdAt)
      const ageDays = created ? Math.floor((now - created) / 86400000) : null
      return { bug: b, ageDays }
    })
    .filter((x) => x.ageDays != null)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8)

  return {
    passed,
    failed,
    retest,
    pending,
    executed,
    passRate,
    avgSecPerCase,
    casesWithTime: timed.length,
    bugsTotal,
    bugsOpen,
    bugsFixed,
    bugsBacklog,
    bugStatusCounts,
    severityCounts,
    avgFixHours,
    fixedWithDuration: fixDurations.length,
    modules,
    testers,
    regressions: scopedRegressions,
    recoveries: scopedRecoveries,
    openBugsAged: openBugs,
  }
}

function toMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return null
}

const TONE_BG = {
  secondary: 'bg-secondary-container/15 text-secondary',
  danger: 'bg-danger-container/15 text-danger',
  primary: 'bg-primary-container/15 text-primary',
  tertiary: 'bg-tertiary/15 text-tertiary',
}

function KpiCard({ icon: Icon, tone, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={[
            'w-9 h-9 rounded-md flex items-center justify-center shrink-0',
            TONE_BG[tone] || 'bg-surface-low text-ink-muted',
          ].join(' ')}
        >
          <Icon size={18} />
        </div>
        <div className="label-sm">{label}</div>
      </div>
      <div className="text-h2 font-bold">{value}</div>
      {sub && <div className="text-[12px] text-ink-dim mt-1">{sub}</div>}
    </div>
  )
}

function Card({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-2 mb-4">
        {Icon && <Icon size={16} className="text-primary mt-0.5" />}
        <div>
          <h3 className="text-h3 mb-0.5">{title}</h3>
          {subtitle && <p className="text-[12px] text-ink-dim">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

const SEGMENT_BG = {
  secondary: 'bg-secondary',
  danger: 'bg-danger',
  primary: 'bg-primary',
  tertiary: 'bg-tertiary',
  'ink-muted': 'bg-ink-muted',
  'ink-dim': 'bg-ink-dim',
}

function StackBar({ segments }) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0)
  if (total === 0) return <Empty text="No data yet." />
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-low mb-3">
        {segments.map((s, i) => {
          const w = ((s.value || 0) / total) * 100
          if (w === 0) return null
          return (
            <div
              key={i}
              className={SEGMENT_BG[s.tone] || 'bg-ink-dim'}
              style={{ width: `${w}%` }}
              title={`${s.label}: ${s.value}`}
            />
          )
        })}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-body-md">
        {segments.map((s, i) => {
          const p = total ? Math.round(((s.value || 0) / total) * 100) : 0
          return (
            <li key={i} className="flex items-center gap-2">
              <span
                className={[
                  'w-2.5 h-2.5 rounded-full shrink-0',
                  SEGMENT_BG[s.tone] || 'bg-ink-dim',
                ].join(' ')}
              />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="font-mono text-ink-muted">{s.value || 0}</span>
              <span className="text-[11px] text-ink-dim w-9 text-right">{p}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Empty({ text }) {
  return <div className="text-body-md text-ink-dim italic py-4">{text}</div>
}
