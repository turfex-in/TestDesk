import { useEffect, useMemo, useState } from 'react'
import { Calendar, User, Flag, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { splitIntoBatches, distributionSummary } from '../../services/batchSplitter'
import { listTesters, createRound, bulkInsertTestCases, bulkInsertBatches } from '../../services/firebaseService'
import { PRIORITY_WEIGHT, TESTCASE_STATUS, ROUND_STATUS, DEFAULT_DAILY_CAPACITY } from '../../utils/constants'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProject } from '../../context/ProjectContext.jsx'
import { useNavigate } from 'react-router-dom'
import Badge from '../common/Badge.jsx'
import { format } from 'date-fns'

export default function StepReview({ expanded, onBack }) {
  const { profile } = useAuth()
  const { selected } = useProject()
  const navigate = useNavigate()

  const [testers, setTesters] = useState([])
  const [form, setForm] = useState({
    name: '',
    module: '',
    assignedTo: '',
    deadline: '',
    dailyCapacity: DEFAULT_DAILY_CAPACITY,
    startDate: format(new Date(), 'yyyy-MM-dd'),
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listTesters().then(setTesters).catch(() => setTesters([]))
  }, [])

  useEffect(() => {
    // Default module to the dominant module in cases
    if (!form.module && expanded.length) {
      const counts = {}
      expanded.forEach((c) => (counts[c.module] = (counts[c.module] || 0) + 1))
      const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (dom) setForm((f) => ({ ...f, module: dom }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded.length])

  const batches = useMemo(
    () =>
      distributionSummary(
        splitIntoBatches(expanded, {
          startDate: new Date(form.startDate),
          dailyCapacity: Number(form.dailyCapacity) || DEFAULT_DAILY_CAPACITY,
        })
      ),
    [expanded, form.dailyCapacity, form.startDate]
  )

  async function handleCreate() {
    if (!selected?.id) return toast.error('Select a project first.')
    if (!form.name.trim()) return toast.error('Round name is required.')
    if (!form.assignedTo) return toast.error('Assign a tester.')

    setSaving(true)
    try {
      const nowIdx = 1
      const roundId = await createRound({
        projectId: selected.id,
        roundNumber: nowIdx,
        name: form.name.trim(),
        module: form.module.trim() || 'General',
        assignedTo: form.assignedTo,
        status: ROUND_STATUS.ACTIVE,
        totalCases: expanded.length,
        passed: 0,
        failed: 0,
        pending: expanded.length,
        startDate: new Date(form.startDate),
        deadline: form.deadline ? new Date(form.deadline) : null,
        createdBy: profile.uid,
      })

      // Flatten batches → testcase docs with batchDay / batchDate
      const tcDocs = []
      for (const b of batches) {
        for (const tc of b.cases) {
          tcDocs.push({
            roundId,
            projectId: selected.id,
            testId: tc.testId,
            title: tc.title,
            module: tc.module,
            originalDescription: tc.description || '',
            expandedSteps: tc.steps || [],
            expectedResult: tc.expectedResult || '',
            priority: tc.priority,
            weight: PRIORITY_WEIGHT[tc.priority] || 1,
            estimatedMinutes: tc.estimatedMinutes || 5,
            status: TESTCASE_STATUS.PENDING,
            batchDay: b.dayNumber,
            batchDate: b.date,
            isCarryOver: false,
            isRetest: false,
            executedAt: null,
            executedBy: null,
            roundResults: { round1: null, round2: null, round3: null },
          })
        }
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-5">
        {/* Round details */}
        <div className="card p-6 col-span-2 space-y-4">
          <h3 className="text-h3">Round details</h3>
          <div>
            <label className="label-sm block mb-1.5">Round name</label>
            <input
              className="input"
              placeholder="e.g. Login & Onboarding"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-sm block mb-1.5">Module</label>
              <input
                className="input"
                placeholder="e.g. Onboarding"
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
          <div className="grid grid-cols-3 gap-4">
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
              <label className="label-sm block mb-1.5">Daily capacity</label>
              <input
                type="number"
                min={5}
                max={60}
                className="input"
                value={form.dailyCapacity}
                onChange={(e) => setForm({ ...form, dailyCapacity: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="card p-6 space-y-4">
          <h3 className="text-h3">Summary</h3>
          <div className="space-y-2 text-body-md">
            <div className="flex justify-between">
              <span className="text-ink-dim">Total test cases</span>
              <span className="font-semibold">{expanded.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-dim">Days to execute</span>
              <span className="font-semibold">{batches.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-dim">Estimated hours</span>
              <span className="font-semibold">
                {Math.round(expanded.reduce((s, t) => s + (t.estimatedMinutes || 0), 0) / 60)}h
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-outline-variant/40">
            <div className="label-sm mb-2">Priority mix</div>
            {['Critical', 'High', 'Medium', 'Low'].map((p) => {
              const n = expanded.filter((c) => c.priority === p).length
              if (!n) return null
              return (
                <div key={p} className="flex justify-between text-body-md py-0.5">
                  <span className="text-ink-muted">{p}</span>
                  <span className="font-mono">{n}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Batch preview */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-outline-variant/40 flex items-center justify-between">
          <div>
            <div className="label-sm">Daily batch split</div>
            <div className="text-body-md text-ink-muted mt-1">
              Weighted by priority (Critical=3, High=2, Medium=1.5, Low=1). Weekends skipped.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-0 divide-x divide-outline-variant/30">
          {batches.slice(0, 8).map((b) => (
            <div key={b.dayNumber} className="p-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="label-sm">Day {b.dayNumber}</div>
                <div className="font-mono text-[11px] text-ink-dim">{format(new Date(b.date), 'MMM d')}</div>
              </div>
              <div className="text-h3 font-bold">{b.cases.length}</div>
              <div className="text-body-md text-ink-dim mb-3">cases</div>
              <div className="flex items-center gap-1 flex-wrap">
                {b.counts.Critical > 0 && <Badge tone="danger" size="sm">{b.counts.Critical} Crit</Badge>}
                {b.counts.High > 0 && <Badge tone="tertiary" size="sm">{b.counts.High} High</Badge>}
                {b.counts.Medium > 0 && <Badge tone="primary" size="sm">{b.counts.Medium} Med</Badge>}
                {b.counts.Low > 0 && <Badge tone="secondary" size="sm">{b.counts.Low} Low</Badge>}
              </div>
            </div>
          ))}
          {batches.length > 8 && (
            <div className="p-4 flex items-center justify-center text-ink-dim">
              +{batches.length - 8} more days
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn btn-md btn-ghost">← Back</button>
        <button onClick={handleCreate} disabled={saving} className="btn btn-md btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          Create Round
        </button>
      </div>
    </div>
  )
}
