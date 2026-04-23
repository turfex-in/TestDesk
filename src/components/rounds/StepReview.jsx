import { useEffect, useMemo, useState } from 'react'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { splitIntoBatches, distributionSummary } from '../../services/batchSplitter'
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
import { format, parseISO } from 'date-fns'

export default function StepReview({ testCases, onBack }) {
  const { profile } = useAuth()
  const { selected } = useProject()
  const navigate = useNavigate()

  const [testers, setTesters] = useState([])
  const [form, setForm] = useState({
    name: '',
    module: '',
    assignedTo: '',
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

  const batches = useMemo(
    () =>
      distributionSummary(
        splitIntoBatches(testCases, {
          startDate: parseISO(form.startDate),
          dailyMinutes: Number(form.dailyMinutes) || DEFAULT_DAILY_MINUTES,
          dailyCapacity: Number(form.dailyCapacity) || DEFAULT_DAILY_CAPACITY,
          orderBy: form.orderBy,
        })
      ),
    [testCases, form.dailyMinutes, form.dailyCapacity, form.startDate, form.orderBy]
  )

  async function handleCreate() {
    if (!selected?.id) return toast.error('Select a project first.')
    if (!form.name.trim()) return toast.error('Round name is required.')
    if (!form.assignedTo) return toast.error('Assign a tester.')

    setSaving(true)
    try {
      const roundId = await createRound({
        projectId: selected.id,
        roundNumber: 1,
        name: form.name.trim(),
        module: form.module.trim() || 'General',
        assignedTo: form.assignedTo,
        status: ROUND_STATUS.ACTIVE,
        totalCases: testCases.length,
        passed: 0,
        failed: 0,
        pending: testCases.length,
        startDate: parseISO(form.startDate),
        deadline: form.deadline ? parseISO(form.deadline) : null,
        createdBy: profile.uid,
      })

      const tcDocs = []
      for (const b of batches) {
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
        batches.map((b) => ({
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
          assignedTo: form.assignedTo,
        }))
      )

      toast.success('Round created')
      navigate(`/rounds/${roundId}`)
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
          <div className="grid grid-cols-2 gap-4">
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
              <label className="label-sm block mb-1.5">Assigned tester</label>
              <select
                className="input"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
              >
                <option value="">— select tester —</option>
                {testers.map((t) => (
                  <option key={t.uid} value={t.uid}>
                    {t.name} — {t.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="label-sm block mb-1.5">Start date</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label-sm block mb-1.5">Deadline</label>
              <input
                type="date"
                className="input"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
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
