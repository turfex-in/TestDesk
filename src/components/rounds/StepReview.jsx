import { useEffect, useMemo, useState } from 'react'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { splitIntoBatches, distributionSummary } from '../../services/batchSplitter'
import { splitAcrossTesters, summarizeSplit } from '../../services/testerSplitter'
import { listTesters, createRound, bulkInsertTestCases, bulkInsertBatches } from '../../services/firebaseService'
import {
  PRIORITY_WEIGHT,
  TESTCASE_STATUS,
  ROUND_STATUS,
  DEFAULT_DAILY_CAPACITY,
  DEFAULT_DAILY_MINUTES,
} from '../../utils/constants'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProject } from '../../context/ProjectContext.jsx'
import { useNavigate } from 'react-router-dom'
import Badge from '../common/Badge.jsx'
import { format, parseISO, isWeekend } from 'date-fns'

export default function StepReview({ testCases, onBack }) {
  const { profile } = useAuth()
  const { selected } = useProject()
  const navigate = useNavigate()

  const [testers, setTesters] = useState([])
  const [form, setForm] = useState({
    name: '',
    module: '',
    assignees: [],
    splitStrategy: 'module',
    deadline: '',
    dailyMinutes: DEFAULT_DAILY_MINUTES,
    dailyCapacity: DEFAULT_DAILY_CAPACITY,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    orderBy: 'csv',
  })
  const [saving, setSaving] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(null)

  useEffect(() => {
    listTesters().then(setTesters).catch(() => setTesters([]))
  }, [])

  useEffect(() => {
    // Default module/name from dominant module
    if (!form.module && testCases.length) {
      const counts = {}
      testCases.forEach((c) => (counts[c.module] = (counts[c.module] || 0) + 1))
      const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (dom) {
        setForm((f) => ({
          ...f,
          module: dom,
          name: f.name || `${dom} — Round 1`,
        }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testCases.length])

  // Per-tester slice of cases. With 0 or 1 testers selected, the whole CSV
  // goes to a single (possibly placeholder) bucket so the daily preview stays
  // populated while the user is still picking testers.
  const testerBuckets = useMemo(() => {
    const n = Math.max(1, form.assignees.length)
    return splitAcrossTesters(testCases, n, form.splitStrategy)
  }, [testCases, form.assignees.length, form.splitStrategy])

  const splitSummary = useMemo(() => summarizeSplit(testerBuckets), [testerBuckets])

  // Daily-batch preview is built on tester 0's slice — one tester's view of
  // their daily plate. Each tester's actual round will use their own slice.
  const previewSlice = testerBuckets[0] || testCases
  const batches = useMemo(
    () =>
      distributionSummary(
        splitIntoBatches(previewSlice, {
          startDate: parseISO(form.startDate),
          dailyMinutes: Number(form.dailyMinutes) || DEFAULT_DAILY_MINUTES,
          dailyCapacity: Number(form.dailyCapacity) || DEFAULT_DAILY_CAPACITY,
          orderBy: form.orderBy,
        })
      ),
    [previewSlice, form.dailyMinutes, form.dailyCapacity, form.startDate, form.orderBy]
  )

  async function handleCreate() {
    if (!selected?.id) return toast.error('Select a project first.')
    if (!form.name.trim()) return toast.error('Round name is required.')
    if (form.assignees.length === 0) return toast.error('Assign at least one tester.')

    setSaving(true)
    try {
      const multi = form.assignees.length > 1
      const roundIds = []
      for (let i = 0; i < form.assignees.length; i++) {
        const uid = form.assignees[i]
        const tester = testers.find((t) => t.uid === uid)
        const slice = testerBuckets[i] || []
        const perTesterBatches = distributionSummary(
          splitIntoBatches(slice, {
            startDate: parseISO(form.startDate),
            dailyMinutes: Number(form.dailyMinutes) || DEFAULT_DAILY_MINUTES,
            dailyCapacity: Number(form.dailyCapacity) || DEFAULT_DAILY_CAPACITY,
            orderBy: form.orderBy,
          })
        )

        const roundName = multi
          ? `${form.name.trim()} · ${tester?.name || 'Tester'}`
          : form.name.trim()

        const roundId = await createRound({
          projectId: selected.id,
          roundNumber: 1,
          name: roundName,
          module: form.module.trim() || 'General',
          assignedTo: uid,
          status: ROUND_STATUS.ACTIVE,
          totalCases: slice.length,
          passed: 0,
          failed: 0,
          pending: slice.length,
          startDate: parseISO(form.startDate),
          deadline: form.deadline ? parseISO(form.deadline) : null,
          createdBy: profile.uid,
        })
        roundIds.push(roundId)

        const tcDocs = []
        for (const b of perTesterBatches) {
          b.cases.forEach((tc, orderInDay) => {
            tcDocs.push({
              roundId,
              projectId: selected.id,
              testId: tc.testId,
              title: tc.title,
              module: tc.module,
              subModule: tc.subModule || '',
              preConditions: tc.preConditions || '',
              originalDescription: tc.description || '',
              expandedSteps: tc.steps || [],
              expectedResult: tc.expectedResult || '',
              priority: tc.priority,
              type: tc.type || 'Positive',
              effort: tc.effort || '',
              remarks: tc.remarks || '',
              weight: PRIORITY_WEIGHT[tc.priority] || 1,
              estimatedMinutes: tc.estimatedMinutes || 5,
              status: TESTCASE_STATUS.PENDING,
              batchDay: b.dayNumber,
              batchDate: b.date,
              batchOrder: orderInDay,
              isCarryOver: false,
              isRetest: false,
              executedAt: null,
              executedBy: null,
              roundResults: { round1: null, round2: null, round3: null },
            })
          })
        }
        await bulkInsertTestCases(tcDocs)
        await bulkInsertBatches(
          perTesterBatches.map((b) => ({
            roundId,
            dayNumber: b.dayNumber,
            date: b.date,
            totalCases: b.cases.length,
            newCases: b.cases.length,
            carryOvers: 0,
            retests: 0,
            completed: 0,
            passed: 0,
            failed: 0,
            status: b.dayNumber === 1 ? 'active' : 'upcoming',
            assignedTo: uid,
          }))
        )
      }

      toast.success(multi ? `${roundIds.length} rounds created` : 'Round created')
      navigate(multi ? '/rounds' : `/rounds/${roundIds[0]}`)
    } catch (err) {
      toast.error(err.message || 'Could not create round')
    } finally {
      setSaving(false)
    }
  }

  const missingSteps = testCases.filter((t) => !t.steps?.length).length
  const missingExpected = testCases.filter((t) => !t.expectedResult).length

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const startInPast = form.startDate < todayStr
  const daysInPast = startInPast
    ? batches.filter((b) => b.date < todayStr).length
    : 0
  const carryOverCaseCount = startInPast
    ? batches
        .filter((b) => b.date < todayStr)
        .reduce((acc, b) => acc + b.cases.length, 0)
    : 0

  const deadlineWindowDays = useMemo(
    () => (form.deadline ? countBusinessDays(form.startDate, form.deadline) : 0),
    [form.startDate, form.deadline]
  )
  const deadlineMissed = form.deadline && batches.length > deadlineWindowDays

  // Auto-fit sizes daily caps against the heaviest tester's slice — that
  // tester is the long pole, so fitting them by the deadline fits everyone.
  const heaviestBucket = useMemo(() => {
    let max = { cases: 0, minutes: 0 }
    for (let i = 0; i < testerBuckets.length; i++) {
      const cases = testerBuckets[i].length
      const minutes = splitSummary[i]?.minutes || 0
      if (minutes > max.minutes) max = { cases, minutes }
    }
    return max
  }, [testerBuckets, splitSummary])

  const setDeadlineAutoFit = (deadline) => {
    setForm((f) => fitToDeadline({ ...f, deadline }, heaviestBucket))
  }
  const setStartDateAutoFit = (startDate) => {
    setForm((f) =>
      f.deadline
        ? fitToDeadline({ ...f, startDate }, heaviestBucket)
        : { ...f, startDate }
    )
  }

  return (
    <div className="space-y-5">
      {(missingSteps > 0 || missingExpected > 0) && (
        <div className="card p-4 border border-tertiary/40 bg-tertiary/5">
          <div className="text-tertiary text-body-md">
            Heads up: {missingSteps > 0 && <><strong>{missingSteps}</strong> case(s) have no Test Steps. </>}
            {missingExpected > 0 && <><strong>{missingExpected}</strong> case(s) have no Expected Result. </>}
            They'll still execute, but testers will have to go on title alone.
          </div>
        </div>
      )}

      {startInPast && (
        <div className="card p-4 border border-danger/40 bg-danger/5">
          <div className="flex items-start gap-2 text-body-md text-danger">
            <span className="font-semibold shrink-0">⚠ Start date is in the past.</span>
            <span>
              The first <strong>{daysInPast}</strong> day(s) ({carryOverCaseCount} cases) have already passed.
              When the tester opens today's batch they'll be carried forward and piled on top of today's work.
              Change Start Date to{' '}
              <button
                type="button"
                onClick={() => setForm({ ...form, startDate: todayStr })}
                className="underline hover:no-underline font-semibold"
              >
                today ({todayStr})
              </button>{' '}
              to avoid this.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="card p-6 col-span-2 space-y-4">
          <h3 className="text-h3">Round details</h3>
          <div>
            <label className="label-sm block mb-1.5">Round name</label>
            <input
              className="input"
              placeholder="e.g. Login & Onboarding — Round 1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label-sm block mb-1.5">Module focus</label>
            <input
              className="input"
              placeholder="e.g. Authentication"
              value={form.module}
              onChange={(e) => setForm({ ...form, module: e.target.value })}
            />
          </div>
          <div>
            <label className="label-sm block mb-1.5">
              Assigned testers
              {form.assignees.length > 1 && (
                <span className="ml-2 text-ink-dim font-normal normal-case tracking-normal">
                  ({form.assignees.length} testers — work will be split)
                </span>
              )}
            </label>
            <TesterMultiSelect
              testers={testers}
              selected={form.assignees}
              onChange={(assignees) => setForm({ ...form, assignees })}
            />
          </div>
          {form.assignees.length > 1 && (
            <div>
              <label className="label-sm block mb-2">Split strategy</label>
              <div className="grid grid-cols-3 gap-2">
                <OrderOption
                  value="module"
                  current={form.splitStrategy}
                  onSelect={() => setForm({ ...form, splitStrategy: 'module' })}
                  title="Whole modules"
                  desc="Each tester owns coherent modules. Best for flow."
                />
                <OrderOption
                  value="contiguous"
                  current={form.splitStrategy}
                  onSelect={() => setForm({ ...form, splitStrategy: 'contiguous' })}
                  title="Contiguous chunks"
                  desc="Cuts the deck into N consecutive slices balanced by minutes."
                />
                <OrderOption
                  value="round-robin"
                  current={form.splitStrategy}
                  onSelect={() => setForm({ ...form, splitStrategy: 'round-robin' })}
                  title="Round-robin"
                  desc="Strict alternation. Simplest, but breaks app flow."
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="label-sm block mb-1.5">Start date</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setStartDateAutoFit(e.target.value)}
              />
            </div>
            <div>
              <label className="label-sm block mb-1.5">Deadline</label>
              <input
                type="date"
                className="input"
                min={form.startDate}
                value={form.deadline}
                onChange={(e) => setDeadlineAutoFit(e.target.value)}
              />
              {form.deadline && deadlineWindowDays > 0 && (
                <div className={['text-[11px] mt-1', deadlineMissed ? 'text-danger' : 'text-ink-dim'].join(' ')}>
                  {deadlineMissed
                    ? `Won't fit: needs ${batches.length} working days, only ${deadlineWindowDays} available`
                    : `Auto-fitted to ${deadlineWindowDays} working days`}
                </div>
              )}
            </div>
            <div>
              <label className="label-sm block mb-1.5">
                Daily time
                <span className="ml-1 text-ink-dim font-normal normal-case tracking-normal">(min)</span>
              </label>
              <input
                type="number"
                min={30}
                max={480}
                step={15}
                className="input"
                value={form.dailyMinutes}
                onChange={(e) => setForm({ ...form, dailyMinutes: e.target.value })}
              />
            </div>
            <div>
              <label className="label-sm block mb-1.5">
                Max cases
                <span className="ml-1 text-ink-dim font-normal normal-case tracking-normal">(cap)</span>
              </label>
              <input
                type="number"
                min={5}
                max={120}
                className="input"
                value={form.dailyCapacity}
                onChange={(e) => setForm({ ...form, dailyCapacity: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label-sm block mb-2">Test execution order</label>
            <div className="grid grid-cols-3 gap-2">
              <OrderOption
                value="csv"
                current={form.orderBy}
                onSelect={() => setForm({ ...form, orderBy: 'csv' })}
                title="CSV order"
                desc="Tester runs tests exactly as listed in the file. Best for logical flow."
              />
              <OrderOption
                value="module"
                current={form.orderBy}
                onSelect={() => setForm({ ...form, orderBy: 'module' })}
                title="By module"
                desc="Groups all cases of the same module / sub-module together."
              />
              <OrderOption
                value="priority"
                current={form.orderBy}
                onSelect={() => setForm({ ...form, orderBy: 'priority' })}
                title="By priority"
                desc="Critical first, then High → Medium → Low. Burns down risk fast."
              />
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h3 className="text-h3">Summary</h3>
          <div className="space-y-2 text-body-md">
            <Row label="Total test cases" value={testCases.length} />
            <Row label="Days to execute" value={batches.length} />
            <Row
              label="Estimated hours"
              value={`${Math.round(testCases.reduce((s, t) => s + (t.estimatedMinutes || 0), 0) / 60)}h`}
            />
          </div>
          <div className="pt-3 border-t border-outline-variant/40">
            <div className="label-sm mb-2">Priority mix</div>
            {['Critical', 'High', 'Medium', 'Low'].map((p) => {
              const n = testCases.filter((c) => c.priority === p).length
              if (!n) return null
              return (
                <div key={p} className="flex justify-between text-body-md py-0.5">
                  <span className="text-ink-muted">{p}</span>
                  <span className="font-mono">{n}</span>
                </div>
              )
            })}
          </div>
          <div className="pt-3 border-t border-outline-variant/40">
            <div className="label-sm mb-2">Type mix</div>
            {['Positive', 'Negative', 'Edge Case', 'Security'].map((t) => {
              const n = testCases.filter((c) => c.type === t).length
              if (!n) return null
              return (
                <div key={t} className="flex justify-between text-body-md py-0.5">
                  <span className="text-ink-muted">{t}</span>
                  <span className="font-mono">{n}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {form.assignees.length > 1 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-outline-variant/40">
            <div className="label-sm">Work split across testers</div>
            <div className="text-body-md text-ink-muted mt-1">
              {form.splitStrategy === 'module' && 'Whole modules assigned to whichever tester has the lighter load.'}
              {form.splitStrategy === 'contiguous' && 'Consecutive slices of the CSV, balanced by estimated minutes.'}
              {form.splitStrategy === 'round-robin' && 'Strict alternation — TC-001 to tester 1, TC-002 to tester 2, etc.'}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-outline-variant/30">
            {form.assignees.map((uid, i) => {
              const tester = testers.find((t) => t.uid === uid)
              const s = splitSummary[i] || { caseCount: 0, minutes: 0, modules: [] }
              return (
                <div key={uid} className="p-4">
                  <div className="font-semibold mb-1">{tester?.name || 'Tester'}</div>
                  <div className="text-[11px] text-ink-dim mb-3">{tester?.email}</div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <div className="text-h3 font-bold">{s.caseCount}</div>
                    <div className="text-body-md text-ink-dim">cases</div>
                  </div>
                  <div className="font-mono text-[11px] text-primary mb-3">
                    ~{formatMinutes(s.minutes)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.modules.slice(0, 6).map((m) => (
                      <Badge key={m.name} tone="neutral" size="sm" uppercase={false}>
                        {m.name} · {m.count}
                      </Badge>
                    ))}
                    {s.modules.length > 6 && (
                      <span className="text-[11px] text-ink-dim self-center">
                        +{s.modules.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Daily batch split */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-outline-variant/40">
          <div className="label-sm">Daily batch split</div>
          <div className="text-body-md text-ink-muted mt-1">
            Weighted by priority (Critical=3, High=2, Medium=1.5, Low=1). Weekends skipped.
          </div>
        </div>
        <div className="grid grid-cols-4 gap-0 divide-x divide-outline-variant/30">
          {batches.slice(0, 8).map((b) => (
            <div key={b.dayNumber} className="p-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="label-sm">Day {b.dayNumber}</div>
                <div className="font-mono text-[11px] text-ink-dim">{format(parseISO(b.date), 'MMM d')}</div>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-h3 font-bold">{b.cases.length}</div>
                <div className="text-body-md text-ink-dim">cases</div>
              </div>
              <div className="font-mono text-[11px] text-primary mb-3">
                ~{formatMinutes(b.minutes)}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {b.counts.Critical > 0 && <Badge tone="danger" size="sm">{b.counts.Critical} Crit</Badge>}
                {b.counts.High > 0 && <Badge tone="tertiary" size="sm">{b.counts.High} High</Badge>}
                {b.counts.Medium > 0 && <Badge tone="primary" size="sm">{b.counts.Medium} Med</Badge>}
                {b.counts.Low > 0 && <Badge tone="secondary" size="sm">{b.counts.Low} Low</Badge>}
              </div>
            </div>
          ))}
          {batches.length > 8 && (
            <div className="p-4 flex items-center justify-center text-ink-dim col-span-4">
              +{batches.length - 8} more days
            </div>
          )}
        </div>
      </div>

      {/* Preview test cases */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-outline-variant/40 flex items-center justify-between">
          <div className="label-sm">Preview test cases</div>
          <div className="text-body-md text-ink-dim">Click a row to see steps / expected result</div>
        </div>
        <div className="divide-y divide-outline-variant/30 max-h-[420px] overflow-y-auto">
          {testCases.map((tc, i) => (
            <div key={i}>
              <button
                onClick={() => setPreviewIdx(previewIdx === i ? null : i)}
                className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-surface-high/40"
              >
                {previewIdx === i ? (
                  <ChevronDown size={14} className="text-ink-dim shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-ink-dim shrink-0" />
                )}
                <span className="font-mono text-primary text-[12px] w-20 shrink-0">{tc.testId}</span>
                <span className="flex-1 truncate">{tc.title}</span>
                <Badge tone="neutral" size="sm" uppercase={false}>
                  {tc.module}{tc.subModule ? ` / ${tc.subModule}` : ''}
                </Badge>
                <Badge
                  tone={tc.priority === 'Critical' ? 'danger' : tc.priority === 'High' ? 'tertiary' : tc.priority === 'Medium' ? 'primary' : 'secondary'}
                  size="sm"
                  dot
                >
                  {tc.priority}
                </Badge>
                <Badge tone="ink-muted" size="sm">
                  {tc.type}
                </Badge>
              </button>
              {previewIdx === i && (
                <div className="px-5 pb-5 pt-1 space-y-3 bg-surface-lowest/60 text-body-md">
                  {tc.preConditions && (
                    <div>
                      <div className="label-sm mb-1">Pre-conditions</div>
                      <div className="text-ink-muted">{tc.preConditions}</div>
                    </div>
                  )}
                  <div>
                    <div className="label-sm mb-1">Steps ({tc.steps?.length || 0})</div>
                    <ol className="list-decimal pl-5 space-y-0.5 text-ink">
                      {(tc.steps || []).map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                      {(!tc.steps || tc.steps.length === 0) && (
                        <li className="list-none text-ink-dim italic">No steps supplied.</li>
                      )}
                    </ol>
                  </div>
                  <div>
                    <div className="label-sm mb-1 text-secondary">Expected result</div>
                    <div className="text-ink">{tc.expectedResult || <span className="text-ink-dim italic">Not supplied</span>}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between sticky bottom-0 bg-bg/90 backdrop-blur py-3 -mx-8 px-8 border-t border-outline-variant/30">
        <button onClick={onBack} className="btn btn-md btn-ghost">← Back</button>
        <button onClick={handleCreate} disabled={saving} className="btn btn-md btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Create Round
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-dim">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function countBusinessDays(startISO, endISO) {
  if (!startISO || !endISO) return 0
  const start = parseISO(startISO)
  const end = parseISO(endISO)
  if (end < start) return 0
  let n = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    if (!isWeekend(cursor)) n++
    cursor.setDate(cursor.getDate() + 1)
  }
  return n
}

// Re-tune dailyMinutes / dailyCapacity so the round fits the start→deadline
// working-day window. Sized against the heaviest tester's slice (the long
// pole). Both inputs are clamped to their UI min/max — if the window is
// too tight, the splitter will still produce more days than fit and the
// caller renders a warning via `batches.length > deadlineWindowDays`.
function fitToDeadline(form, heaviest) {
  const days = countBusinessDays(form.startDate, form.deadline)
  if (days <= 0) return form
  const totalMin = heaviest.minutes || 0
  const totalCases = heaviest.cases || 0
  if (totalMin === 0 || totalCases === 0) return form
  const minutesPerDay = Math.max(30, Math.min(480, Math.ceil(totalMin / days)))
  const casesPerDay = Math.max(5, Math.min(120, Math.ceil(totalCases / days)))
  return { ...form, dailyMinutes: minutesPerDay, dailyCapacity: casesPerDay }
}

function TesterMultiSelect({ testers, selected, onChange }) {
  const toggle = (uid) => {
    onChange(selected.includes(uid) ? selected.filter((x) => x !== uid) : [...selected, uid])
  }
  if (!testers.length) {
    return <div className="text-body-md text-ink-dim italic">No testers found.</div>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {testers.map((t) => {
        const active = selected.includes(t.uid)
        return (
          <button
            key={t.uid}
            type="button"
            onClick={() => toggle(t.uid)}
            className={[
              'text-left rounded-md border px-3 py-2 transition-colors text-body-md',
              active
                ? 'border-primary bg-primary-container/20 text-primary'
                : 'border-outline-variant/60 text-ink hover:border-primary/50 hover:bg-surface-high/40',
            ].join(' ')}
          >
            <span className="font-semibold">{t.name}</span>
            <span className="ml-2 text-[12px] text-ink-dim normal-case tracking-normal">{t.email}</span>
          </button>
        )
      })}
    </div>
  )
}

function formatMinutes(mins) {
  const m = Math.round(mins || 0)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h ${rest}m` : `${h}h`
}

function OrderOption({ value, current, onSelect, title, desc }) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'text-left rounded-md border p-3 transition-colors',
        active
          ? 'border-primary bg-primary-container/15'
          : 'border-outline-variant/60 hover:border-primary/50 hover:bg-surface-high/40',
      ].join(' ')}
    >
      <div className={['text-body-md font-semibold mb-1', active ? 'text-primary' : 'text-ink'].join(' ')}>
        {title}
      </div>
      <div className="text-[12px] text-ink-dim leading-snug">{desc}</div>
    </button>
  )
}
