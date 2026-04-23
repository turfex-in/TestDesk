import { Lightbulb, RefreshCw, ArrowDownRight, Info, Clock } from 'lucide-react'
import Badge from '../common/Badge.jsx'

const PRIORITY_TONE = {
  Critical: 'danger',
  High: 'tertiary',
  Medium: 'tertiary',
  Low: 'secondary',
}

const TYPE_TONE = {
  Positive: 'secondary',
  Negative: 'danger',
  'Edge Case': 'tertiary',
  Security: 'primary',
}

const EFFORT_TONE = {
  Easy: 'secondary',
  Medium: 'primary',
  Hard: 'tertiary',
  Complex: 'danger',
}

export default function TestCard({ tc, linkedBug }) {
  if (!tc) return null
  return (
    <div className="card p-8">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="neutral" className="font-mono" uppercase={false}>{tc.testId}</Badge>
          <Badge tone="neutral" uppercase={false}>
            {tc.module}{tc.subModule ? ` / ${tc.subModule}` : ''}
          </Badge>
          {tc.type && <Badge tone={TYPE_TONE[tc.type] || 'neutral'} size="sm">{tc.type}</Badge>}
          {tc.isRetest && (
            <Badge tone="primary">
              <RefreshCw size={12} /> Retest
            </Badge>
          )}
          {tc.isCarryOver && <Badge tone="tertiary">Carry-over</Badge>}
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div>
            <div className="text-label-sm uppercase text-ink-dim mb-1">Priority</div>
            <Badge tone={PRIORITY_TONE[tc.priority] || 'neutral'} dot>{tc.priority}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {tc.effort && <Badge tone={EFFORT_TONE[tc.effort] || 'neutral'} size="sm">{tc.effort}</Badge>}
            {tc.estimatedMinutes && (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-dim font-mono">
                <Clock size={10} /> {tc.estimatedMinutes}m
              </span>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-h2 mb-6 leading-tight">{tc.title}</h2>

      {tc.isRetest && linkedBug && (
        <div className="mb-6 border border-primary/30 bg-primary-container/10 rounded-md p-4">
          <div className="flex items-center gap-2 text-primary label-sm mb-1">
            <ArrowDownRight size={14} /> Retesting fixed bug
          </div>
          <div className="text-body-md">
            <span className="font-mono text-primary">{linkedBug.bugId}</span> — {linkedBug.title}
          </div>
          {linkedBug.fixNotes && (
            <div className="text-body-md text-ink-muted mt-2 italic">"{linkedBug.fixNotes}"</div>
          )}
        </div>
      )}

      {tc.preConditions && (
        <section className="mb-6 bg-surface-low/60 border border-outline-variant/40 rounded-md p-4">
          <div className="flex items-center gap-2 text-tertiary label-sm mb-2">
            <Info size={14} /> Pre-conditions
          </div>
          <p className="text-body-md text-ink">{tc.preConditions}</p>
        </section>
      )}

      <section className="mb-6">
        <h3 className="label-sm mb-4">Steps to Reproduce</h3>
        <ol className="space-y-3">
          {(tc.expandedSteps || []).map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-surface-high text-ink-muted flex items-center justify-center text-[13px] font-semibold shrink-0 mt-px">
                {i + 1}
              </span>
              <StepText step={step} />
            </li>
          ))}
          {(!tc.expandedSteps || tc.expandedSteps.length === 0) && (
            <li className="text-ink-dim italic">No steps supplied in CSV.</li>
          )}
        </ol>
      </section>

      <section className="bg-surface-low/60 border border-outline-variant/40 rounded-md p-5">
        <div className="flex items-center gap-2 text-primary label-sm mb-2">
          <Lightbulb size={14} /> Expected Result
        </div>
        <p className="text-body-lg italic text-ink">{tc.expectedResult || '—'}</p>
      </section>

      {tc.remarks && (
        <section className="mt-4 text-body-md text-ink-dim italic">
          Note: {tc.remarks}
        </section>
      )}
    </div>
  )
}

function StepText({ step }) {
  const parts = step.split(/(`[^`]+`)/g)
  return (
    <p className="text-body-lg leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <span key={i} className="font-mono text-[13px] bg-surface-high/70 text-primary px-1.5 py-0.5 rounded-sm mx-0.5">
            {p.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  )
}
