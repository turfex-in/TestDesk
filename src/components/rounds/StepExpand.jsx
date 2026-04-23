import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, Wand2, Check, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { expandAllTestCases, aiReady } from '../../services/aiService'
import { cn } from '../../utils/helpers'
import toast from 'react-hot-toast'
import Badge from '../common/Badge.jsx'

export default function StepExpand({ mapped, initialExpanded, onBack, onNext }) {
  const [state, setState] = useState(initialExpanded ? 'done' : 'idle')
  const [progress, setProgress] = useState({ done: 0, total: mapped.length })
  const [expanded, setExpanded] = useState(initialExpanded || [])
  const [expandedRowIdx, setExpandedRowIdx] = useState(null)
  const cancelled = useRef(false)

  useEffect(() => () => (cancelled.current = true), [])

  async function start() {
    setState('running')
    try {
      const result = await expandAllTestCases(
        mapped,
        (done, total) => {
          if (cancelled.current) return
          setProgress({ done, total })
        }
      )
      if (cancelled.current) return
      const merged = mapped.map((tc, i) => ({ ...tc, ...result[i] }))
      setExpanded(merged)
      setState('done')
      toast.success(`Expanded ${merged.length} test cases`)
    } catch (err) {
      toast.error(err.message || 'AI expansion failed')
      setState('idle')
    }
  }

  function updateExpanded(idx, patch) {
    setExpanded((prev) => prev.map((tc, i) => (i === idx ? { ...tc, ...patch } : tc)))
  }

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-md bg-primary-container/20 flex items-center justify-center text-primary">
            <Sparkles size={22} />
          </div>
          <div className="flex-1">
            <h3 className="text-h3">AI-powered expansion</h3>
            <p className="text-body-md text-ink-muted mt-1">
              We'll send each test case to <span className="font-mono text-primary">llama-3.3-70b-versatile</span> on
              Groq to generate detailed reproduction steps, expected results, and time estimates. Batches of 5 with a
              1s gap so you don't hit rate limits.
            </p>
            {!aiReady() && (
              <div className="mt-3 flex items-center gap-2 text-tertiary text-body-md">
                <AlertTriangle size={14} />
                No Groq API key set — running with deterministic fallback expansions.
              </div>
            )}
          </div>
        </div>

        {state !== 'done' && (
          <div className="mt-6 flex items-center gap-4">
            {state === 'running' ? (
              <>
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="font-medium">
                    Expanding {progress.done} of {progress.total}…
                  </span>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-surface-low overflow-hidden">
                  <div
                    className="h-full bg-primary-container transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <button onClick={start} className="btn btn-md btn-primary">
                <Wand2 size={16} /> Start AI expansion
              </button>
            )}
          </div>
        )}

        {state === 'done' && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-secondary">
              <Check size={18} />
              <span className="font-medium">Expanded {expanded.length} test cases</span>
            </div>
            <Badge tone="secondary">Ready to review</Badge>
          </div>
        )}
      </div>

      {state === 'done' && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-outline-variant/40 flex items-center justify-between">
            <div className="label-sm">Review expansions</div>
            <div className="text-body-md text-ink-dim">Click a row to edit</div>
          </div>
          <div className="divide-y divide-outline-variant/30">
            {expanded.map((tc, i) => (
              <ExpansionRow
                key={i}
                tc={tc}
                open={expandedRowIdx === i}
                onToggle={() => setExpandedRowIdx(expandedRowIdx === i ? null : i)}
                onChange={(patch) => updateExpanded(i, patch)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="btn btn-md btn-ghost">
          ← Back
        </button>
        <button
          disabled={state !== 'done'}
          onClick={() => onNext(expanded)}
          className="btn btn-md btn-primary"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

function ExpansionRow({ tc, open, onToggle, onChange }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-surface-high/40"
      >
        {open ? <ChevronDown size={16} className="text-ink-dim" /> : <ChevronRight size={16} className="text-ink-dim" />}
        <span className="font-mono text-primary text-[12px] w-20">{tc.testId}</span>
        <span className="flex-1 truncate">{tc.title}</span>
        <Badge tone="neutral" size="sm" uppercase={false}>
          {tc.module}
        </Badge>
        <span className="text-body-md text-ink-dim">{tc.estimatedMinutes}m</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-3 bg-surface-lowest/60">
          <div>
            <label className="label-sm block mb-1.5">Steps</label>
            <textarea
              className="input min-h-[120px] font-mono text-[12px]"
              value={tc.steps.join('\n')}
              onChange={(e) => onChange({ steps: e.target.value.split('\n').filter(Boolean) })}
            />
          </div>
          <div>
            <label className="label-sm block mb-1.5">Expected Result</label>
            <textarea
              className="input min-h-[70px]"
              value={tc.expectedResult}
              onChange={(e) => onChange({ expectedResult: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="label-sm">Est. minutes</label>
            <input
              type="number"
              min={1}
              className="input w-24"
              value={tc.estimatedMinutes}
              onChange={(e) => onChange({ estimatedMinutes: Number(e.target.value) || 1 })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
