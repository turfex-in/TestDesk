import { ArrowRight, Check } from 'lucide-react'
import { fmtDate, pct } from '../../utils/helpers'

// Each step = { roundNumber, total, passed, failed, date, testerName }
export default function FunnelOverview({ steps = [], allPassed = false }) {
  const sizes = [180, 148, 118, 98, 86]
  return (
    <div className="card p-8 bg-gradient-to-br from-surface to-surface-low">
      <div className="flex items-center justify-center gap-4 min-h-[200px] overflow-x-auto">
        {steps.map((s, i) => {
          const size = sizes[Math.min(i, sizes.length - 1)]
          return (
            <div key={s.roundNumber} className="flex items-center gap-4 shrink-0">
              <FunnelCircle size={size} step={s} />
              {i < steps.length - 1 && <ArrowRight className="text-outline-variant" size={26} />}
            </div>
          )
        })}
        {allPassed && (
          <>
            <ArrowRight className="text-outline-variant" size={26} />
            <div className="shrink-0 flex flex-col items-center">
              <div
                className="rounded-full bg-secondary-container/30 border-2 border-secondary flex items-center justify-center text-secondary glow-primary"
                style={{ width: 100, height: 100 }}
              >
                <Check size={40} />
              </div>
              <div className="mt-3 text-center">
                <div className="font-semibold text-secondary">All Passed</div>
                <div className="font-mono text-[11px] text-ink-dim uppercase mt-0.5">Stable Version</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FunnelCircle({ size, step }) {
  const total = step.total || 0
  const passed = step.passed || 0
  const failed = step.failed || 0
  const strokeWidth = Math.max(5, Math.round(size * 0.06))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const passArc = total ? (passed / total) * c : 0
  const failArc = total ? (failed / total) * c : 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="#2d2d38" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="transparent"
            stroke="#4edea3"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${passArc} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="transparent"
            stroke="#ffb4ab"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${failArc} ${c}`}
            strokeDashoffset={-passArc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[28px] font-bold leading-none">{total}</div>
          <div className="text-label-sm text-ink-dim uppercase mt-1">Total</div>
        </div>
      </div>
      <div className="mt-3 text-center">
        <div className="font-semibold">Round {step.roundNumber}</div>
        <div className="font-mono text-[11px] text-ink-dim uppercase mt-0.5">
          {step.date && `${fmtDate(step.date, 'MMM d')} • `}{step.testerName || ''}
        </div>
      </div>
    </div>
  )
}
